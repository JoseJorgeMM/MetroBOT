/// <reference types="vite/client" />
import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2, X, ArrowDownUp, Navigation, Locate, MousePointerClick } from 'lucide-react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

interface SearchResult {
  place_id: string | number;
  lat: string;
  lon: string;
  display_name: string;
  isMapbox?: boolean;
}

interface MapSearchProps {
  onRouteSubmit?: (origin: {lat: number, lng: number, name: string}, dest: {lat: number, lng: number, name: string}) => void;
  onOriginSelect?: (coords: {lat: number, lng: number, name?: string} | null) => void;
  onDestSelect?: (coords: {lat: number, lng: number, name?: string} | null) => void;
}

export function MapSearch({ onRouteSubmit, onOriginSelect, onDestSelect }: MapSearchProps) {
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [originCoords, setOriginCoords] = useState<{lat: number, lng: number} | null>(null);
  const [destCoords, setDestCoords] = useState<{lat: number, lng: number} | null>(null);
  
  const [activeField, setActiveField] = useState<'origin' | 'dest' | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapSelectionMode, setMapSelectionMode] = useState<'origin' | 'dest' | null>(null);
  
  const map = useMap();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  useEffect(() => {
    const mapContainer = map.getContainer();
    if (mapSelectionMode) {
      mapContainer.style.cursor = 'crosshair';
    } else {
      mapContainer.style.cursor = ''; // Reset
    }
  }, [mapSelectionMode, map]);

  useMapEvents({
    click: async (e) => {
      if (!mapSelectionMode) return;
      const { lat, lng } = e.latlng;
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        const name = data.display_name ? data.display_name.split(',')[0] : "Punto seleccionado";
        
        if (mapSelectionMode === 'origin') {
          setOriginQuery(name);
          setOriginCoords({lat, lng});
          if (onOriginSelect) onOriginSelect({lat, lng, name});
          
          if (!destCoords) {
             setMapSelectionMode('dest');
             setActiveField('dest');
          } else {
             setMapSelectionMode(null);
          }
        } else if (mapSelectionMode === 'dest') {
          setDestQuery(name);
          setDestCoords({lat, lng});
          if (onDestSelect) onDestSelect({lat, lng, name});
          setMapSelectionMode(null);
          setActiveField(null);
        }
      } catch (err) {
        console.error("Reverse geocoding failed", err);
      } finally {
        setLoading(false);
      }
    }
  });

  const normalizeQuery = (text: string) => {
    const lower = text.toLowerCase();
    if (!lower.includes('medellin') && !lower.includes('medellín') && !lower.includes('antioquia')) {
      return `${text}, Medellín, Antioquia`;
    }
    return text;
  }

  const search = async (text: string) => {
    if (!text.trim()) {
       setResults([]);
       return;
    }
    setLoading(true);

    // Mapbox Geocoding API as a fallback or primary
    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      try {
        // Definimos un Bounding Box aproximado para Medellín para priorizar resultados locales
        // [West, South, East, North] -> [-75.7, 6.0, -75.4, 6.5]
        const bbox = '-75.7,6.0,-75.4,6.5';
        const query = encodeURIComponent(text);

        // Usamos types=poi para encontrar lugares, restaurantes, centros comerciales, etc.
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&country=co&bbox=${bbox}&types=poi,address,place,neighborhood,locality&limit=10`;

        const res = await fetch(url);
        const data = await res.json();

        if (data && data.features && data.features.length > 0) {
           const mappedResults = data.features.map((f: any) => ({
             place_id: f.id,
             display_name: f.place_name,
             lat: f.center[1].toString(), // Mapbox returns [lng, lat]
             lon: f.center[0].toString(),
             isMapbox: true
           }));
           setResults(mappedResults);
           setLoading(false);
           return;
        }
      } catch (err) {
        console.error("Mapbox search error:", err);
      }
    }

    // Fallback to nominatim
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizeQuery(text))}&limit=8&addressdetails=1&countrycodes=co`);
      const data = await res.json();
      setResults(data);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>, field: 'origin' | 'dest') => {
    const val = e.target.value;
    if (field === 'origin') {
      setOriginQuery(val);
      setOriginCoords(null);
      if (onOriginSelect) onOriginSelect(null);
    } else {
      setDestQuery(val);
      setDestCoords(null);
      if (onDestSelect) onDestSelect(null);
    }
    
    setActiveField(field);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(val), 600);
  };

  const applySelection = (lat: number, lng: number, name: string) => {
    map.flyTo([lat, lng], 16, { duration: 1.5 });
    
    if (activeField === 'origin') {
      setOriginQuery(name);
      setOriginCoords({lat, lng});
      if (onOriginSelect) onOriginSelect({lat, lng, name});
    } else if (activeField === 'dest') {
      setDestQuery(name);
      setDestCoords({lat, lng});
      if (onDestSelect) onDestSelect({lat, lng, name});
    }
    
    setResults([]);
    setActiveField(null);
  }

  const handleSelect = async (r: SearchResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const name = r.display_name.split(',')[0];
    applySelection(lat, lng, name);
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización');
      return;
    }
    
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let name = "Mi ubicación actual";
        try {
          // reverse geocode to get a nice name
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
          const data = await res.json();
          name = data.display_name ? data.display_name.split(',')[0] : name;
        } catch (e) {
          console.error("Reverse geocoding failed", e);
        } finally {
          map.flyTo([latitude, longitude], 16, { duration: 1.5 });
          
          if (activeField === 'origin') {
            setOriginQuery(name);
            setOriginCoords({lat: latitude, lng: longitude});
            if (onOriginSelect) onOriginSelect({lat: latitude, lng: longitude, name});
          } else if (activeField === 'dest') {
            setDestQuery(name);
            setDestCoords({lat: latitude, lng: longitude});
            if (onDestSelect) onDestSelect({lat: latitude, lng: longitude, name});
          }
          setLoading(false);
          setResults([]);
          setActiveField(null);
        }
      },
      (error) => {
        setLoading(false);
        console.error(error);
        alert('No se pudo obtener tu ubicación. Verifica los permisos de tu navegador.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const swapFields = () => {
    const tempQuery = originQuery;
    const tempCoords = originCoords;
    setOriginQuery(destQuery);
    setOriginCoords(destCoords);
    setDestQuery(tempQuery);
    setDestCoords(tempCoords);
    if (onOriginSelect) onOriginSelect(destCoords ? { ...destCoords, name: destQuery } : null);
    if (onDestSelect) onDestSelect(tempCoords ? { ...tempCoords, name: tempQuery } : null);
  };

  const handleSubmit = () => {
    if (originCoords && destCoords && onRouteSubmit) {
      onRouteSubmit(
        { ...originCoords, name: originQuery },
        { ...destCoords, name: destQuery }
      );
    }
  };

  return (
    <div ref={containerRef} className="absolute top-[4.5rem] md:top-4 left-0 md:left-4 z-[1000] w-full md:w-80 lg:w-[400px] pointer-events-none fade-in">
      
      {/* Search Input Box */}
      <div className="pl-3 pr-[120px] md:px-0">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 md:p-2 flex gap-1.5 md:gap-2 pointer-events-auto">
          {/* Left indicators */}
          <div className="flex flex-col items-center justify-center py-2 px-1 gap-1 shrink-0">
            <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full border-2 border-slate-400 flex items-center justify-center"></div>
            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            <MapPin className="w-4 h-4 md:w-5 md:h-5 text-rose-500" />
          </div>
          
          {/* Inputs */}
          <div className="flex-1 flex flex-col gap-1.5 md:gap-2 min-w-0">
            {/* Origin */}
            <div className="relative">
              <input
                type="text"
                className="w-full bg-slate-100 rounded-lg border border-transparent outline-none px-3 py-2 text-[13px] md:text-[14px] text-slate-700 placeholder:text-slate-500 focus:bg-white focus:border-sitva-blue/50 focus:ring-2 focus:ring-sitva-blue/20 transition-all font-medium"
                placeholder="Elige un punto de partida..."
                value={originQuery}
                onChange={(e) => handleInput(e, 'origin')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results.length > 0) {
                    handleSelect(results[0]);
                  }
                }}
                onFocus={() => {
                  setActiveField('origin');
                  if (originQuery && results.length === 0) search(originQuery);
                }}
              />
              {originQuery && activeField === 'origin' && (
                <button 
                  onClick={() => { 
                    setOriginQuery(''); 
                    setOriginCoords(null); 
                    setResults([]); 
                    if (onOriginSelect) onOriginSelect(null); 
                  }} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              )}
            </div>
            
            {/* Destination */}
            <div className="relative">
              <input
                type="text"
                className="w-full bg-slate-100 rounded-lg border border-transparent outline-none px-3 py-2 text-[13px] md:text-[14px] text-slate-700 placeholder:text-slate-500 focus:bg-white focus:border-sitva-blue/50 focus:ring-2 focus:ring-sitva-blue/20 transition-all font-medium"
                placeholder="Elige un destino..."
                value={destQuery}
                onChange={(e) => handleInput(e, 'dest')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results.length > 0) {
                    handleSelect(results[0]);
                  }
                }}
                onFocus={() => {
                  setActiveField('dest');
                  if (destQuery && results.length === 0) search(destQuery);
                }}
              />
              {destQuery && activeField === 'dest' && (
                <button 
                  onClick={() => { 
                    setDestQuery(''); 
                    setDestCoords(null); 
                    setResults([]); 
                    if (onDestSelect) onDestSelect(null); 
                  }} 
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              )}
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex flex-col items-center justify-center px-1 shrink-0">
            <button 
              onClick={swapFields}
              className="p-1.5 md:p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              title="Invertir ubicaciones"
            >
              <ArrowDownUp className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 md:px-0">
        {/* Button to search route when both selected */}
        {originCoords && destCoords && (
          <button 
            onClick={handleSubmit}
            className="mt-2 w-full bg-sitva-blue hover:bg-blue-700 text-white font-medium py-2.5 md:py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all pointer-events-auto"
          >
            <Navigation className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-[14px] md:text-[15px]">Buscar Ruta en SITVA</span>
          </button>
        )}

        {/* Map selection mode toggle */}
        <div 
          onClick={() => setMapSelectionMode(mapSelectionMode ? null : (activeField === 'dest' ? 'dest' : 'origin'))}
          className="mt-2 bg-white rounded-xl shadow-lg border border-slate-200 p-2.5 md:p-3 pointer-events-auto flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors w-[calc(100vw-144px)] md:w-auto"
        >
          <div className="flex items-center gap-2 text-slate-700">
             <MousePointerClick className="w-4 h-4 md:w-5 md:h-5 text-sitva-blue shrink-0" />
             <span className="text-[12px] md:text-[13px] font-medium leading-tight">Elegir desde el mapa</span>
          </div>
          <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${mapSelectionMode ? 'bg-sitva-blue' : 'bg-slate-200'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${mapSelectionMode ? 'translate-x-4' : 'translate-x-[2px]'}`} />
          </div>
        </div>

        {mapSelectionMode && (
          <div className="mt-2 bg-sitva-blue text-white rounded-xl shadow-lg p-3 text-[13px] font-medium text-center pointer-events-auto relative w-[calc(100vw-144px)] md:w-auto">
             <div>Haz clic en el mapa para marcar tu <b>{mapSelectionMode === 'origin' ? 'Punto de Partida' : 'Destino'}</b>.</div>
             <button 
               onClick={() => setMapSelectionMode(null)} 
               className="mx-auto mt-2 block bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors text-[12px]"
             >
               Cancelar Selección
             </button>
          </div>
        )}

        {/* Search Results Dropdown */}
        {activeField && (results.length > 0 || !loading) && (
          <div className="mt-2 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 overflow-hidden pointer-events-auto max-h-[180px] md:max-h-[40vh] overflow-y-auto w-full flex flex-col divide-y divide-slate-100">
            
            <button 
               onClick={requestCurrentLocation}
               className="w-full text-left px-3 py-2.5 md:px-4 md:py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors text-sitva-blue"
            >
               <div className="bg-blue-50 p-1.5 rounded-full shrink-0">
                 <Locate className="w-4 h-4 md:w-5 md:h-5" />
               </div>
               <span className="text-[13px] md:text-[14px] font-semibold">Usar mi ubicación actual</span>
            </button>

            {results.map((r, i) => {
              const nameParts = r.display_name.split(',');
              const mainName = nameParts[0];
              const subName = nameParts.slice(1).join(',').trim();
              return (
                <button
                  key={`${r.place_id}-${i}`}
                  className="w-full text-left px-3 py-2.5 md:px-4 md:py-3 hover:bg-slate-50 flex items-start gap-3 transition-colors group"
                  onClick={() => handleSelect(r)}
                >
                  <div className="mt-0.5 bg-slate-100 p-1.5 rounded-full group-hover:bg-blue-50 group-hover:text-sitva-blue transition-colors shrink-0">
                    <MapPin className="w-4 h-4 text-slate-500 group-hover:text-sitva-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] md:text-[14px] font-semibold text-slate-800 line-clamp-1">{mainName}</div>
                    <div className="text-[11px] md:text-[12px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">{subName}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        
        {activeField && loading && results.length === 0 && (
           <div className="mt-2 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 p-4 md:p-5 text-center pointer-events-auto flex justify-center w-full">
              <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-sitva-blue animate-spin" />
           </div>
        )}
      </div>
    </div>
  );
}
