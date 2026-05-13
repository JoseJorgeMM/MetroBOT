import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Info, ChevronUp, ChevronDown, Map as MapIcon, MapPin } from 'lucide-react';
import { loadStations, Station } from '@/src/lib/stations';
import { MapSearch } from './MapSearch';
import { getRouteGeometry } from '@/src/lib/osrm';

import { RouteOption } from '@/src/lib/routing';

const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // in metres
};

const getMarkerColor = (sistema: string) => {
  const norm = sistema.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  switch (norm) {
    case 'metro': return '#00994C';
    case 'cable': return '#E31837';
    case 'metroplus': return '#8a8d91';
    case 'tranvia': return '#00994C';
    case 'encicla': return '#00A4E4';
    default: return '#94a3b8';
  }
};

const createCustomMarker = (color: string) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

interface MapComponentProps {
  onSearchRoute?: (origin: {lat: number, lng: number, name: string}, dest: {lat: number, lng: number, name: string}) => void;
  origin?: {lat: number, lng: number} | null;
  dest?: {lat: number, lng: number} | null;
  routes?: RouteOption[];
  activeRouteIndex?: number;
  onOriginSelect?: (coords: {lat: number, lng: number, name?: string} | null) => void;
  onDestSelect?: (coords: {lat: number, lng: number, name?: string} | null) => void;
}

const createPointMarker = (color: string, iconHtml?: string) => {
  return L.divIcon({
    className: 'custom-point-marker bg-transparent',
    html: iconHtml || `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>`,
    iconSize: iconHtml ? [32, 32] : [14, 14],
    iconAnchor: iconHtml ? [16, 32] : [7, 7]
  });
};

export function MapComponent({ onSearchRoute, origin, dest, routes, activeRouteIndex = 0, onOriginSelect, onDestSelect }: MapComponentProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const [routePaths, setRoutePaths] = useState<{[key: string]: [number, number][]}>( {});

  useEffect(() => {
    loadStations().then(data => {
      setStations(data);
      setLoading(false);
    });
  }, []);

  const currentRoute = routes && routes.length > 0 ? routes[activeRouteIndex] : null;
  const routeOrigin = currentRoute ? currentRoute.originStation : null;
  const routeDest = currentRoute ? currentRoute.destinationStation : null;

  useEffect(() => {
    async function updatePaths() {
      if (!origin || !dest) return;
      const paths: {[key: string]: [number, number][]} = {};

      // 1. Walking: Origin -> Route Origin
      if (routeOrigin) {
        paths['walk-origin'] = await getRouteGeometry([[origin.lat, origin.lng], [routeOrigin.lat, routeOrigin.lng]], 'foot');
      }

      // 2. Route between stations
      if (currentRoute) {
        // Collect points with their modes to figure out paths
        const stepPoints: { point: [number, number], mode: string }[] = [];
        
        if (routeOrigin) {
           // We assume the first station is part of the first step's mode, or we just keep it
           stepPoints.push({ point: [routeOrigin.lat, routeOrigin.lng], mode: 'walk' });
        }
        
        currentRoute.steps.forEach(step => {
          if (step.station) {
            stepPoints.push({ point: [step.station.lat, step.station.lng], mode: step.mode });
          }
        });

        if (routeDest) {
            const lastMode = currentRoute.steps.length > 0 ? currentRoute.steps[currentRoute.steps.length - 1].mode : 'walk';
            stepPoints.push({ point: [routeDest.lat, routeDest.lng], mode: lastMode });
        }

        // Draw segments between points depending on the mode
        for (let i = 0; i < stepPoints.length - 1; i++) {
           const p1 = stepPoints[i];
           const p2 = stepPoints[i+1];
           
           // Mode applying to this segment is p2's mode since p2 is the destination of the step
           const mode = p2.mode;
           
           if (mode === 'walk' || mode === 'encicla') {
              const geometry = await getRouteGeometry([p1.point, p2.point], mode === 'encicla' ? 'bike' : 'foot');
              paths[`segment-${mode}-${i}`] = geometry;
           } else {
              // For SITVA, we just draw a straight line instead of street routes, or no line.
              // To make it clear, we can draw a straight line so it connects the dots without following streets.
              paths[`segment-straight-${i}`] = [p1.point, p2.point];
           }
        }
      }

      // 3. Walking: Route Dest -> Destination
      if (routeDest) {
        paths['walk-dest'] = await getRouteGeometry([[routeDest.lat, routeDest.lng], [dest.lat, dest.lng]], 'foot');
      }

      setRoutePaths(paths);
    }
    updatePaths();
  }, [origin, dest, currentRoute, routeOrigin, routeDest]);

  const handleComoLlegar = (station: Station) => {
    const destCoords = { lat: station.lat, lng: station.lng, name: station.nombre };
    if (onDestSelect) onDestSelect(destCoords);

    if (origin) {
      if (onSearchRoute) {
        onSearchRoute(
          { lat: origin.lat, lng: origin.lng, name: 'Origen actual' },
          destCoords
        );
      }
    } else {
      if (navigator.geolocation) {
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            let originName = "Mi ubicación actual";
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`);
              const data = await res.json();
              originName = data.display_name ? data.display_name.split(',')[0] : originName;
            } catch (e) {
              console.error(e);
            }
            if (onOriginSelect) onOriginSelect({ lat: latitude, lng: longitude, name: originName });
            if (onSearchRoute) onSearchRoute({ lat: latitude, lng: longitude, name: originName }, destCoords);
            setLoading(false);
          },
          (error) => {
            setLoading(false);
            console.error(error);
            alert('No se pudo obtener tu ubicación automáticamente. Por favor ingresa o selecciona tu punto de partida en el buscador.');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        alert('Tu navegador no soporta geolocalización. Ingresa tu punto de partida en el buscador.');
      }
    }
  };

  const renderOriginMarker = () => {
    const markers = [];
    
    const originIconHtml = `<div style="background-color: #ef4444; color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>`;
    const suggestedOriginIconHtml = `<div style="background-color: #10b981; color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-navigation"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>`;

    if (routeOrigin) {
      markers.push(
        <Marker key="route_origin" position={[routeOrigin.lat, routeOrigin.lng]} icon={createPointMarker('#10b981', suggestedOriginIconHtml)}>
          <Popup>
            <div className="font-bold text-emerald-600">Estación Sugerida (Inicio):<br/>{routeOrigin.name}</div>
          </Popup>
        </Marker>
      );
    } 
    
    if (origin) {
      markers.push(
        <Marker key="sel_origin" position={[origin.lat, origin.lng]} icon={createPointMarker('#ef4444', originIconHtml)}>
          <Popup>
            <div className="font-bold text-red-500">Origen Seleccionado</div>
          </Popup>
        </Marker>
      );
    }
    return markers;
  };

  const renderDestMarker = () => {
    const markers = [];
    
    const destIconHtml = `<div style="background-color: #3b82f6; color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flag"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg></div>`;
    const suggestedDestIconHtml = `<div style="background-color: #f59e0b; color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>`;

    if (routeDest) {
      markers.push(
        <Marker key="route_dest" position={[routeDest.lat, routeDest.lng]} icon={createPointMarker('#f59e0b', suggestedDestIconHtml)}>
          <Popup>
             <div className="font-bold text-amber-500">Estación Sugerida (Fin):<br/>{routeDest.name}</div>
          </Popup>
        </Marker>
      );
    } 

    if (dest) {
      markers.push(
        <Marker key="sel_dest" position={[dest.lat, dest.lng]} icon={createPointMarker('#3b82f6', destIconHtml)}>
          <Popup>
             <div className="font-bold text-blue-500">Destino Seleccionado</div>
          </Popup>
        </Marker>
      );
    }
    return markers;
  };

  const renderConnections = () => {
    const polys = [];
    if (origin && routeOrigin) {
      const dist = Math.round(getDistanceMeters(origin.lat, origin.lng, routeOrigin.lat, routeOrigin.lng));
      const positions = routePaths['walk-origin'] || [[origin.lat, origin.lng], [routeOrigin.lat, routeOrigin.lng]];
      polys.push(
        <React.Fragment key="origin-connection">
          <Polyline positions={positions} pathOptions={{ color: '#10b981', dashArray: '5, 5', weight: 4 }}>
             <Popup>Distancia caminando al inicio: {dist} metros ({Math.ceil(dist / 80)} min)</Popup>
          </Polyline>
        </React.Fragment>
      );
    }
    
    // Route trace between stations
    if (currentRoute) {
      const route = currentRoute;
      const intermediateMarkers: React.ReactNode[] = [];

      route.steps.forEach((step, idx) => {
        if (step.station) {
          const latlng: [number, number] = [step.station.lat, step.station.lng];
          
          // Only show intermediate markers if it's not the last/dest station
          if (step.station.name !== routeDest?.name && step.station.name !== routeOrigin?.name) {
             intermediateMarkers.push(
               <Marker key={`inter-${idx}`} position={latlng} icon={createPointMarker(getMarkerColor(step.mode))}>
                 <Popup>
                   <div className="font-semibold">{step.station.name}</div>
                   <div className="text-xs text-gray-500">{step.instruction}</div>
                 </Popup>
               </Marker>
             );
          }
        }
      });

      // Render intermediate markers and paths
      const segmentsKeys = Object.keys(routePaths).filter(k => k.startsWith('segment-'));
      segmentsKeys.forEach(k => {
         const positions = routePaths[k];
         if (!positions || positions.length < 2) return;

         const isWalk = k.includes('-walk-');
         const isStraight = k.includes('straight');

         // Determinar color basado en el segmento
         let color = '#3b82f6'; // default blue
         if (isWalk) color = '#10b981'; // emerald for walk
         else if (isStraight) {
           // Intentamos encontrar el modo en la ruta para asignar color real de SITVA
           const segmentIndex = parseInt(k.split('-').pop() || '0');
           const step = route.steps[segmentIndex];
           if (step) {
             color = getMarkerColor(step.mode);
           } else {
             color = '#94a3b8'; // fallback grey
           }
         }

         polys.push(
            <Polyline
              key={`route-trace-${k}`}
              positions={positions}
              pathOptions={{
                 color: color,
                 weight: isStraight ? 4 : 5,
                 opacity: 0.8,
                 dashArray: isStraight ? '10, 10' : (isWalk ? '8, 8' : undefined)
              }}
            />
         );
      });

      polys.push(...intermediateMarkers);
    }

    if (dest && routeDest) {
      const dist = Math.round(getDistanceMeters(dest.lat, dest.lng, routeDest.lat, routeDest.lng));
      const positions = routePaths['walk-dest'] || [[routeDest.lat, routeDest.lng], [dest.lat, dest.lng]];
      polys.push(
        <React.Fragment key="dest-connection">
          <Polyline positions={positions} pathOptions={{ color: '#f43f5e', dashArray: '5, 5', weight: 4 }}>
            <Popup>Distancia caminando al final: {dist} metros ({Math.ceil(dist / 80)} min)</Popup>
          </Polyline>
        </React.Fragment>
      );
    }
    return polys;
  };

  return (
    <div className="w-full h-full relative">
      <MapContainer 
        center={[6.2442, -75.5812]} 
        zoom={12} 
        scrollWheelZoom={true} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <ZoomControl position="topleft" />
        <MapSearch 
          onRouteSubmit={onSearchRoute} 
          onOriginSelect={onOriginSelect} 
          onDestSelect={onDestSelect} 
        />
        
        {renderConnections()}
        {renderOriginMarker()}
        {renderDestMarker()}

        {stations.map((station, idx) => (
          <Marker 
            key={`${station.id}-${idx}`} 
            position={[station.lat, station.lng]}
            icon={createCustomMarker(getMarkerColor(station.sistema))}
          >
            <Popup>
              <div className="p-2 min-w-[200px] font-sans">
                <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getMarkerColor(station.sistema) }}></div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight m-0">{station.nombre}</h3>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-600">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Sistema</span>
                    <span className="font-semibold text-slate-700">{station.sistema}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Línea</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800 border border-slate-200">{station.linea}</span>
                  </div>
                  <div className="pt-2">
                    <button 
                      onClick={() => handleComoLlegar(station)}
                      className="w-full bg-sitva-green text-white font-bold py-1.5 rounded-lg text-xs shadow-sm hover:bg-sitva-green/90 transition-colors"
                    >
                      ¿Cómo llegar?
                    </button>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center space-x-3">
            <div className="w-6 h-6 border-4 border-sitva-green border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-slate-700">Cargando Mapa SITVA...</span>
          </div>
        </div>
      )}
      
      {/* Legend Area */}
      <div 
        className={`absolute top-[4.5rem] md:top-4 right-3 md:right-4 bg-white/95 backdrop-blur shadow-xl border border-white/50 rounded-2xl z-[1000] flex flex-col transition-all duration-300 pointer-events-auto overflow-hidden ${isLegendExpanded ? 'p-3 w-[150px] md:w-48' : 'p-2 w-auto cursor-pointer hover:bg-white'}`}
        onClick={() => !isLegendExpanded && setIsLegendExpanded(true)}
      >
         <div className="flex items-center justify-between gap-3">
           <div className="flex items-center gap-2">
             <div className="p-1 bg-slate-100 rounded-lg">
               <MapIcon className="w-3.5 h-3.5 text-slate-600" />
             </div>
             <h4 className="text-xs font-bold text-slate-800 whitespace-nowrap">Leyendas</h4>
           </div>
           <button 
             onClick={(e) => {
               e.stopPropagation();
               setIsLegendExpanded(!isLegendExpanded);
             }}
             className="p-1 hover:bg-slate-100 rounded-lg transition-colors ml-1"
           >
             {isLegendExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
           </button>
         </div>

         {isLegendExpanded && (
           <div className="mt-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-white/50 shadow-sm" style={{ backgroundColor: getMarkerColor('Metro') }}></div>
                <span className="text-[11px] font-medium text-slate-600">Metro</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-white/50 shadow-sm" style={{ backgroundColor: getMarkerColor('Cable') }}></div>
                <span className="text-[11px] font-medium text-slate-600">Metrocable</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-white/50 shadow-sm" style={{ backgroundColor: getMarkerColor('Metroplus') }}></div>
                <span className="text-[11px] font-medium text-slate-600">Metroplús</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-white/50 shadow-sm" style={{ backgroundColor: getMarkerColor('EnCicla') }}></div>
                <span className="text-[11px] font-medium text-slate-600">EnCicla</span>
             </div>
             
             <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
               <Info className="w-3 h-3 text-sitva-blue" />
               <span className="text-[10px] font-bold text-slate-500">Estaciones: {stations.length}</span>
             </div>
           </div>
         )}
      </div>
    </div>
  );
}
