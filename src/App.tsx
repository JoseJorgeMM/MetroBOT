import React, { useState, useRef, useEffect } from 'react';
import { MapComponent } from './components/Map/MapComponent';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Send, Menu, MessageSquare, AlertCircle, Sun, Moon, HelpCircle } from 'lucide-react';
import { processUserQuery } from './lib/gemini';
import { RouteOption } from './lib/routing';
import { RouteCard } from './components/RouteCards/RouteCard';
import { SupportCard } from './components/SupportCard';
import { SupportChannels } from './components/SupportChannels';
import { TariffInfo } from './components/TariffInfo';
import { SystemStatus } from './components/SystemStatus';
import { CloudRain, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { fetchMedellinWeather, WeatherData } from './lib/weather';

export default function App() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Que mas! Soy MetroBot. A donde quieres ir hoy en Medellin? Tambien puedes tocar el mapa para marcar tu Punto de Inicio y Destino.' }
  ]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [sheetHeight, setSheetHeight] = useState<'min' | 'mid' | 'max'>('mid');

  const [origin, setOrigin] = useState<{lat: number, lng: number, name?: string} | null>(null);
  const [dest, setDest] = useState<{lat: number, lng: number, name?: string} | null>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, routes]);

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

    const response = await processUserQuery(
      textToProcess,
      (newRoutes) => {
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
    min: 'h-20',
    mid: 'h-[45dvh]',
    max: 'h-[85dvh]'
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col md:flex-row font-sans transition-colors duration-300">
      <div className="absolute inset-0 z-0 md:relative md:flex-1 h-full">
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
          }}
          onThemeToggle={() => setDarkMode(!darkMode)}
        />
        <div className="hidden md:block absolute bottom-6 left-6 z-[1000] pointer-events-none">
          <SupportCard />
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 z-20 flex flex-col bg-card border-t border-border/30 md:border-t-0 md:border-l md:border-sidebar-border transition-all duration-300 ease-in-out md:relative md:w-96 md:h-full md:rounded-none md:shadow-xl ${heightClasses[sheetHeight]} md:h-full overflow-hidden`}>
        <div
          className="w-full h-8 flex flex-col items-center justify-start pt-2.5 cursor-pointer shrink-0 md:hidden z-30 select-none hover:bg-slate-100/40 dark:hover:bg-slate-800/10 transition-colors"
          onClick={handleDragHandleClick}
        >
          <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mb-1" />
          {sheetHeight === 'min' && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{routes.length > 0 ? 'Ver rutas y chat' : 'Toca para abrir MetroBot'}</span>}
          {sheetHeight === 'mid' && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Expandir Chat</span>}
          {sheetHeight === 'max' && <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Minimizar Chat</span>}
        </div>

        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-border/30 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-full bg-sitva-green/10 flex items-center justify-center">
              <img src="/logo_chat.png" alt="MetroBot" className="w-6 h-6 rounded-full object-cover" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground leading-tight">MetroBot</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Asistente SITVA</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full transition-colors ${showSupport ? 'text-sitva-green bg-sitva-green/10' : 'text-foreground hover:bg-slate-100 dark:hover:bg-slate-800'} cursor-pointer`}
              onClick={() => {
                setShowSupport(!showSupport);
                if (!showSupport) setSheetHeight('mid');
              }}
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
            <div className="hidden md:block">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                onClick={() => setDarkMode(!darkMode)}
              >
                {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-700" />}
              </Button>
            </div>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto p-4 space-y-4 bg-background custom-scrollbar ${sheetHeight === 'min' ? 'hidden md:block' : 'block'}`}>
          <AnimatePresence>
            {weather?.isRaining && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-sitva-blue/10 dark:bg-sitva-blue/20 border border-sitva-blue/30 rounded-xl flex items-center gap-3 mb-4"
              >
                <div className="p-2 bg-sitva-blue/20 dark:bg-sitva-blue/40 rounded-full text-sitva-blue">
                  <CloudRain className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-sitva-blue uppercase tracking-wider">Alerta de Lluvia</h4>
                  <p className="text-[10px] text-foreground/80 leading-tight">Actualmente llueve en Medellin ({weather.temperature}C). Metrocables podrian operar con intermitencia.</p>
                </div>
              </motion.div>
            )}

            {showSupport && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <SupportChannels />
                <TariffInfo />
                <SystemStatus />
              </motion.div>
            )}
          </AnimatePresence>

          {routes.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 rounded-xl flex items-start gap-3" role="status">
              <div className="text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase tracking-wider shrink-0 mt-0.5">Aviso</div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                Las rutas mostradas son candidatas calculadas con tus coordenadas y los datos oficiales del SITVA. Cuando veas la insignia <span className="font-bold text-emerald-700 dark:text-emerald-400">validado</span>, cada bus integrado fue verificado contra nuestro catalogo. <span className="font-bold text-amber-700 dark:text-amber-400">sin validar</span> significa que la IA no pudo verificar un tramo; revisa el mapa antes de abordar.
              </p>
            </div>
          )}

          <div className="space-y-4 mb-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-end space-x-2'}`}>
                {msg.role === 'assistant' && (
                  <img src="/logo_chat.png" alt="MetroBot" className="w-8 h-8 rounded-full shadow-sm object-cover shrink-0 bg-white dark:bg-slate-850" />
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-chat-bubble-user text-chat-bubble-user-text rounded-br-sm'
                    : 'bg-chat-bubble-assistant text-chat-bubble-assistant-text rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start items-end space-x-2">
                <img src="/logo_chat.png" alt="MetroBot" className="w-8 h-8 rounded-full shadow-sm object-cover shrink-0 bg-white dark:bg-slate-850" />
                <div className="bg-chat-bubble-assistant text-chat-bubble-assistant-text rounded-2xl rounded-bl-sm px-4 py-3 flex space-x-1 h-[44px] items-center shadow-sm">
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
                className="space-y-4 mt-4"
              >
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Rutas Sugeridas</h3>
                {routes.map((route, idx) => (
                  <div key={route.id} onClick={() => setActiveRouteIndex(idx)} className="cursor-pointer">
                    <RouteCard
                      route={route}
                      isSelected={activeRouteIndex === idx}
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form onSubmit={handleSubmit} className="p-3 bg-card border-t border-border/30 shrink-0">
          <div className="flex items-center space-x-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Preguntale a MetroBot..."
              className="flex-1 rounded-full bg-muted/30 border-border/30 focus-visible:ring-sitva-green/30"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !query.trim()}
              className="rounded-full bg-sitva-green hover:bg-sitva-green/90 text-white shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
