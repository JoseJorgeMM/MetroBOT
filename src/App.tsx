import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloudRain, X } from 'lucide-react';
import { AssistantPanel } from './components/AssistantPanel';
import { HonestyBadge } from './components/HonestyBadge';
import { InstallBanner } from './components/InstallBanner';
import { MapComponent } from './components/Map/MapComponent';
import { GoogleTransitMap } from './components/Map/GoogleTransitMap';
import { planTransit, requestGoogleRoutes } from './lib/transitPlanner';
import { NavigationOverlay } from './components/Map/NavigationOverlay';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import { MobileExploreSurface } from './components/MobileExploreSurface';
import { QuickPicksBar } from './components/QuickPicksBar';
import { RouteComparison } from './components/RouteComparison';
import { SkipLink } from './components/SkipLink';
import { SupportCard } from './components/SupportCard';
import {
  TripPlannerPanel,
  type PlaceValue,
  type PlannerField,
} from './components/TripPlannerPanel';
import { UpdateToast } from './components/UpdateToast';
import { useMobileSurface } from './hooks/useMobileSurface';
import { useNavigation } from './hooks/useNavigation';
import { computeHonestyAssessment } from './lib/honesty';
import { processUserQuery } from './lib/gemini';
import { runMigrations } from './lib/migration';
import {
  admitAssistantRequest,
  admitRouteRequest,
  completeAppRequest,
  createAppRequestState,
} from './lib/appRouteFlow';
import {
  isSheetResizable,
  shouldShowPersistentSupport,
  type SheetPresentation,
} from './lib/mobileSurface';
import type { RouteOption } from './lib/routing';
import { fetchMedellinWeather, type WeatherData } from './lib/weather';
import { withDeadline } from './lib/requestDeadline';

const DISCLAIMER_STORAGE_KEY = 'metrobot.disclaimer.dismissed.v1';
const BUSES_TOGGLE_STORAGE_KEY = 'metrobot.buses.enabled.v1';

type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const surfaceTitles = {
  explore: '¿A dónde vas?',
  planning: 'Planifica tu viaje',
  loading: 'Calculando rutas',
  results: 'Rutas sugeridas',
  assistant: 'Pregúntale a MetroBot',
  navigation: 'Navegación',
} as const;

export default function App() {
  const { surface, presentation, dispatch: dispatchSurface } = useMobileSurface();
  const nav = useNavigation();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [pendingRoutes, setPendingRoutes] = useState<RouteOption[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [honestyAssessment, setHonestyAssessment] = useState<ReturnType<typeof computeHonestyAssessment> | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [providerNotice, setProviderNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [origin, setOrigin] = useState<PlaceValue | null>(null);
  const [dest, setDest] = useState<PlaceValue | null>(null);
  const [mapSelectionMode, setMapSelectionMode] = useState<PlannerField | null>(null);
  const appRequestRef = useRef(createAppRequestState());
  const lastExploreActionRef = useRef<'planning' | 'assistant' | null>(null);
  const previousSurfaceRef = useRef(surface);

  const [busesEnabled, setBusesEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(BUSES_TOGGLE_STORAGE_KEY);
      return stored === null ? true : stored === '1';
    } catch {
      return true;
    }
  });

  const [disclaimerDismissed, setDisclaimerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(DISCLAIMER_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme === 'dark';
    } catch {
      // Fall through to the system preference.
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') runMigrations(window.localStorage);
    } catch {
      // Migrations are best-effort and idempotent.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    } catch {
      // Theme persistence is optional.
    }
  }, [darkMode]);

  useEffect(() => {
    let active = true;
    async function updateWeather() {
      const data = await fetchMedellinWeather();
      if (active) setWeather(data);
    }
    void updateWeather();
    const timer = window.setInterval(() => void updateWeather(), 600000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const lastMessage = document.querySelector('[role="log"] > :last-child');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lastMessage?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }, [messages]);

  const lastCueRef = useRef<typeof nav.cue>(null);
  useEffect(() => {
    if (nav.cue && nav.cue !== lastCueRef.current) {
      if (typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate([120, 60, 120]);
        } catch {
          // Haptics are optional.
        }
      }
      lastCueRef.current = nav.cue;
    }
  }, [nav.cue]);

  const handleStopNavigation = useCallback(() => {
    nav.stop();
    dispatchSurface({ type: 'END_NAVIGATION' });
  }, [dispatchSurface, nav.stop]);

  useEffect(() => {
    if (nav.state === 'arrived') {
      dispatchSurface({ type: 'END_NAVIGATION' });
      const timer = window.setTimeout(nav.stop, 6000);
      return () => window.clearTimeout(timer);
    }
    if (surface === 'navigation' && nav.state === 'idle' && nav.error) {
      dispatchSurface({ type: 'END_NAVIGATION' });
    }
    return undefined;
  }, [dispatchSurface, nav.error, nav.state, nav.stop, surface]);

  useEffect(() => {
    const previousSurface = previousSurfaceRef.current;
    previousSurfaceRef.current = surface;
    const frame = window.requestAnimationFrame(() => {
      if (surface === 'planning') {
        const field = origin ? 'Destino' : 'Origen';
        document.querySelector<HTMLInputElement>(`input[aria-label="${field}"]`)?.focus();
      } else if (surface === 'assistant') {
        document.querySelector<HTMLInputElement>('#assistant-query')?.focus();
      } else if (surface === 'explore' && previousSurface !== 'explore' && mapSelectionMode === null) {
        const selector = lastExploreActionRef.current === 'assistant'
          ? '[aria-label="Pregúntale a MetroBot"]'
          : '[aria-label="Planear un viaje"]';
        document.querySelector<HTMLButtonElement>(selector)?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mapSelectionMode, origin, surface]);

  const setBusPreference = useCallback((enabled: boolean) => {
    setBusesEnabled(enabled);
    try {
      localStorage.setItem(BUSES_TOGGLE_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      // Preference persistence is optional.
    }
  }, []);

  const dismissDisclaimer = () => {
    setDisclaimerDismissed(true);
    try {
      localStorage.setItem(DISCLAIMER_STORAGE_KEY, '1');
    } catch {
      // Dismissal persistence is optional.
    }
  };

  const openPlanning = () => {
    lastExploreActionRef.current = 'planning';
    setMapSelectionMode(null);
    dispatchSurface({ type: 'OPEN_PLANNING' });
  };

  const openAssistant = () => {
    lastExploreActionRef.current = 'assistant';
    setMapSelectionMode(null);
    dispatchSurface({ type: 'OPEN_ASSISTANT' });
  };

  const closeSurface = () => {
    setMapSelectionMode(null);
    dispatchSurface({ type: 'CLOSE' });
  };

  const handleSubmit = async (event: React.FormEvent | null) => {
    event?.preventDefault();
    if (!query.trim()) return;
    const admission = admitAssistantRequest(appRequestRef.current);
    if (!admission.request) return;
    appRequestRef.current = admission.state;
    const request = admission.request;
    const text = query;
    setQuery('');
    setMessages(current => [...current, { role: 'user', content: text }]);
    setIsLoading(true);
    try {
      let suggestedRoute = false;
      const response = await withDeadline(processUserQuery(text, () => {
        suggestedRoute = true;
      }, () => {}, { allowBuses: busesEnabled }));
      if (appRequestRef.current.activeRequest?.id !== request.id) return;
      // The assistant can explain transport, but cannot publish invented itineraries.
      setMessages(current => [...current, { role: 'assistant', content: suggestedRoute
        ? 'Para consultar recorridos de Google Maps, abre “Planear un viaje”, elige origen y destino y pulsa “Ver rutas”. El asistente no sustituye al planificador de rutas.'
        : response }]);
    } catch {
      setMessages(current => [...current, { role: 'assistant', content: 'No pudimos completar la consulta. Puedes intentarlo nuevamente.' }]);
    } finally {
      appRequestRef.current = completeAppRequest(appRequestRef.current, request.id);
      setIsLoading(false);
    }
  };

  const handleSearchRoute = (
    searchOrigin: PlaceValue,
    searchDest: PlaceValue,
  ) => {
    const admission = admitRouteRequest(appRequestRef.current, { origin: searchOrigin, destination: searchDest });
    if (!admission.request || admission.request.kind !== 'route') return false;
    const request = admission.request;
    appRequestRef.current = admission.state;
    const acceptedOrigin = request.endpoints.origin;
    const acceptedDest = request.endpoints.destination;
    setOrigin(acceptedOrigin);
    setDest(acceptedDest);
    nav.stop();
    setIsLoading(true);
    setRoutes([]);
    setPendingRoutes([]);
    setHonestyAssessment(null);
    setRouteError(null);
    setProviderNotice('');
    setActiveRouteIndex(0);
    dispatchSurface({ type: 'REQUEST_ROUTES' });
    void (async () => {
      try {
        const result = await withDeadline(planTransit(acceptedOrigin, acceptedDest, {
          google: () => requestGoogleRoutes(acceptedOrigin, acceptedDest),
          local: async () => {
            const { getLocalOfflineRoute } = await import('./lib/localRouter');
            return getLocalOfflineRoute(acceptedOrigin.lat, acceptedOrigin.lng, acceptedDest.lat, acceptedDest.lng);
          },
        }));
        if (appRequestRef.current.activeRequest?.id !== request.id) return;
        setProviderNotice(result.notice);
        if (!result.routes.length) {
          setRouteError(result.notice + ' No encontramos una alternativa local. Cambia los puntos o inténtalo más tarde.');
          dispatchSurface({ type: 'ROUTES_FAILED' });
          return;
        }
        if (result.routes[0].source === 'local') {
          const assessment = computeHonestyAssessment(result.routes as never);
          // Local graph estimates are not independently verified live schedules.
          setHonestyAssessment(assessment.level === 'confiable' ? null : assessment);
          if (assessment.level === 'unsafe') {
            setRouteError(result.notice + ' El respaldo no ofrece un recorrido seguro para estos puntos.');
            dispatchSurface({ type: 'ROUTES_FAILED' });
            return;
          }
          if (assessment.level === 'no_verificada') setPendingRoutes(result.routes);
          else setRoutes(result.routes);
        } else setRoutes(result.routes);
        dispatchSurface({ type: 'ROUTES_READY' });
      } catch {
        if (appRequestRef.current.activeRequest?.id !== request.id) return;
        setRouteError('No se pudo completar Google ni el respaldo local. Conservamos tus puntos para reintentar.');
        dispatchSurface({ type: 'ROUTES_FAILED' });
      } finally {
        if (appRequestRef.current.activeRequest?.id === request.id) {
          appRequestRef.current = completeAppRequest(appRequestRef.current, request.id);
          setIsLoading(false);
        }
      }
    })();
    return true;
  };

  const handlePlannerSubmit = () => {
    if (!origin || !dest) return;
    handleSearchRoute(origin, dest);
  };

  const handleMapPlaceSelected = (mode: PlannerField, place: PlaceValue) => {
    if (mode === 'origin') setOrigin(place);
    else setDest(place);
    setMapSelectionMode(null);
    dispatchSurface({ type: 'OPEN_PLANNING' });
  };

  const handleStartNav = useCallback((route: RouteOption) => {
    if (!origin || !dest) {
      alert('Marca origen y destino en el mapa antes de iniciar la navegación.');
      return;
    }
    dispatchSurface({ type: 'START_NAVIGATION' });
    void nav.start(route);
  }, [dest, dispatchSurface, nav.start, origin]);

  const handleClearRoute = () => {
    const activeRequest = appRequestRef.current.activeRequest;
    if (activeRequest?.kind === 'route') {
      appRequestRef.current = completeAppRequest(appRequestRef.current, activeRequest.id);
      setIsLoading(false);
    }
    setProviderNotice('');
    setRoutes([]);
    setPendingRoutes([]);
    setHonestyAssessment(null);
    setRouteError(null);
    setOrigin(null);
    setDest(null);
    setMapSelectionMode(null);
    handleStopNavigation();
  };

  const handlePresentationChange = (nextPresentation: SheetPresentation) => {
    if (nextPresentation === 'compact') {
      closeSurface();
    } else if (surface === 'explore') {
      openPlanning();
    }
  };

  const navFollow = nav.state === 'navigating' || nav.state === 'at_station' || nav.state === 'locating';
  const navigationContext = { ...nav, stop: handleStopNavigation };
  const hasAvailableRoutes = routes.length > 0 || pendingRoutes.length > 0;
  const showWeatherNotice = weather?.isRaining && surface !== 'assistant' && surface !== 'navigation';

  return (
    <>
      <SkipLink />
      <div
        id="map-region-wrapper"
        className={`mobile-app-shell mobile-surface-${surface} relative flex w-full flex-col overflow-hidden bg-background font-sans text-foreground transition-colors duration-300 lg:flex-row`}
      >
        <div id="map-region" className="absolute inset-0 z-0 h-full lg:relative lg:flex-1">
          {routes[activeRouteIndex]?.source === 'google' ? (
            <GoogleTransitMap route={routes[activeRouteIndex]} onClear={handleClearRoute}
              bottomInset={presentation === 'medium' ? 'min(68dvh, 640px)' : '112px'}
              panelExpanded={presentation === 'expanded'}
              mapSelectionMode={mapSelectionMode} onMapPlaceSelected={handleMapPlaceSelected} />
          ) : <MapComponent
            onSearchRoute={handleSearchRoute}
            origin={origin}
            dest={dest}
            routes={routes}
            activeRouteIndex={activeRouteIndex}
            onOriginSelect={(coords) => setOrigin(coords ? {
              lat: coords.lat,
              lng: coords.lng,
              name: coords.name || 'Origen seleccionado',
            } : null)}
            onDestSelect={(coords) => setDest(coords ? {
              lat: coords.lat,
              lng: coords.lng,
              name: coords.name || 'Destino seleccionado',
            } : null)}
            darkMode={darkMode}
            onClearRoute={handleClearRoute}
            onThemeToggle={() => setDarkMode((current) => !current)}
            userPosition={nav.pos}
            userHeading={nav.heading}
            followUser={navFollow}
            isNavigating={navFollow}
            mapSelectionMode={mapSelectionMode}
            onMapPlaceSelected={handleMapPlaceSelected}
          />}
          <NavigationOverlay nav={navigationContext} />
          {shouldShowPersistentSupport(surface) && (
            <div className="pointer-events-none absolute bottom-6 left-6 z-[1000] hidden lg:block">
              <SupportCard />
            </div>
          )}
        </div>

        {surface === 'explore' ? (
          <MobileExploreSurface
            mapSelectionMode={mapSelectionMode}
            hasAvailableRoutes={hasAvailableRoutes}
            weather={weather}
            quickPicks={(
              <QuickPicksBar
                hidden={mapSelectionMode !== null}
                onPickFavorite={(favorite) => {
                  setDest({ lat: favorite.lat, lng: favorite.lng, name: favorite.name });
                  openPlanning();
                }}
              />
            )}
            onPlanTrip={openPlanning}
            onAskMetroBot={openAssistant}
            onShowResults={() => dispatchSurface({ type: 'SHOW_RESULTS' })}
            onPresentationChange={handlePresentationChange}
          />
        ) : (
          <MobileBottomSheet
            presentation={presentation}
            title={surfaceTitles[surface]}
            titleVisuallyHidden={surface === 'assistant'}
            resizable={isSheetResizable(surface)}
            onPresentationChange={handlePresentationChange}
          >
          {showWeatherNotice && (
            <div className="my-3 flex items-center gap-3 rounded-xl border border-sitva-blue/30 bg-sitva-blue/10 p-3" role="status">
              <CloudRain className="h-5 w-5 shrink-0 text-sitva-blue" aria-hidden="true" />
              <p className="text-xs leading-snug text-foreground">
                Se reporta lluvia en Medellín. Compara los minutos a pie y lleva protección para la lluvia.
              </p>
            </div>
          )}

          {(surface === 'planning' || surface === 'loading') && (
            <div className="pb-2">
              {routeError && (
                <div className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
                  {routeError}
                </div>
              )}
              {surface === 'loading' && (
                <p className="px-4 pt-3 text-sm font-semibold text-sitva-blue" role="status">
                  Calculando opciones de ruta…
                </p>
              )}
              <TripPlannerPanel
                origin={origin}
                destination={dest}
                busesEnabled={busesEnabled}
                isLoading={isLoading}
                onOriginChange={setOrigin}
                onDestinationChange={setDest}
                onBusesEnabledChange={setBusPreference}
                onRequestMapSelection={(mode) => {
                  setMapSelectionMode(mode);
                  dispatchSurface({ type: 'CLOSE' });
                }}
                onSubmit={handlePlannerSubmit}
                onClose={closeSurface}
              />
            </div>
          )}

          {surface === 'results' && (
            <section aria-label="Resultados de rutas" className="space-y-3 pb-4 pt-2">
              {providerNotice && <p role="status" className="rounded-xl border border-border bg-card p-3 text-sm">{providerNotice}</p>}
              <p className="text-xs text-muted-foreground"><a className="underline" href="/terms.html" target="_blank" rel="noreferrer">Condiciones de uso</a> · <a className="underline" href="/privacy.html" target="_blank" rel="noreferrer">Privacidad</a></p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Rutas sugeridas</h3>
                  {honestyAssessment && (
                    <HonestyBadge
                      level={honestyAssessment.level}
                      worstRatio={honestyAssessment.worstRatio}
                      label={honestyAssessment.label}
                    />
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Cerrar resultados"
                  onClick={closeSurface}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {pendingRoutes.length > 0 && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
                  <p>No se pudieron verificar todas las paradas de bus de estas rutas.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setRoutes(pendingRoutes);
                      setPendingRoutes([]);
                    }}
                    className="mt-2 min-h-11 rounded-xl bg-rose-700 px-4 font-semibold text-white"
                  >
                    Ver de todos modos
                  </button>
                </div>
              )}

              {routes.length > 0 && routes[0].source !== 'google' && !disclaimerDismissed && (
                <div className="relative rounded-xl border border-amber-200 bg-amber-50 p-3 pr-12 text-xs leading-snug text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="status">
                  Las rutas son candidatas calculadas con tus coordenadas y datos del SITVA. Revisa cualquier tramo sin validar antes de abordar.
                  <button
                    type="button"
                    aria-label="Entendido"
                    onClick={dismissDisclaimer}
                    className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full hover:bg-amber-200/60 dark:hover:bg-amber-900/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {routes.length > 0 && (
                <RouteComparison
                  routes={routes}
                  activeRouteIndex={activeRouteIndex}
                  originName={origin?.name}
                  destName={dest?.name}
                  onSelect={setActiveRouteIndex}
                  onEdit={openPlanning}
                  onStartNav={handleStartNav}
                  navState={nav.state}
                />
              )}
            </section>
          )}

          {surface === 'assistant' && (
            <AssistantPanel
              messages={messages}
              query={query}
              isLoading={isLoading}
              showSupport={showSupport}
              onQueryChange={setQuery}
              onSubmit={() => void handleSubmit(null)}
              onToggleSupport={() => setShowSupport((current) => !current)}
              onClose={closeSurface}
            />
          )}

          {surface === 'navigation' && (
            <section aria-live="polite" className="flex items-center justify-between gap-3 pb-3 text-sm">
              <p className="min-w-0 truncate font-semibold">
                {nav.state === 'locating' ? 'Buscando tu ubicación…' : nav.cue?.instruction || 'Navegación activa'}
              </p>
              <button
                type="button"
                onClick={handleStopNavigation}
                className="min-h-11 shrink-0 rounded-xl bg-red-600 px-4 font-bold text-white"
              >
                Finalizar navegación
              </button>
            </section>
          )}
          </MobileBottomSheet>
        )}

        <InstallBanner />
        <UpdateToast />
      </div>
    </>
  );
}
