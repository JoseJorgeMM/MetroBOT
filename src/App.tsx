import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloudRain, X } from 'lucide-react';
import { AssistantPanel } from './components/AssistantPanel';
import { HonestyBadge } from './components/HonestyBadge';
import { InstallBanner } from './components/InstallBanner';
import { MapComponent } from './components/Map/MapComponent';
import { NavigationOverlay } from './components/Map/NavigationOverlay';
import { MobileBottomSheet } from './components/MobileBottomSheet';
import { MobileExploreSurface } from './components/MobileExploreSurface';
import { QuickPicksBar } from './components/QuickPicksBar';
import { RouteCard } from './components/RouteCards/RouteCard';
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
  assistantResponseForOutcome,
  completeAppRequest,
  createAppRequestState,
  type AppRequest,
  type RouteOutcome,
} from './lib/appRouteFlow';
import {
  isSheetResizable,
  shouldShowPersistentSupport,
  type SheetPresentation,
} from './lib/mobileSurface';
import type { RouteOption } from './lib/routing';
import { fetchMedellinWeather, type WeatherData } from './lib/weather';

const DISCLAIMER_STORAGE_KEY = 'metrobot.disclaimer.dismissed.v1';
const BUSES_TOGGLE_STORAGE_KEY = 'metrobot.buses.enabled.v1';

type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type QueryContext = {
  origin?: { lat: number; lng: number };
  dest?: { lat: number; lng: number };
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

  const handleSubmit = async (
    event: React.FormEvent | null,
    customQuery?: string,
    visualMessage?: string,
    contextCoords?: QueryContext,
    acceptedRequest?: AppRequest,
  ) => {
    event?.preventDefault();
    const textToProcess = customQuery || query;
    if (!textToProcess.trim()) return;

    let request = acceptedRequest;
    if (!request) {
      const admission = admitAssistantRequest(appRequestRef.current);
      if (!admission.request) return;
      appRequestRef.current = admission.state;
      request = admission.request;
    }

    const isRouteRequest = request.kind === 'route';
    const requestContext: QueryContext = request.kind === 'route'
      ? {
          origin: { lat: request.endpoints.origin.lat, lng: request.endpoints.origin.lng },
          dest: { lat: request.endpoints.destination.lat, lng: request.endpoints.destination.lng },
        }
      : (contextCoords || {});
    let routeOutcome: RouteOutcome = 'none';
    if (!customQuery) setQuery('');
    setMessages((current) => [...current, { role: 'user', content: visualMessage || textToProcess }]);
    setIsLoading(true);
    setRouteError(null);
    setRoutes([]);
    setPendingRoutes([]);
    setHonestyAssessment(null);
    setActiveRouteIndex(0);
    if (isRouteRequest) dispatchSurface({ type: 'REQUEST_ROUTES' });

    try {
      const response = await processUserQuery(
        textToProcess,
        (newRoutes: RouteOption[]) => {
          if (newRoutes.length === 0) {
            routeOutcome = 'failed';
            setRouteError('No se encontraron rutas para este trayecto. Conservamos el origen y el destino para que puedas intentarlo de nuevo.');
            dispatchSurface({ type: 'ROUTES_FAILED' });
            return;
          }

          const assessment = computeHonestyAssessment(newRoutes as never);
          setHonestyAssessment(assessment);
          if (assessment.level === 'unsafe') {
            routeOutcome = 'failed';
            setRoutes([]);
            setPendingRoutes([]);
            const message = 'No encontré rutas válidas para este trayecto. Intenta con un origen y un destino dentro de la red SITVA, o verifica los nombres de los lugares.';
            setRouteError(message);
            setMessages((current) => [...current, { role: 'assistant', content: message }]);
            dispatchSurface({ type: 'ROUTES_FAILED' });
            return;
          }

          routeOutcome = 'ready';
          if (assessment.level === 'no_verificada') {
            setPendingRoutes(newRoutes);
            setRoutes([]);
            const message = `No pude verificar ${assessment.totalDegraded} parada(s) de bus en este recorrido. Revisa la advertencia antes de elegir “Ver de todos modos”.`;
            setMessages((current) => [...current, { role: 'assistant', content: message }]);
          } else {
            setRoutes(newRoutes);
          }

          const firstRoute = newRoutes[0];
          if (!requestContext.origin && firstRoute.userOrigin) {
            setOrigin({
              lat: firstRoute.userOrigin.lat,
              lng: firstRoute.userOrigin.lng,
              name: firstRoute.userOrigin.name || 'Origen de la ruta',
            });
          }
          if (!requestContext.dest && firstRoute.userDest) {
            setDest({
              lat: firstRoute.userDest.lat,
              lng: firstRoute.userDest.lng,
              name: firstRoute.userDest.name || 'Destino de la ruta',
            });
          }
          dispatchSurface({ type: 'ROUTES_READY' });
        },
        (status: string) => console.log('Status:', status),
        {
          origin: requestContext.origin || (origin ? { lat: origin.lat, lng: origin.lng } : undefined),
          dest: requestContext.dest || (dest ? { lat: dest.lat, lng: dest.lng } : undefined),
          allowBuses: busesEnabled,
        },
      );

      if (isRouteRequest && routeOutcome === 'none') {
        routeOutcome = 'failed';
        setRouteError(response || 'No fue posible calcular rutas. Inténtalo de nuevo.');
        dispatchSurface({ type: 'ROUTES_FAILED' });
      }
      const publishedResponse = assistantResponseForOutcome(routeOutcome, response);
      if (publishedResponse) {
        setMessages((current) => [...current, { role: 'assistant', content: publishedResponse }]);
      }
    } catch (error) {
      console.error('Route or assistant request failed:', error);
      const message = 'MetroBot no está disponible temporalmente. Puedes seguir planeando el viaje manualmente.';
      setMessages((current) => [...current, { role: 'assistant', content: message }]);
      if (isRouteRequest) {
        setRouteError(message);
        dispatchSurface({ type: 'ROUTES_FAILED' });
      }
    } finally {
      appRequestRef.current = completeAppRequest(appRequestRef.current, request.id);
      setIsLoading(false);
    }
  };

  const handleSearchRoute = (
    searchOrigin: { lat: number; lng: number; name: string },
    searchDest: { lat: number; lng: number; name: string },
  ) => {
    const admission = admitRouteRequest(appRequestRef.current, {
      origin: searchOrigin,
      destination: searchDest,
    });
    if (!admission.request || admission.request.kind !== 'route') return false;
    appRequestRef.current = admission.state;

    const acceptedOrigin = admission.request.endpoints.origin;
    const acceptedDest = admission.request.endpoints.destination;
    setOrigin(acceptedOrigin);
    setDest(acceptedDest);
    const originText = acceptedOrigin.name.split(',')[0];
    const destText = acceptedDest.name.split(',')[0];
    const finalMessage = `Busca la mejor ruta en SITVA para ir de "${originText}" a "${destText}". (LAT ${acceptedOrigin.lat}, LNG ${acceptedOrigin.lng} a LAT ${acceptedDest.lat}, LNG ${acceptedDest.lng}). Busca estaciones de SITVA y ENCICLA cercanas y dame la ruta. REGLA MUY IMPORTANTE: Usa EXACTAMENTE los nombres y líneas de las estaciones como aparecen en los DATOS DE ESTACIONES provistos. NUNCA inventes nombres, sistemas, o líneas. Por ejemplo, "Doce de Octubre" es Metrocable Línea P, NO Metroplús. Si la estación es de EnCicla, llámala "EnCicla - [Nombre]". El mensaje para el usuario no debe contener coordenadas.`;
    void handleSubmit(null, finalMessage, `Ruta desde ${originText} hasta ${destText}`, {
      origin: { lat: acceptedOrigin.lat, lng: acceptedOrigin.lng },
      dest: { lat: acceptedDest.lat, lng: acceptedDest.lng },
    }, admission.request);
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
          <MapComponent
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
          />
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
            isRaining={Boolean(weather?.isRaining)}
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
                Llueve en Medellín. Los metrocables podrían operar con intermitencia.
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

              {routes.length > 0 && !disclaimerDismissed && (
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

              {routes.map((route, index) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={activeRouteIndex === index}
                  originName={origin?.name ?? null}
                  destName={dest?.name ?? null}
                  routeIndex={index}
                  onSelect={() => setActiveRouteIndex(index)}
                  onStartNav={handleStartNav}
                  navState={nav.state}
                />
              ))}
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
