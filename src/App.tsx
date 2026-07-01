import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapComponent } from './components/Map/MapComponent';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Send, Menu, MessageSquare, AlertCircle, Sun, Moon, HelpCircle, X, Info } from 'lucide-react';
import { processUserQuery } from './lib/gemini';
import { RouteOption } from './lib/routing';
import { RouteCard } from './components/RouteCards/RouteCard';
import { SupportCard } from './components/SupportCard';
import { SupportChannels } from './components/SupportChannels';
import { TariffInfo } from './components/TariffInfo';
import { SystemStatus } from './components/SystemStatus';
import { CloudRain, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavigationOverlay } from './components/Map/NavigationOverlay';
import { useNavigation } from './hooks/useNavigation';
import { useRecentSearches } from './hooks/useRecentSearches';
import { QuickPicksBar } from './components/QuickPicksBar';
import { InstallBanner } from './components/InstallBanner';
import { UpdateToast } from './components/UpdateToast';
import { HonestyBadge } from './components/HonestyBadge';
import { computeHonestyAssessment } from './lib/honesty';
import { useSheetDrag } from './hooks/useSheetDrag';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { SkipLink } from './components/SkipLink';

import { fetchMedellinWeather, WeatherData } from './lib/weather';

const DISCLAIMER_STORAGE_KEY = 'metrobot.disclaimer.dismissed.v1';

export default function App() {
  const [query, setQuery] = useState('');
  const sheetHandleRef = useRef<HTMLButtonElement>(null);
  const sheet = useSheetDrag(sheetHandleRef, [72, 320, 720], 1);
  const reducedMotion = usePrefersReducedMotion();
  const sheetHeightClass = sheet.currentSnap === 0 ? 'h-[72px]' : sheet.currentSnap === 1 ? 'h-[min(58dvh,560px)]' : 'h-[92dvh]';
  const [honestyAssessment, setHonestyAssessment] = useState<ReturnType<typeof computeHonestyAssessment> | null>(null);
  const [pendingRoutes, setPendingRoutes] = useState<RouteOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Que mas! Soy MetroBot. A donde quieres ir hoy en Medellin? Tambien puedes tocar el mapa para marcar tu Punto de Inicio y Destino.' }
  ]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [sheetHeight, setSheetHeight] = useState<'min' | 'mid' | 'max'>('mid');

  const [disclaimerDismissed, setDisclaimerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return localStorage.getItem(DISCLAIMER_STORAGE_KEY) === '1'; } catch (e) { return false; }
  });
  const dismissDisclaimer = () => {
    setDisclaimerDismissed(true);
    try { localStorage.setItem(DISCLAIMER_STORAGE_KEY, '1'); } catch (e) {}
  };

  const [origin, setOrigin] = useState<{lat: number, lng: number, name?: string} | null>(null);
  const [dest, setDest] = useState<{lat: number, lng: number, name?: string} | null>(null);

  // ----- Hooks ---------------------------------------------------------------
  const nav = useNavigation();
  const { push: pushRecent } = useRecentSearches();

  // Haptic on cue change
  const lastCueRef = useRef<typeof nav.cue>(null);
  useEffect(() => {
    if (nav.cue && nav.cue !== lastCueRef.current) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([120, 60, 120]); } catch (e) {}
      }
      lastCueRef.current = nav.cue;
    }
  }, [nav.cue]);

  // Auto-stop navigation after arriving
  useEffect(() => {
    if (nav.state === 'arrived') {
      const id = window.setTimeout(() => nav.stop(), 6000);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [nav.state, nav]);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    async function updateWeather() {
      const data = await fetchMedellinWeather();
      setWeather(data);
    }
    updateWeather();
    const timer = setInterval(updateWeather, 600000);
    return () => clearInterval(timer);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, routes, scrollToBottom]);

  const handleStartNav = useCallback((route: RouteOption) => {
    if (!route) return;
    if (!origin || !dest) {
      alert('Marca origen y destino en el mapa antes de iniciar la navegacion.');
      return;
    }
    // Expand the sheet so the NavigationOverlay is visible.
    setSheetHeight('min');
    void nav.start(route);
  }, [nav, origin, dest]);

  const handleSubmit = async (e: React.FormEvent | null, customQuery?: string, visualMessage?: string, contextCoords?: { origin?: {lat: number, lng: number}, dest?: {lat: number, lng: number} }) => {
    if (e) e.preventDefault();
    const textToProcess = customQuery || query;
    if (!textToProcess.trim() || isLoading) return;

    if (!customQuery) setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: visualMessage || textToProcess }]);
    setIsLoading(true);
    setRoutes([]);
    setActiveRouteIndex(0);
    setSheetHeight('mid');

    // Remember this query in the recent-searches MRU.
    pushRecent(textToProcess, contextCoords ? { coords: contextCoords.origin || contextCoords.dest } : undefined);

    const response = await processUserQuery(
      textToProcess,
      (newRoutes) => {
        const assessment = computeHonestyAssessment(newRoutes as any);
        setHonestyAssessment(assessment);
        if (assessment.level === 'no_verificada') {
          setPendingRoutes(newRoutes);
          setRoutes([]);
          const msg = 'No pude verificar ' + assessment.totalDegraded + ' parada(s) de bus en este recorrido. ' + 'Te recomiendo caminar o usar la opcion "Ver de todos modos" para revisar la ruta igual.';
          setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
          return;
        }
        setRoutes(newRoutes);
        if (newRoutes.length > 0) {
          if (!contextCoords?.origin && newRoutes[0].userOrigin) {
            setOrigin({lat: newRoutes[0].userOrigin.lat, lng: newRoutes[0].userOrigin.lng, name: newRoutes[0].userOrigin.name});
          }
          if (!contextCoords?.dest && newRoutes[0].userDest) {
            setDest({lat: newRoutes[0].userDest.lat, lng: newRoutes[0].userDest.lng, name: newRoutes[0].userDest.name});
          }
        }
      },
      (status) => console.log("Status:", status),
      {
        origin: contextCoords?.origin || (origin ? {lat: origin.lat, lng: origin.lng} : undefined),
        dest: contextCoords?.dest || (dest ? {lat: dest.lat, lng: dest.lng} : undefined)
      }
    );

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsLoading(false);
  };

  const handleSearchRoute = (
    searchOrigin: {lat: number, lng: number, name: string},
    searchDest: {lat: number, lng: number, name: string}
  ) => {
    setOrigin({lat: searchOrigin.lat, lng: searchOrigin.lng, name: searchOrigin.name});
    setDest({lat: searchDest.lat, lng: searchDest.lng, name: searchDest.name});
    setSheetHeight('mid');
    const originText = searchOrigin.name.split(',')[0];
    const destText = searchDest.name.split(',')[0];
    const finalMessage = 'Busca la mejor ruta en SITVA para ir de "' + originText + '" a "' + destText + '". (LAT ' + searchOrigin.lat + ', LNG ' + searchOrigin.lng + ' a LAT ' + searchDest.lat + ', LNG ' + searchDest.lng + '). Busca estaciones de SITVA y ENCICLA cercanas y dame la ruta. REGLA MUY IMPORTANTE: Usa EXACTAMENTE los nombres y lineas de las estaciones como aparecen en los DATOS DE ESTACIONES provistos. NUNCA inventes nombres, sistemas, o lineas. Por ejemplo, "Doce de Octubre" es Metrocable Linea P, NO Metroplus. Si la estacion es de EnCicla, llamala "EnCicla - [Nombre]". El mensaje para el usuario no debe contener coordenadas.';
    handleSubmit(null, finalMessage, 'Ruta desde ' + originText + ' hasta ' + destText, {
      origin: { lat: searchOrigin.lat, lng: searchOrigin.lng },
      dest: { lat: searchDest.lat, lng: searchDest.lng }
    });
  };

  const handleDragHandleClick = () => {
    setSheetHeight(prev => {
      if (prev === 'min') return 'mid';
      if (prev === 'mid') return 'max';
      return 'min';
    });
  };

  const heightClasses = {
    min: 'h-[72px]',
    mid: 'h-[58dvh]',
    max: 'h-[92dvh]'
  };

  const SNAP_POINTS: Record<'min' | 'mid' | 'max', number> = {
    min: 0.18,
    mid: 0.58,
    max: 0.92,
  };
  const [draggingFrac, setDraggingFrac] = useState<number | null>(null);
  const sheetDragRef = useRef<{
    startY: number;
    startSnap: number;
    moved: boolean;
  } | null>(null);

  const nearestSnap = (frac: number): 'min' | 'mid' | 'max' => {
    let best: 'min' | 'mid' | 'max' = 'mid';
    let bestDiff = Math.abs(frac - SNAP_POINTS.mid);
    if (Math.abs(frac - SNAP_POINTS.min) < bestDiff) { best = 'min'; bestDiff = Math.abs(frac - SNAP_POINTS.min); }
    if (Math.abs(frac - SNAP_POINTS.max) < bestDiff) { best = 'max'; }
    return best;
  };

  const onHandleTouchStart = (e: React.TouchEvent) => {
    sheetDragRef.current = {
      startY: e.touches[0].clientY,
      startSnap: SNAP_POINTS[sheetHeight],
      moved: false,
    };
  };

  const onHandleTouchMove = (e: React.TouchEvent) => {
    const drag = sheetDragRef.current;
    if (!drag) return;
    const dy = e.touches[0].clientY - drag.startY;
    if (Math.abs(dy) > 6) drag.moved = true;
    const vh = window.innerHeight || 1;
    const liveFrac = Math.min(0.96, Math.max(0.10, drag.startSnap - dy / vh));
    setDraggingFrac(liveFrac);
  };

  const onHandleTouchEnd = () => {
    const drag = sheetDragRef.current;
    sheetDragRef.current = null;
    if (!drag || !drag.moved) {
      setDraggingFrac(null);
      return;
    }
    const frac = draggingFrac ?? SNAP_POINTS[sheetHeight];
    setDraggingFrac(null);
    setSheetHeight(nearestSnap(frac));
  };

  const navFollow = nav.state === 'navigating' || nav.state === 'at_station' || nav.state === 'locating';

  return (
    <>
      <SkipLink />
    <div id="map-region-wrapper" className="relative w-full h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col lg:flex-row font-sans transition-colors duration-300">
      <div id="map-region" className="absolute inset-0 z-0 lg:relative lg:flex-1 h-full">
        <MapComponent
          onSearchRoute={handleSearchRoute}
          origin={origin}
          dest={dest}
          routes={routes}
          activeRouteIndex={activeRouteIndex}
          onOriginSelect={(coords) => setOrigin(coords ? {lat: coords.lat, lng: coords.lng, name: coords.name} : null)}
          onDestSelect={(coords) => setDest(coords ? {lat: coords.lat, lng: coords.lng, name: coords.name} : null)}
          darkMode={darkMode}
          onClearRoute={() => {
            setRoutes([]);
            setOrigin(null);
            setDest(null);
            nav.stop();
          }}
          onThemeToggle={() => setDarkMode(!darkMode)}
          userPosition={nav.pos}
          userHeading={nav.heading}
          followUser={navFollow}
        />
        <NavigationOverlay nav={nav} />
        <QuickPicksBar
          onPickFavorite={(fav) => {
            // Drop the favorite into the origin input and let the user pick a destination.
            setOrigin({ lat: fav.lat, lng: fav.lng, name: fav.name });
          }}
          onPickRecent={(entry) => {
            if (entry.coords) {
              setOrigin({ lat: entry.coords.lat, lng: entry.coords.lng, name: entry.query });
            } else {
              setQuery(entry.query);
              void handleSubmit(null, entry.query, 'Repitiendo busqueda reciente');
            }
          }}
        />
        <div className="hidden lg:block absolute bottom-6 left-6 z-[1000] pointer-events-none">
          <SupportCard />
        </div>
      </div>

      <div
        id="app-bottom-sheet"
        className={'absolute bottom-0 left-0 right-0 z-20 flex flex-col bg-card border-t border-border/30 lg:border-t-0 lg:border-l lg:border-sidebar-border transition-all ease-in-out lg:relative lg:w-[28rem] lg:h-full lg:rounded-none lg:shadow-xl ' + heightClasses[sheetHeight] + ' lg:h-full overflow-hidden pb-[env(safe-area-inset-bottom)] ' + (draggingFrac === null ? 'duration-300' : 'duration-0')}
        style={draggingFrac !== null ? { height: 'calc(' + draggingFrac + ' * 100dvh)' } : undefined}
      >
        <div
          className="w-full flex flex-col items-center justify-start pt-3 pb-4 cursor-pointer shrink-0 lg:hidden z-30 select-none hover:bg-slate-100/40 dark:hover:bg-slate-800/10 transition-colors touch-none"
          style={{ minHeight: '48px' }}
          onClick={handleDragHandleClick}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <button
          ref={sheetHandleRef}
          type="button"
          aria-label="Arrastrar para ajustar el panel"
          aria-controls="chat-sheet"
          aria-expanded={sheet.currentSnap > 0}
          onPointerDown={sheet.onPointerDown}
          onPointerMove={sheet.onPointerMove}
          onPointerUp={sheet.onPointerUp}
          onPointerCancel={sheet.onPointerCancel}
          className="cursor-grab active:cursor-grabbing w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mb-1.5 touch-none focus:outline-none focus:ring-2 focus:ring-sitva-green/50"
        />
          {sheetHeight === 'min' && <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">{routes.length > 0 ? 'Ver rutas y chat' : 'Toca para abrir MetroBot'}</span>}
          {sheetHeight === 'mid' && <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">Expandir Chat</span>}
          {sheetHeight === 'max' && <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">Minimizar Chat</span>}
        </div>

        <div className="px-3 sm:px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/30 shrink-0 gap-2">
          <div className="flex items-center min-w-0 gap-2">
            <div className="w-8 h-8 rounded-full bg-sitva-green/10 flex items-center justify-center shrink-0">
              <img src="/logo_chat.png" alt="MetroBot" className="w-7 h-7 rounded-full object-cover" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">MetroBot</h2>
              <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 leading-tight truncate hidden xs:block">Asistente SITVA</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ayuda"
              className={'rounded-full min-h-[44px] min-w-[44px] w-11 h-11 transition-colors ' + (showSupport ? 'text-sitva-green bg-sitva-green/10' : 'text-foreground hover:bg-slate-100 dark:hover:bg-slate-800') + ' cursor-pointer'}
              onClick={() => {
                setShowSupport(!showSupport);
                if (!showSupport) setSheetHeight('mid');
              }}
            >
              <HelpCircle className="w-6 h-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Tema"
              className="rounded-full min-h-[44px] min-w-[44px] w-11 h-11 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="w-6 h-6 text-amber-500" /> : <Moon className="w-6 h-6 text-slate-700" />}
            </Button>
          </div>
        </div>

        <div className={'flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-background custom-scrollbar ' + (sheetHeight === 'min' ? 'hidden lg:block' : 'block')}>
          <AnimatePresence>
            {weather?.isRaining && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-sitva-blue/10 dark:bg-sitva-blue/20 border border-sitva-blue/30 rounded-xl flex items-center gap-3 mb-2"
              >
                <div className="p-2 bg-sitva-blue/20 dark:bg-sitva-blue/40 rounded-full text-sitva-blue shrink-0">
                  <CloudRain className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-sitva-blue uppercase tracking-wider">Alerta de Lluvia</h4>
                  <p className="text-[11px] text-foreground/80 leading-tight">Actualmente llueve en Medellin. Metrocables podrian operar con intermitencia.</p>
                </div>
              </motion.div>
            )}

            {showSupport && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <SupportChannels />
                <TariffInfo />
                <SystemStatus />
              </motion.div>
            )}
          </AnimatePresence>

          {routes.length > 0 && !disclaimerDismissed && (
            <div className="relative p-3 sm:p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 rounded-xl flex items-start gap-2 sm:gap-3 pr-9" role="status">
              <div className="text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase tracking-wider shrink-0 mt-0.5">Aviso</div>
              <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 leading-snug">
                Las rutas mostradas son candidatas calculadas con tus coordenadas y los datos oficiales del SITVA. Cuando veas la insignia <span className="font-bold text-emerald-700 dark:text-emerald-400">validado</span>, cada bus integrado fue verificado contra nuestro catalogo. <span className="font-bold text-amber-700 dark:text-amber-400">sin validar</span> significa que la IA no pudo verificar un tramo; revisa el mapa antes de abordar.
              </p>
              <button
                type="button"
                aria-label="Entendido"
                onClick={dismissDisclaimer}
                className="absolute top-2 right-2 min-h-[32px] min-w-[32px] w-8 h-8 rounded-full text-amber-700 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-900/40 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="space-y-3 sm:space-y-4 mb-2">
            {messages.map((msg, idx) => (
              <div key={idx} className={'flex ' + (msg.role === 'user' ? 'justify-end' : 'justify-start items-end space-x-2')}>
                {msg.role === 'assistant' && (
                  <img src="/logo_chat.png" alt="MetroBot" className="w-8 h-8 rounded-full shadow-sm object-cover shrink-0 bg-white dark:bg-slate-850" />
                )}
                <div className={'max-w-[88%] sm:max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ' + (msg.role === 'user' ? 'bg-chat-bubble-user text-chat-bubble-user-text rounded-br-sm' : 'bg-chat-bubble-assistant text-chat-bubble-assistant-text rounded-bl-sm')}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start items-end space-x-2">
                <img src="/logo_chat.png" alt="MetroBot" className="w-8 h-8 rounded-full shadow-sm object-cover shrink-0 bg-white dark:bg-slate-850" />
                <div className="bg-chat-bubble-assistant text-chat-bubble-assistant-text rounded-2xl rounded-bl-sm px-3.5 py-3 flex space-x-1 h-[44px] items-center shadow-sm">
                  <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <AnimatePresence>
            {routes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-3 sm:space-y-4 mt-2"
              >
                <div className="flex items-center gap-2 flex-wrap px-1">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rutas Sugeridas</h3>
            {honestyAssessment && <HonestyBadge level={honestyAssessment.level} worstRatio={honestyAssessment.worstRatio} label={honestyAssessment.label} />}
            {pendingRoutes.length > 0 && (
              <button
                type="button"
                onClick={() => { setRoutes(pendingRoutes); setPendingRoutes([]); }}
                className="text-[11px] font-semibold rounded-full bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-200 px-2.5 py-1 cursor-pointer"
                aria-label="Ver rutas aunque no se pudieron verificar"
              >
                Ver de todos modos
              </button>
            )}
          </div>
                {routes.map((route, idx) => (
                  <div key={route.id} onClick={() => setActiveRouteIndex(idx)} className="cursor-pointer">
                    <RouteCard
                      route={route}
                      isSelected={activeRouteIndex === idx}
                      originName={origin?.name ?? null}
                      destName={dest?.name ?? null}
                      onStartNav={handleStartNav}
                      navState={nav.state}
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form onSubmit={handleSubmit} className="p-2.5 sm:p-3 bg-card border-t border-border/30 shrink-0">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Preguntale a MetroBot..."
              className="flex-1 h-12 rounded-full bg-muted/30 border-border/30 focus-visible:ring-sitva-green/30 text-base sm:text-sm"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar"
              className="rounded-full min-h-[48px] min-w-[48px] w-12 h-12 bg-sitva-green hover:bg-sitva-green/90 text-white shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !query.trim()}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </div>
      <InstallBanner />
      <UpdateToast />
    </div>
    </>
  );
}
