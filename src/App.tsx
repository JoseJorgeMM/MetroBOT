import React, { useState, useRef, useEffect } from 'react';
import { MapComponent } from './components/Map/MapComponent';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Send, Menu, MessageSquare, AlertCircle } from 'lucide-react';
import { processUserQuery } from './lib/gemini';
import { RouteOption } from './lib/routing';
import { RouteCard } from './components/RouteCards/RouteCard';
import { SupportCard } from './components/SupportCard';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: '¡Qué más! Soy MetroBot. ¿A dónde quieres ir hoy en Medellín? También puedes tocar el mapa para marcar tu Punto de Inicio y Destino.' }
  ]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(true);
  
  const [origin, setOrigin] = useState<{lat: number, lng: number} | null>(null);
  const [dest, setDest] = useState<{lat: number, lng: number} | null>(null);

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
    setRoutes([]); // Clear previous routes
    setActiveRouteIndex(0); // Reset selected route

    const response = await processUserQuery(
      textToProcess,
      (newRoutes) => {
        setRoutes(newRoutes);
        if (newRoutes.length > 0) {
          if (newRoutes[0].userOrigin) {
            setOrigin({lat: newRoutes[0].userOrigin.lat, lng: newRoutes[0].userOrigin.lng});
          }
          if (newRoutes[0].userDest) {
            setDest({lat: newRoutes[0].userDest.lat, lng: newRoutes[0].userDest.lng});
          }
        }
      },
      (status) => console.log("Status:", status), // Handled in text response for now
      {
        origin: contextCoords?.origin || origin || undefined,
        dest: contextCoords?.dest || dest || undefined
      }
    );

    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsLoading(false);
  };

  const handleSearchRoute = (
    searchOrigin: {lat: number, lng: number, name: string}, 
    searchDest: {lat: number, lng: number, name: string}
  ) => {
    setOrigin({lat: searchOrigin.lat, lng: searchOrigin.lng});
    setDest({lat: searchDest.lat, lng: searchDest.lng});
    
    setIsChatOpen(true);
    const originText = searchOrigin.name.split(',')[0];
    const destText = searchDest.name.split(',')[0];
    const finalMessage = `Busca la mejor ruta en SITVA para ir de "${originText}" a "${destText}". (LAT ${searchOrigin.lat}, LNG ${searchOrigin.lng} a LAT ${searchDest.lat}, LNG ${searchDest.lng}). Busca estaciones de SITVA y ENCICLA cercanas y dame la ruta. 
REGLA MUY IMPORTANTE: Usa EXACTAMENTE los nombres y líneas de las estaciones como aparecen en los DATOS DE ESTACIONES provistos. NUNCA inventes nombres, sistemas, o líneas. Por ejemplo, "Doce de Octubre" es Metrocable Línea P, NO Metroplus. Si la estación es de EnCicla, llámala "EnCicla - [Nombre]". 
El mensaje para el usuario no debe contener coordenadas.`;
    
    handleSubmit(null, finalMessage, `Ruta desde ${originText} hasta ${destText}`, {
      origin: { lat: searchOrigin.lat, lng: searchOrigin.lng },
      dest: { lat: searchDest.lat, lng: searchDest.lng }
    });
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Real Map Component Area */}
      <div className="absolute inset-0 z-0 md:relative md:flex-1 h-full">
        <MapComponent 
          onSearchRoute={handleSearchRoute}
          origin={origin}
          dest={dest}
          routes={routes}
          activeRouteIndex={activeRouteIndex}
          onOriginSelect={(coords) => setOrigin(coords ? {lat: coords.lat, lng: coords.lng} : null)}
          onDestSelect={(coords) => setDest(coords ? {lat: coords.lat, lng: coords.lng} : null)}
        />
        
        {/* Support Card Positioned on the Map */}
        <div className="hidden md:block absolute bottom-6 left-6 z-[1000] pointer-events-none">
          <SupportCard />
        </div>
      </div>

      {/* Floating Header (Mobile) */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-white/80 to-transparent md:hidden pointer-events-none">
        <div className="flex items-center space-x-2 pointer-events-auto">
          <img src="/logo_chat.png" alt="MetroBot" className="w-10 h-10 rounded-full shadow-lg object-cover bg-white" />
          <span className="font-bold text-slate-900 text-lg drop-shadow-sm">MetroBot</span>
        </div>
        <Button variant="outline" size="icon" className="rounded-full shadow-md bg-white/90 backdrop-blur pointer-events-auto">
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Sidebar / Bottom Sheet */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 flex flex-col bg-white rounded-t-3xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 ease-in-out md:relative md:w-96 md:h-full md:rounded-none md:shadow-xl ${isChatOpen ? 'h-[60dvh]' : 'h-[5.5rem]'} md:h-full overflow-hidden`}>
        
        {/* Drag Handle (Mobile) */}
        <div 
          className="w-full h-8 flex flex-col items-center justify-start pt-3 cursor-pointer shrink-0 md:hidden z-10"
          onClick={() => setIsChatOpen(!isChatOpen)}
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-1" />
          {!isChatOpen && <span className="text-[10px] text-slate-400 font-medium">Desliza o toca para abrir el chat</span>}
        </div>

        {/* Support floating button for mobile when chat is closed or small */}
        {!isChatOpen && (
          <div className="absolute -top-16 right-4 md:hidden z-30">
             <SupportCard />
          </div>
        )}

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center space-x-3">
            <img src="/logo_chat.png" alt="MetroBot" className="w-10 h-10 rounded-full shadow-md object-cover bg-white" />
            <div>
              <h1 className="font-bold text-slate-900">MetroBot</h1>
              <p className="text-xs text-slate-500">Asistente SITVA</p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${!isChatOpen ? 'hidden md:block' : 'block'}`}>
          
          {/* Messages */}
          <div className="space-y-4 mb-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-end space-x-2'}`}>
                {msg.role === 'assistant' && (
                  <img src="/logo_chat.png" alt="MetroBot" className="w-8 h-8 rounded-full shadow-sm object-cover shrink-0" />
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-sitva-green text-white rounded-br-sm' 
                    : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start items-end space-x-2">
                <img src="/logo_chat.png" alt="MetroBot" className="w-8 h-8 rounded-full shadow-sm object-cover shrink-0" />
                <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex space-x-1 h-[44px] items-center">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Route Cards */}
          <AnimatePresence>
            {routes.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4 mt-4"
              >
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-1">Rutas Sugeridas</h3>
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

          {/* Mobile Support Card inside when chat is open and it's mobile */}
          <div className="mt-8 md:hidden">
            <SupportCard />
          </div>

        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0 relative z-20">
          <form onSubmit={handleSubmit} className="relative flex items-center mb-2">
            <Input 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsChatOpen(true)}
              placeholder="Escribe un mensaje o lugar..." 
              className="pr-12 bg-slate-50 border-transparent focus-visible:ring-sitva-green/50 focus-visible:bg-white text-[15px]"
            />
            <Button 
              type="submit" 
              size="icon" 
              variant="ghost" 
              className="absolute right-1 w-10 h-10 text-sitva-green hover:text-sitva-green hover:bg-sitva-green/10 rounded-full"
              disabled={isLoading || !query.trim()}
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
          <div className="text-center">
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
              Developed by <span className="font-bold text-slate-500">AI-LAB Jesús Rey</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
