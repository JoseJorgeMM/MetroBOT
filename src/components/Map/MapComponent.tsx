// MapComponent
// -----------------------------------------------------------------------------
// Cartographic convention for route polylines (SITVA):
//   - Solid line: any transit mode (Metro, Metrocable, Tranvia, Metroplus,
//     buses articulados, EnCicla), including short transfer walks between
//     modes. Transfers use the destination mode's color and a thinner stroke.
//   - Dashed line (`5, 10`): only the end-to-end walks at the start
//     (walk-origin) and end (walk-dest) of the route, plus any free-form walk
//     the user did before the first station. NEVER dashed for a transfer.
// Three polylines exist for this:
//   1. walk-origin (origin -> routeOrigin)       — solid emerald, dashed
//   2. walk-dest   (routeDest  -> destination)  — solid rose,    dashed
//   3. intermediate segments from routePaths:
//        - segment-{mode}-{i}        (bus / encicla / first-or-last walk)
//        - segment-straight-{i}      (metro / metrocable / tranvia / metroplus)
//        - segment-transfer-{i}      (mid-route walk connecting two transit
//                                      modes — solid, destination color)
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { UserLocationMarker } from './UserLocationMarker';
import { Info, ChevronUp, ChevronDown, Map as MapIcon, MapPin, Sun, Moon } from 'lucide-react';
import { loadStations, Station } from '@/src/lib/stations';
import { MapSelectionController } from './MapSelectionController';
import { getRouteGeometry } from '@/src/lib/osrm';

import { RouteOption } from '@/src/lib/routing';
import { getVisibleStations } from '@/src/lib/mapStationsFilter';
import { SupportCard } from '../SupportCard';

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
    case 'bus': return '#f59e0b'; // Amber for integrated buses
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
  darkMode?: boolean;
  onClearRoute?: () => void;
  onThemeToggle?: () => void;
  /** Live user position for the blue "you are here" marker. */
  userPosition?: { lat: number; lng: number } | null;
  /** Heading in degrees for rotating the user marker arrow. */
  userHeading?: number | null;
  /** When true, the map pans to follow the user. */
  followUser?: boolean;
  /** When true, the map only shows stations that are part of the active route. */
  isNavigating?: boolean;
  mapSelectionMode?: 'origin' | 'destination' | null;
  onMapPlaceSelected?: (mode: 'origin' | 'destination', place: { lat: number; lng: number; name: string }) => void;
}

// Helper to handle map centering and zooming
function MapController({ bounds }: { bounds?: L.LatLngBounds | null }) {
  const map = useMap();
  
  useEffect(() => {
    // Save map instance to window for custom controls
    (window as any).leafletMap = map;
    
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
    }
  }, [bounds, map]);
  
  return null;
}

const createPointMarker = (color: string, iconHtml?: string) => {
  return L.divIcon({
    className: 'custom-point-marker bg-transparent',
    html: iconHtml || `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>`,
    iconSize: iconHtml ? [32, 32] : [14, 14],
    iconAnchor: iconHtml ? [16, 32] : [7, 7]
  });
};

export function MapComponent({
  onSearchRoute,
  origin,
  dest,
  routes,
  activeRouteIndex = 0,
  onOriginSelect,
  onDestSelect,
  darkMode = false,
  onClearRoute,
  onThemeToggle,
  userPosition = null,
  userHeading = null,
  followUser = false,
  isNavigating = false,
  mapSelectionMode = null,
  onMapPlaceSelected,
}: MapComponentProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const [routePaths, setRoutePaths] = useState<{[key: string]: [number, number][]}>( {});
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

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
      const paths: {[key: string]: [number, number][]} = {};
      const allPoints: [number, number][] = [];

      if (origin) allPoints.push([origin.lat, origin.lng]);
      if (dest) allPoints.push([dest.lat, dest.lng]);

      // 1. Walking: Origin -> Route Origin
      if (origin && routeOrigin) {
        const geometry = await getRouteGeometry([[origin.lat, origin.lng], [routeOrigin.lat, routeOrigin.lng]], 'foot');
        paths['walk-origin'] = geometry;
        geometry.forEach(p => allPoints.push(p));
      }

      // 2. Route between stations
      if (currentRoute) {
        // Collect points with their modes to figure out paths
        const stepPoints: { point: [number, number], mode: string }[] = [];
        
        if (routeOrigin) {
           // Only add as a walk step if the origin is actually different from the routeOrigin
           if (origin && (origin.lat !== routeOrigin.lat || origin.lng !== routeOrigin.lng)) {
             stepPoints.push({ point: [routeOrigin.lat, routeOrigin.lng], mode: 'walk' });
           } else {
             stepPoints.push({ point: [routeOrigin.lat, routeOrigin.lng], mode: 'metro' });
           }
           allPoints.push([routeOrigin.lat, routeOrigin.lng]);
        }
        
        currentRoute.steps.forEach(step => {
          if (step.station) {
            stepPoints.push({ point: [step.station.lat, step.station.lng], mode: step.mode });
            allPoints.push([step.station.lat, step.station.lng]);
          }
        });

        if (routeDest) {
            const lastMode = currentRoute.steps.length > 0 ? currentRoute.steps[currentRoute.steps.length - 1].mode : 'walk';
            stepPoints.push({ point: [routeDest.lat, routeDest.lng], mode: lastMode });
            allPoints.push([routeDest.lat, routeDest.lng]);
        }

        // Draw segments between points depending on the mode
        for (let i = 0; i < stepPoints.length - 1; i++) {
           const p1 = stepPoints[i];
           const p2 = stepPoints[i+1];

           // Mode applying to this segment is p2's mode since p2 is the destination of the step
           const mode = p2.mode;
           // Total number of intermediate points (between routeOrigin and routeDest)
           // determines whether this is a real walk (first or last segment) or a
           // transfer (any segment in the middle). The first segment is the walk
           // from the user to the first station; the last is the walk from the
           // last station to the user destination. Both are already drawn as
           // walk-origin / walk-dest. Everything in between is a transfer.
           const isFirstSegment = i === 0;
           const isLastSegment = i === stepPoints.length - 2;

           if (mode === 'walk' || mode === 'encicla' || mode === 'bus' || mode === 'bus_articulado') {
              const profile = (mode === 'bus' || mode === 'bus_articulado') ? 'car' : (mode === 'encicla' ? 'bike' : 'foot');
              const geometry = await getRouteGeometry([p1.point, p2.point], profile);
              // Walk segments in the middle of the route are transfers, not
              // end-to-end walks; tag them so the renderer can use the
              // destination mode's color and a solid line.
              const isTransfer = mode === 'walk' && !isFirstSegment && !isLastSegment;
              const key = isTransfer ? `segment-transfer-${i}` : `segment-${mode}-${i}`;
              paths[key] = geometry;
              geometry.forEach(p => allPoints.push(p));
           } else {
              // For SITVA, we just draw a straight line
              paths[`segment-straight-${i}`] = [p1.point, p2.point];
              allPoints.push(p1.point);
              allPoints.push(p2.point);
           }
        }
      }

      // 3. Walking: Route Dest -> Destination
      if (dest && routeDest) {
        const geometry = await getRouteGeometry([[routeDest.lat, routeDest.lng], [dest.lat, dest.lng]], 'foot');
        paths['walk-dest'] = geometry;
        geometry.forEach(p => allPoints.push(p));
      }

      setRoutePaths(paths);

      // Update bounds if we have points
      if (allPoints.length >= 2) {
        const bounds = L.latLngBounds(allPoints);
        setMapBounds(bounds);
      } else {
        setMapBounds(null);
      }
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
          <Polyline 
            positions={positions} 
            pathOptions={{ color: '#10b981', dashArray: '5, 10', weight: 6, interactive: true }}
          >
             <Popup>
               <div className="p-1">
                 <p className="font-bold text-emerald-600">Tramo a pie</p>
                 <p className="text-xs">Distancia: {dist} metros</p>
                 <p className="text-xs font-semibold">Tiempo: ~{Math.ceil(dist / 80)} min</p>
               </div>
             </Popup>
          </Polyline>
        </React.Fragment>
      );
    }
    
    // Route trace between stations
    if (currentRoute) {
      const route = currentRoute;
      const markers: React.ReactNode[] = [];

      // Boarding Marker (Punto de abordaje)
      if (routeOrigin) {
        const boardingIcon = createPointMarker(getMarkerColor(route.steps[0]?.mode || 'bus'), 
          `<div style="background-color: white; color: ${getMarkerColor(route.steps[0]?.mode || 'bus')}; border: 3px solid ${getMarkerColor(route.steps[0]?.mode || 'bus')}; border-radius: 50%; padding: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M2 12h20"/></svg></div>`
        );
        markers.push(
          <Marker key="boarding-point" position={[routeOrigin.lat, routeOrigin.lng]} icon={boardingIcon}>
            <Popup>
              <div className="font-bold">Punto de Abordaje</div>
              <div className="text-sm">{routeOrigin.name}</div>
              <div className="text-xs text-blue-500 mt-1">Súbete aquí al {route.steps[0]?.mode === 'bus' ? 'Bus' : 'transporte'}</div>
            </Popup>
          </Marker>
        );
      }

      route.steps.forEach((step, idx) => {
        if (step.station) {
          const latlng: [number, number] = [step.station.lat, step.station.lng];

          // Only show intermediate markers if it's not the last/dest station AND it's not the route origin
          if (step.station.name !== routeDest?.name && step.station.name !== routeOrigin?.name) {
             markers.push(
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
         const isBus = k.includes('-bus-') || k.includes('-bus_articulado-');
         const isStraight = k.includes('straight');
         const isEncicla = k.includes('-encicla-');
         // A transfer is a short walk in the middle of the route, e.g. leaving
         // a metro station to walk to a bus stop or vice versa. Per the SITVA
         // cartographic convention, only the start/end walks to the user's
         // origin/destination are dashed; transfers take the destination
         // mode's color and are drawn as a solid line.
         const isTransfer = k.includes('-transfer-');

         // Determinar color basado en el segmento
         let color = '#3b82f6'; // default blue
         const segmentIndex = parseInt(k.split('-').pop() || '0');
         const step = route.steps[segmentIndex];

         if (isTransfer) {
           // Take the color from the step this transfer is connecting to. If
           // the step index is out of bounds fall back to amber (bus) since
           // transfers are most often between metro and bus.
           color = step ? getMarkerColor(step.mode) : '#f59e0b';
         } else if (isWalk) {
           color = '#10b981'; // emerald for walk
         } else if (isEncicla) {
           color = '#00A4E4'; // encicla color
         } else if (isBus) {
           color = '#f59e0b'; // amber for bus
         } else if (isStraight) {
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
                 // Transfers are thinner than primary transport lines so the
                 // destination mode's color still reads as the main segment.
                 weight: isTransfer ? 4 : 6,
                 opacity: 0.9,
                 dashArray: (isWalk && !isStraight) ? '5, 10' : undefined,
                 interactive: true
              }}
            >
              <Popup>
                <div className="text-xs font-bold">
                  {isTransfer
                    ? 'Transbordo (caminata corta)'
                    : (isWalk ? 'Tramo a pie' : (isBus ? 'Trayecto en Bus' : 'Trayecto en SITVA'))}
                </div>
              </Popup>
            </Polyline>
         );
      });

      polys.push(...markers);
    }

    if (dest && routeDest) {
      const dist = Math.round(getDistanceMeters(dest.lat, dest.lng, routeDest.lat, routeDest.lng));
      const positions = routePaths['walk-dest'] || [[routeDest.lat, routeDest.lng], [dest.lat, dest.lng]];
      polys.push(
        <React.Fragment key="dest-connection">
          <Polyline 
            positions={positions} 
            pathOptions={{ color: '#f43f5e', dashArray: '5, 10', weight: 6, interactive: true }}
          >
            <Popup>
               <div className="p-1">
                 <p className="font-bold text-rose-500">Llegada a destino</p>
                 <p className="text-xs">Distancia final: {dist} metros</p>
                 <p className="text-xs font-semibold">Tiempo: ~{Math.ceil(dist / 80)} min</p>
               </div>
            </Popup>
          </Polyline>
        </React.Fragment>
      );
    }
    return polys;
  };

  const handleClearRoute = () => {
    if (onOriginSelect) onOriginSelect(null);
    if (onDestSelect) onDestSelect(null);
    if (onClearRoute) onClearRoute();
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
          key={darkMode ? 'dark-tiles' : 'light-tiles'}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={darkMode ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
        />
        {!isNavigating && <ZoomControl position="topleft" />}
        <MapController bounds={mapBounds} />
        <MapSelectionController
          mode={mapSelectionMode}
          onSelect={(mode, place) => onMapPlaceSelected?.(mode, place)}
        />
        
        {renderConnections()}
        {renderOriginMarker()}
        {renderDestMarker()}

        {getVisibleStations(stations, currentRoute, isNavigating).map((station, idx) => (
          <Marker 
            key={`${station.id}-${idx}`} 
            position={[station.lat, station.lng]}
            icon={createCustomMarker(getMarkerColor(station.sistema))}
            alt={`Estación ${station.nombre}`}
            title={station.nombre}
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
                      onClick={() => handleComoLlegar(station as Station)}
                      className="min-h-11 w-full bg-sitva-green text-white font-bold py-1.5 rounded-lg text-xs shadow-sm hover:bg-sitva-green/90 transition-colors cursor-pointer"
                    >
                      ¿Cómo llegar?
                    </button>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Live user location marker (blue dot + heading arrow). */}
        <UserLocationMarker
          position={userPosition}
          heading={userHeading}
          follow={followUser}
        />
      </MapContainer>

      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-[1001]">
          <div className="bg-card border border-border p-4 rounded-2xl shadow-xl flex items-center space-x-3">
            <div className="w-6 h-6 border-4 border-sitva-green border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-foreground">Cargando Mapa SITVA...</span>
          </div>
        </div>
      )}
      
      {/* Mobile Vertical controls stack - Positioned higher to avoid bottom sheet overlaps */}
      {!isNavigating && <div className="absolute top-3 right-3 z-[999] flex flex-col gap-2.5 pointer-events-none lg:hidden transition-all duration-300">
        {/* Zoom Controls (Customized for mobile) */}
        <div className="flex flex-col bg-card/90 backdrop-blur-md rounded-2xl shadow-lg border border-border/40 overflow-hidden pointer-events-auto">
          <button 
            onClick={() => {
              const map = (window as any).leafletMap;
              if (map) map.setZoom(map.getZoom() + 1);
            }}
            className="w-11 h-11 flex items-center justify-center text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-border/20 cursor-pointer"
            aria-label="Acercar el mapa"
            title="Acercar el mapa"
          >
            <span className="text-xl font-bold">+</span>
          </button>
          <button 
            onClick={() => {
              const map = (window as any).leafletMap;
              if (map) map.setZoom(map.getZoom() - 1);
            }}
            className="w-11 h-11 flex items-center justify-center text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Alejar el mapa"
            title="Alejar el mapa"
          >
            <span className="text-xl font-bold">−</span>
          </button>
        </div>

        {/* Theme Toggle Button */}
        {onThemeToggle && (
          <button 
            onClick={onThemeToggle}
            className="w-11 h-11 flex items-center justify-center bg-card/90 backdrop-blur-md rounded-2xl shadow-lg border border-border/40 text-foreground pointer-events-auto hover:bg-card transition-all active:scale-95 cursor-pointer"
            title="Cambiar tema"
            aria-label="Cambiar tema del mapa"
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-700" />}
          </button>
        )}

        {/* Legend Button */}
        <div className="relative flex justify-end pointer-events-auto">
          <button 
            onClick={() => setIsLegendExpanded(!isLegendExpanded)}
            className={`w-11 h-11 flex items-center justify-center bg-card/90 backdrop-blur-md rounded-2xl shadow-lg border border-border/40 pointer-events-auto transition-all active:scale-95 cursor-pointer ${isLegendExpanded ? 'text-sitva-blue border-sitva-blue/30 bg-blue-50/20' : 'text-foreground'}`}
            title="Leyendas"
            aria-label={isLegendExpanded ? 'Ocultar leyenda del mapa' : 'Mostrar leyenda del mapa'}
          >
            <MapIcon className="w-5 h-5" />
          </button>
          
          {isLegendExpanded && (
            <div className="absolute right-13 bottom-0 bg-card/95 backdrop-blur-md border border-border/60 shadow-xl rounded-2xl p-3 w-36 flex flex-col gap-2 z-[1000] animate-in fade-in slide-in-from-right-3 duration-250">
              <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-border/10 pb-1">Leyenda</h4>
              <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getMarkerColor('Metro') }}></div>
                  <span className="text-[11px] font-semibold text-foreground/95">Metro</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getMarkerColor('Cable') }}></div>
                  <span className="text-[11px] font-semibold text-foreground/95">Metrocable</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getMarkerColor('Metroplus') }}></div>
                  <span className="text-[11px] font-semibold text-foreground/95">Metroplús</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getMarkerColor('EnCicla') }}></div>
                  <span className="text-[11px] font-semibold text-foreground/95">EnCicla</span>
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp Support compact FAB */}
        <div className="pointer-events-auto">
          <SupportCard compact={true} />
        </div>
      </div>}
      
      {/* Legend Area (Desktop only) */}
      {!isNavigating && <div
        className={`hidden md:flex absolute top-4 right-4 bg-card/95 border border-border backdrop-blur shadow-xl rounded-2xl z-[1000] flex-col transition-all duration-300 pointer-events-auto overflow-hidden ${isLegendExpanded ? 'p-3 w-48' : 'p-2 w-auto hover:bg-card'}`}
      >
         <div className="flex items-center justify-between gap-3">
           <button
             type="button"
             onClick={() => setIsLegendExpanded(!isLegendExpanded)}
             aria-label={isLegendExpanded ? 'Ocultar leyenda del mapa' : 'Mostrar leyenda del mapa'}
             title={isLegendExpanded ? 'Ocultar leyenda del mapa' : 'Mostrar leyenda del mapa'}
             className="flex min-h-11 items-center gap-2 rounded-lg px-1 text-left"
           >
             <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
               <MapIcon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
             </div>
             <h4 className="text-xs font-bold text-foreground whitespace-nowrap">Leyendas</h4>
           </button>
           <button 
             onClick={(e) => {
               e.stopPropagation();
               setIsLegendExpanded(!isLegendExpanded);
             }}
             className="min-h-11 min-w-11 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-1 cursor-pointer"
             aria-label={isLegendExpanded ? 'Contraer leyenda del mapa' : 'Expandir leyenda del mapa'}
             title={isLegendExpanded ? 'Contraer leyenda del mapa' : 'Expandir leyenda del mapa'}
           >
             {isLegendExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
           </button>
         </div>

         {isLegendExpanded && (
           <div className="mt-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full border border-white/50 dark:border-slate-800 shadow-sm" style={{ backgroundColor: getMarkerColor('Metro') }}></div>
                 <span className="text-[11px] font-medium text-foreground/80">Metro</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full border border-white/50 dark:border-slate-800 shadow-sm" style={{ backgroundColor: getMarkerColor('Cable') }}></div>
                 <span className="text-[11px] font-medium text-foreground/80">Metrocable</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full border border-white/50 dark:border-slate-800 shadow-sm" style={{ backgroundColor: getMarkerColor('Metroplus') }}></div>
                 <span className="text-[11px] font-medium text-foreground/80">Metroplús</span>
             </div>
             <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full border border-white/50 dark:border-slate-800 shadow-sm" style={{ backgroundColor: getMarkerColor('EnCicla') }}></div>
                 <span className="text-[11px] font-medium text-foreground/80">EnCicla</span>
             </div>
             
             <div className="mt-2 pt-2 border-t border-border flex items-center gap-2">
               <Info className="w-3 h-3 text-sitva-blue" />
               <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Estaciones: {stations.length}</span>
             </div>
           </div>
         )}
      </div>}
    </div>
  );
}
