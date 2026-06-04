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
  isGoogle?: boolean;
}

interface MapSearchProps {
  onRouteSubmit?: (origin: {lat: number, lng: number, name: string}, dest: {lat: number, lng: number, name: string}) => void;
  onOriginSelect?: (coords: {lat: number, lng: number, name?: string} | null) => void;
  onDestSelect?: (coords: {lat: number, lng: number, name?: string} | null) => void;
  origin?: {lat: number, lng: number, name?: string} | null;
  dest?: {lat: number, lng: number, name?: string} | null;
  hasActiveRoute?: boolean;
  onClearRoute?: () => void;
}

export function MapSearch({ 
  onRouteSubmit, 
  onOriginSelect, 
  onDestSelect,
  origin,
  dest,
  hasActiveRoute = false,
  onClearRoute
}: MapSearchProps) {
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [originCoords, setOriginCoords] = useState<{lat: number, lng: number} | null>(null);
  const [destCoords, setDestCoords] = useState<{lat: number, lng: number} | null>(null);
  
  const [activeField, setActiveField] = useState<'origin' | 'dest' | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapSelectionMode, setMapSelectionMode] = useState<'origin' | 'dest' | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const map = useMap();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync props with internal states to keep them controlled
  useEffect(() => {
    if (origin) {
      const name = origin.name || `${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}`;
      if (originQuery !== name) setOriginQuery(name);
      if (originCoords?.lat !== origin.lat || originCoords?.lng !== origin.lng) {
        setOriginCoords({ lat: origin.lat, lng: origin.lng });
      }
    } else {
      if (originQuery) setOriginQuery('');
      if (originCoords) setOriginCoords(null);
    }
  }, [origin]);

  useEffect(() => {
    if (dest) {
      const name = dest.name || `${dest.lat.toFixed(5)}, ${dest.lng.toFixed(5)}`;
      if (destQuery !== name) setDestQuery(name);
      if (destCoords?.lat !== dest.lat || destCoords?.lng !== dest.lng) {
        setDestCoords({ lat: dest.lat, lng: dest.lng });
      }
    } else {
      if (destQuery) setDestQuery('');
      if (destCoords) setDestCoords(null);
    }
  }, [dest]);

  // Set initial collapse state based on device size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      mapContainer.style.cursor = '';
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

    if (window.google && window.google.maps && window.google.maps.places) {
      try {
        const service = new google.maps.places.AutocompleteService();
        const predictions = await new Promise<google.maps.places.AutocompletePrediction[] | null>((resolve) => {
          service.getPlacePredictions({
            input: text,
            location: new google.maps.LatLng(6.2442, -75.5812),
            radius: 50000,
            componentRestrictions: { country: 'co' }
          }, (predictions) => {
            resolve(predictions);
          });
        });

        if (predictions && predictions.length > 0) {
           const mappedResults = predictions.map((p: any) => ({
             place_id: p.place_id,
             display_name: p.description,
             lat: '0',
             lon: '0',
             isGoogle: true
           }));
           setResults(mappedResults);
           setLoading(false);
           return;
        }
      } catch (err) {
        console.error("Google SDK Search error:", err);
      }
    }

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
    let lat = parseFloat(r.lat);
    let lng = parseFloat(r.lon);
    const name = r.display_name.split(',')[0];

    if (r.isGoogle) {
      setLoading(true);
      try {
        if (window.google && window.google.maps && window.google.maps.places) {
          const service = new google.maps.places.PlacesService(document.createElement('div'));
          const getDetails = () => {
            return new Promise((resolve, reject) => {
              service.getDetails({ placeId: r.place_id }, (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
                  resolve(place.geometry.location);
                } else {
                  reject(status);
                }
              });
            });
          };

          const location = await getDetails() as any;
          lat = location.lat();
          lng = location.lng();
        }
      } catch (e) {
        console.error("Error fetching Google place details:", e);
      } finally {
        setLoading(false);
      }
    }

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

  // If a route is active, show the clean header
  if (hasActiveRoute) {
    return (
      <div 
        ref={containerRef} 
        className="absolute top-5 left-4 right-4 md:right-auto z-[999] w-[calc(100vw-32px)] md:w-80 lg:w-[400px] pointer-events-none fade-in"
      >
        <div className="bg-card/90 backdrop-blur-md rounded-2xl shadow-xl border border-border/40 p-3 pointer-events-auto flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Ruta Activa</span>
            <div className="text-[13px] font-semibold text-foreground flex items-center gap-1.5 leading-tight mt-0.5">
              <span className="truncate max-w-[120px]">{originQuery.split(',')[0] || 'Origen'}</span>
              <span className="text-slate-400 dark:text-slate-600">➔</span>
              <span className="truncate max-w-[120px] text-sitva-green font-bold">{destQuery.split(',')[0] || 'Destino'}</span>
            </div>
          </div>
          <button 
            onClick={onClearRoute}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
          >
            Limpiar
          </button>
        </div>
      </div>
    );
  }

  // Collapsed search bar
  if (isCollapsed) {
    return (
      <div 
        ref={containerRef} 
        className="absolute top-5 left-4 right-4 md:right-auto z-[999] w-[calc(100vw-32px)] md:w-80 lg:w-[400px] pointer-events-none fade-in"
      >
        <div 
          onClick={() => setIsCollapsed(false)}
          className="bg-card/95 backdrop-blur-md rounded-2xl shadow-md border border-border/40 p-3.5 pointer-events-auto flex items-center gap-3 cursor-pointer hover:bg-card hover:shadow-lg transition-all duration-300 transform scale-100 active:scale-98 animate-in slide-in-from-top duration-300"
        >
          <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-sitva-blue">
            <Search className="w-4 h-4 text-sitva-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] text-slate-500 dark:text-slate-400 font-medium block truncate">
              {destQuery ? `Destino: ${destQuery.split(',')[0]}` : (originQuery ? `De: ${originQuery.split(',')[0]}` : '¿A dónde quieres ir hoy en Medellín?')}
            </span>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-850 shrink-0" />
          <div className="bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-xl text-[11px] font-bold text-sitva-blue shrink-0">
            Buscar
          </div>
        </div>
      </div>
    );
  }

  // Fully expanded Search Box
  return (
    <div 
      ref={containerRef} 
      className="absolute top-5 left-4 right-4 md:right-auto z-[999] w-[calc(100vw-32px)] md:w-80 lg:w-[400px] pointer-events-none fade-in"
    >
      <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-2xl border border-border/40 p-4 pointer-events-auto flex flex-col gap-3 animate-in zoom-in-95 duration-200">
        
        {/* Header inside search panel */}
        <div className="flex items-center justify-between pb-1.5 border-b border-border/20 md:hidden">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Planificar Ruta</span>
          <button 
            onClick={() => setIsCollapsed(true)} 
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs row */}
        <div className="flex gap-2 relative items-center">
          {/* Left indicators */}
          <div className="flex flex-col items-center justify-center py-2 px-1 gap-1 shrink-0">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 dark:border-slate-600 flex items-center justify-center"></div>
            <div className="w-0.5 h-3 bg-slate-350 dark:bg-slate-700"></div>
            <MapPin className="w-4 h-4 text-rose-500" />
          </div>
          
          {/* Input Fields */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            {/* Origin */}
            <div className="relative">
              <input
                type="text"
                className="w-full bg-input rounded-xl border border-transparent outline-none px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:bg-card focus:border-sitva-blue/50 focus:ring-2 focus:ring-sitva-blue/10 transition-all font-medium"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              )}
            </div>
            
            {/* Destination */}
            <div className="relative">
              <input
                type="text"
                className="w-full bg-input rounded-xl border border-transparent outline-none px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:bg-card focus:border-sitva-blue/50 focus:ring-2 focus:ring-sitva-blue/10 transition-all font-medium"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              )}
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex flex-col items-center justify-center px-0.5 shrink-0">
            <button 
              onClick={swapFields}
              className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
              title="Invertir ubicaciones"
            >
              <ArrowDownUp className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {/* Submit Search Button */}
          {originCoords && destCoords && (
            <button 
              onClick={handleSubmit}
              className="w-full bg-sitva-blue hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Navigation className="w-4 h-4" />
              <span className="text-[13px]">Buscar Ruta en SITVA</span>
            </button>
          )}

          {/* Map Selector Trigger */}
          <div 
            onClick={() => setMapSelectionMode(mapSelectionMode ? null : (activeField === 'dest' ? 'dest' : 'origin'))}
            className="bg-card rounded-xl border border-border/65 p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2 text-foreground">
               <MousePointerClick className="w-4 h-4 text-sitva-blue shrink-0" />
               <span className="text-[12px] font-semibold leading-tight">Elegir desde el mapa</span>
            </div>
            <div className={`relative inline-flex h-4.5 w-8.5 shrink-0 items-center rounded-full transition-colors ${mapSelectionMode ? 'bg-sitva-blue' : 'bg-slate-200 dark:bg-slate-800'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${mapSelectionMode ? 'translate-x-4' : 'translate-x-[2px]'}`} />
            </div>
          </div>

          {/* Map Selection Helper */}
          {mapSelectionMode && (
            <div className="bg-sitva-blue text-white rounded-xl shadow-md p-2.5 text-[12px] font-semibold text-center pointer-events-auto animate-pulse">
               <div>Toca el mapa para marcar tu <b>{mapSelectionMode === 'origin' ? 'Punto de Partida' : 'Destino'}</b>.</div>
               <button 
                 onClick={() => setMapSelectionMode(null)} 
                 className="mx-auto mt-2 block bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg transition-colors text-[11px] font-bold"
               >
                 Cancelar Selección
               </button>
            </div>
          )}

          {/* Search Results Dropdown */}
          {activeField && (results.length > 0 || !loading) && (
            <div className="bg-card rounded-xl border border-border/80 overflow-hidden max-h-[160px] overflow-y-auto w-full flex flex-col divide-y divide-border/40 shadow-inner custom-scrollbar">
              
              <button 
                 onClick={requestCurrentLocation}
                 className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center gap-2.5 transition-colors text-sitva-blue cursor-pointer"
              >
                 <div className="bg-blue-50 dark:bg-blue-950/20 p-1.5 rounded-full shrink-0">
                   <Locate className="w-4 h-4 text-sitva-blue" />
                 </div>
                 <span className="text-[12px] font-bold">Usar mi ubicación actual</span>
              </button>

              {results.map((r, i) => {
                 const nameParts = r.display_name.split(',');
                 const mainName = nameParts[0];
                 const subName = nameParts.slice(1).join(',').trim();
                 return (
                   <button
                     key={`${r.place_id}-${i}`}
                     className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-start gap-2.5 transition-colors group cursor-pointer"
                     onClick={() => handleSelect(r)}
                   >
                     <div className="mt-0.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20 group-hover:text-sitva-blue transition-colors shrink-0">
                       <MapPin className="w-3.5 h-3.5 text-slate-500 group-hover:text-sitva-blue" />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="text-[12px] font-bold text-foreground line-clamp-1">{mainName}</div>
                       <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-snug">{subName}</div>
                     </div>
                   </button>
                 )
              })}
            </div>
          )}
          
          {activeField && loading && results.length === 0 && (
             <div className="bg-card rounded-xl border border-border p-4 text-center flex justify-center w-full shadow-inner">
                <Loader2 className="w-5 h-5 text-sitva-blue animate-spin" />
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
