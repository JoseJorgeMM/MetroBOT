// MapComponent
// -----------------------------------------------------------------------------
// Cartographic convention for route polylines (SITVA) in MapLibre GL
// -----------------------------------------------------------------------------

import React, { useEffect, useState, useRef } from 'react';
import Map, { Marker, Source, Layer, Popup, MapRef } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { UserLocationMarker } from './UserLocationMarker';
import { Info, ChevronUp, ChevronDown, Map as MapIcon, Sun, Moon, Navigation } from 'lucide-react';
import { loadStations, Station } from '@/src/lib/stations';
import { MapSearch } from './MapSearch';
import { getRouteGeometry } from '@/src/lib/osrm';

import { RouteOption } from '@/src/lib/routing';
import { getVisibleStations } from '@/src/lib/mapStationsFilter';
import { SupportCard } from '../SupportCard';

const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in metres
};

const getMarkerColor = (sistema: string) => {
  const norm = sistema
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  switch (norm) {
    case 'metro':
      return '#00994C';
    case 'cable':
      return '#E31837';
    case 'metroplus':
      return '#8a8d91';
    case 'tranvia':
      return '#00994C';
    case 'encicla':
      return '#00A4E4';
    case 'bus':
      return '#f59e0b'; // Amber for integrated buses
    default:
      return '#94a3b8';
  }
};

const createCustomMarkerHtml = (color: string) => {
  return `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
};

interface MapComponentProps {
  onSearchRoute?: (
    origin: { lat: number; lng: number; name: string },
    dest: { lat: number; lng: number; name: string }
  ) => void;
  origin?: { lat: number; lng: number; name?: string } | null;
  dest?: { lat: number; lng: number; name?: string } | null;
  routes?: RouteOption[];
  activeRouteIndex?: number;
  onOriginSelect?: (coords: { lat: number; lng: number; name?: string } | null) => void;
  onDestSelect?: (coords: { lat: number; lng: number; name?: string } | null) => void;
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
}

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
}: MapComponentProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);
  const [routePaths, setRoutePaths] = useState<{ [key: string]: [number, number][] }>({});
  const [mapBounds, setMapBounds] = useState<any | null>(null);

  const [viewState, setViewState] = useState({
    latitude: 6.2442,
    longitude: -75.5812,
    zoom: 12,
    pitch: 0,
    bearing: 0,
  });

  const [shouldFollow, setShouldFollow] = useState(followUser);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const mapRef = useRef<MapRef>(null);

  // Sync shouldFollow with parent followUser prop
  useEffect(() => {
    setShouldFollow(followUser);
  }, [followUser]);

  useEffect(() => {
    loadStations().then((data) => {
      setStations(data);
      setLoading(false);
    });
  }, []);

  const currentRoute = routes && routes.length > 0 ? routes[activeRouteIndex] : null;
  const routeOrigin = currentRoute ? currentRoute.originStation : null;
  const routeDest = currentRoute ? currentRoute.destinationStation : null;

  useEffect(() => {
    async function updatePaths() {
      const paths: { [key: string]: [number, number][] } = {};
      const allPoints: [number, number][] = [];

      if (origin) allPoints.push([origin.lat, origin.lng]);
      if (dest) allPoints.push([dest.lat, dest.lng]);

      // 1. Walking: Origin -> Route Origin
      if (origin && routeOrigin) {
        const geometry = await getRouteGeometry(
          [
            [origin.lat, origin.lng],
            [routeOrigin.lat, routeOrigin.lng],
          ],
          'foot'
        );
        paths['walk-origin'] = geometry;
        geometry.forEach((p) => allPoints.push(p));
      }

      // 2. Route between stations
      if (currentRoute) {
        const stepPoints: { point: [number, number]; mode: string }[] = [];

        if (routeOrigin) {
          if (origin && (origin.lat !== routeOrigin.lat || origin.lng !== routeOrigin.lng)) {
            stepPoints.push({ point: [routeOrigin.lat, routeOrigin.lng], mode: 'walk' });
          } else {
            stepPoints.push({ point: [routeOrigin.lat, routeOrigin.lng], mode: 'metro' });
          }
          allPoints.push([routeOrigin.lat, routeOrigin.lng]);
        }

        currentRoute.steps.forEach((step) => {
          if (step.station) {
            stepPoints.push({ point: [step.station.lat, step.station.lng], mode: step.mode });
            allPoints.push([step.station.lat, step.station.lng]);
          }
        });

        if (routeDest) {
          const lastMode =
            currentRoute.steps.length > 0
              ? currentRoute.steps[currentRoute.steps.length - 1].mode
              : 'walk';
          stepPoints.push({ point: [routeDest.lat, routeDest.lng], mode: lastMode });
          allPoints.push([routeDest.lat, routeDest.lng]);
        }

        for (let i = 0; i < stepPoints.length - 1; i++) {
          const p1 = stepPoints[i];
          const p2 = stepPoints[i + 1];
          const mode = p2.mode;
          const isFirstSegment = i === 0;
          const isLastSegment = i === stepPoints.length - 2;

          if (
            mode === 'walk' ||
            mode === 'encicla' ||
            mode === 'bus' ||
            mode === 'bus_articulado'
          ) {
            const profile =
              mode === 'bus' || mode === 'bus_articulado'
                ? 'car'
                : mode === 'encicla'
                  ? 'bike'
                  : 'foot';
            const geometry = await getRouteGeometry([p1.point, p2.point], profile);
            const isTransfer = mode === 'walk' && !isFirstSegment && !isLastSegment;
            const key = isTransfer ? `segment-transfer-${i}` : `segment-${mode}-${i}`;
            paths[key] = geometry;
            geometry.forEach((p) => allPoints.push(p));
          } else {
            paths[`segment-straight-${i}`] = [p1.point, p2.point];
            allPoints.push(p1.point);
            allPoints.push(p2.point);
          }
        }
      }

      // 3. Walking: Route Dest -> Destination
      if (dest && routeDest) {
        const geometry = await getRouteGeometry(
          [
            [routeDest.lat, routeDest.lng],
            [dest.lat, dest.lng],
          ],
          'foot'
        );
        paths['walk-dest'] = geometry;
        geometry.forEach((p) => allPoints.push(p));
      }

      setRoutePaths(paths);

      // Set Map bounds if we have points
      if (allPoints.length >= 2) {
        let minLat = Infinity,
          maxLat = -Infinity,
          minLng = Infinity,
          maxLng = -Infinity;
        allPoints.forEach(([lat, lng]) => {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        });
        setMapBounds({
          sw: { lat: minLat, lng: minLng },
          ne: { lat: maxLat, lng: maxLng },
        });
      } else {
        setMapBounds(null);
      }
    }
    updatePaths();
  }, [origin, dest, currentRoute, routeOrigin, routeDest]);

  // Fit camera bounds when route changes and not following user
  useEffect(() => {
    if (mapBounds && mapRef.current && !shouldFollow) {
      mapRef.current.fitBounds([mapBounds.sw.lng, mapBounds.sw.lat, mapBounds.ne.lng, mapBounds.ne.lat], {
        padding: 50,
        maxZoom: 16,
        duration: 1000,
      });
    }
  }, [mapBounds, shouldFollow]);

  // Dynamic Camera follow user position and orientation
  useEffect(() => {
    if (userPosition && shouldFollow) {
      setViewState((prev) => ({
        ...prev,
        latitude: userPosition.lat,
        longitude: userPosition.lng,
        pitch: isNavigating ? 60 : 0,
        bearing: userHeading != null ? userHeading : prev.bearing,
        zoom: isNavigating ? 16 : prev.zoom,
      }));
    }
  }, [userPosition, userHeading, shouldFollow, isNavigating]);

  const handleComoLlegar = (station: Station) => {
    const destCoords = { lat: station.lat, lng: station.lng, name: station.nombre };
    if (onDestSelect) onDestSelect(destCoords);

    if (origin) {
      if (onSearchRoute) {
        onSearchRoute({ lat: origin.lat, lng: origin.lng, name: 'Origen actual' }, destCoords);
      }
    } else {
      if (navigator.geolocation) {
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            let originName = 'Mi ubicación actual';
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
              );
              const data = await res.json();
              originName = data.display_name ? data.display_name.split(',')[0] : originName;
            } catch (e) {
              console.error(e);
            }
            if (onOriginSelect) onOriginSelect({ lat: latitude, lng: longitude, name: originName });
            if (onSearchRoute)
              onSearchRoute({ lat: latitude, lng: longitude, name: originName }, destCoords);
            setLoading(false);
          },
          (error) => {
            setLoading(false);
            console.error(error);
            alert(
              'No se pudo obtener tu ubicación automáticamente. Por favor ingresa tu punto de partida.'
            );
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        alert('Tu navegador no soporta geolocalización. Ingresa tu punto de partida.');
      }
    }
  };

  const handleClearRoute = () => {
    if (onOriginSelect) onOriginSelect(null);
    if (onDestSelect) onDestSelect(null);
    if (onClearRoute) onClearRoute();
  };

  // Convert routePaths to GeoJSON FeatureCollection
  const geojsonFeatures = Object.entries(routePaths).map(([key, coords]) => {
    const isWalk = key.includes('-walk-') || key === 'walk-origin' || key === 'walk-dest';
    const isBus = key.includes('-bus-') || key.includes('-bus_articulado-');
    const isStraight = key.includes('straight');
    const isEncicla = key.includes('-encicla-');
    const isTransfer = key.includes('-transfer-');

    let color = '#3b82f6';
    const segmentIndex = parseInt(key.split('-').pop() || '0');
    const step = currentRoute?.steps[segmentIndex];

    if (isTransfer) {
      color = step ? getMarkerColor(step.mode) : '#f59e0b';
    } else if (isWalk) {
      color = '#10b981';
    } else if (isEncicla) {
      color = '#00A4E4';
    } else if (isBus) {
      color = '#f59e0b';
    } else if (isStraight) {
      color = step ? getMarkerColor(step.mode) : '#94a3b8';
    }

    // Convert from [lat, lng] to [lng, lat]
    const coordinates = coords.map((p) => [p[1], p[0]]);

    return {
      type: 'Feature',
      properties: {
        id: key,
        color: color,
        weight: isTransfer ? 4 : 6,
        dash: isWalk && !isStraight,
      },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    };
  });

  const geojsonData: any = {
    type: 'FeatureCollection',
    features: geojsonFeatures,
  };

  // Marker HTML generators
  const originIconHtml = `<div style="background-color: #ef4444; color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>`;
  const suggestedOriginIconHtml = `<div style="background-color: #10b981; color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>`;
  const destIconHtml = `<div style="background-color: #3b82f6; color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg></div>`;
  const suggestedDestIconHtml = `<div style="background-color: #f59e0b; color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>`;

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => {
          setViewState(evt.viewState);
          if (evt.originalEvent) {
            setShouldFollow(false);
          }
        }}
        style={{ width: '100%', height: '100%' }}
        mapLib={maplibregl as any}
        mapStyle={
          darkMode
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
        }
      >
        {/* Render paths as GeoJSON */}
        {geojsonFeatures.length > 0 && (
          <Source id="route-source" type="geojson" data={geojsonData}>
            <Layer
              id="route-layer"
              type="line"
              paint={{
                'line-color': ['get', 'color'],
                'line-width': ['get', 'weight'],
                'line-opacity': 0.9,
                'line-dasharray': ['case', ['get', 'dash'], ['literal', [2, 2]], ['literal', [1, 0]]],
              }}
            />
          </Source>
        )}

        {/* Start / End / Intermediate points */}
        {origin && (
          <Marker latitude={origin.lat} longitude={origin.lng} anchor="bottom">
            <div dangerouslySetInnerHTML={{ __html: originIconHtml }} />
          </Marker>
        )}

        {dest && (
          <Marker latitude={dest.lat} longitude={dest.lng} anchor="bottom">
            <div dangerouslySetInnerHTML={{ __html: destIconHtml }} />
          </Marker>
        )}

        {routeOrigin && (
          <Marker latitude={routeOrigin.lat} longitude={routeOrigin.lng} anchor="bottom">
            <div dangerouslySetInnerHTML={{ __html: suggestedOriginIconHtml }} />
          </Marker>
        )}

        {routeDest && (
          <Marker latitude={routeDest.lat} longitude={routeDest.lng} anchor="bottom">
            <div dangerouslySetInnerHTML={{ __html: suggestedDestIconHtml }} />
          </Marker>
        )}

        {/* SITVA stations markers */}
        {getVisibleStations(stations, currentRoute, isNavigating).map((station, idx) => (
          <Marker
            key={`${station.id}-${idx}`}
            latitude={station.lat}
            longitude={station.lng}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedStation(station as Station);
            }}
          >
            <div
              className="cursor-pointer"
              dangerouslySetInnerHTML={{ __html: createCustomMarkerHtml(getMarkerColor(station.sistema)) }}
            />
          </Marker>
        ))}

        {/* Selected station popup */}
        {selectedStation && (
          <Popup
            latitude={selectedStation.lat}
            longitude={selectedStation.lng}
            onClose={() => setSelectedStation(null)}
            closeOnClick={false}
            anchor="bottom"
          >
            <div className="p-2 min-w-[200px] font-sans">
              <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getMarkerColor(selectedStation.sistema) }}
                ></div>
                <h3 className="font-bold text-slate-900 text-sm leading-tight m-0">
                  {selectedStation.nombre}
                </h3>
              </div>
              <div className="space-y-1.5 text-[11px] text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Sistema</span>
                  <span className="font-semibold text-slate-700">{selectedStation.sistema}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Línea</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800 border border-slate-200">
                    {selectedStation.linea}
                  </span>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      handleComoLlegar(selectedStation);
                      setSelectedStation(null);
                    }}
                    className="w-full bg-sitva-green text-white font-bold py-1.5 rounded-lg text-xs shadow-sm hover:bg-sitva-green/90 transition-colors cursor-pointer"
                  >
                    ¿Cómo llegar?
                  </button>
                </div>
              </div>
            </div>
          </Popup>
        )}

        {/* User Location indicator */}
        <UserLocationMarker position={userPosition} heading={userHeading} />
      </Map>

      {/* MapSearch overlays Map component hierarchy */}
      <MapSearch
        onRouteSubmit={onSearchRoute}
        onOriginSelect={onOriginSelect}
        onDestSelect={onDestSelect}
        origin={origin}
        dest={dest}
        hasActiveRoute={routes && routes.length > 0}
        onClearRoute={handleClearRoute}
      />

      {loading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-[1001]">
          <div className="bg-card border border-border p-4 rounded-2xl shadow-xl flex items-center space-x-3">
            <div className="w-6 h-6 border-4 border-sitva-green border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-foreground">Cargando Mapa SITVA...</span>
          </div>
        </div>
      )}

      {/* Recenter Button overlays Map component */}
      {!shouldFollow && userPosition && followUser && (
        <button
          onClick={() => setShouldFollow(true)}
          className="absolute bottom-6 right-6 z-[999] flex items-center gap-1.5 px-4 py-2.5 bg-sitva-green text-white font-bold rounded-full shadow-lg hover:bg-sitva-green/90 active:scale-95 transition-all cursor-pointer pointer-events-auto"
        >
          <Navigation className="w-4 h-4 fill-white" />
          <span>Recentrar</span>
        </button>
      )}

      {/* Mobile Vertical controls stack */}
      <div className="absolute top-3 right-3 z-[999] flex flex-col gap-2.5 pointer-events-none lg:hidden transition-all duration-300">
        {/* Zoom Controls */}
        <div className="flex flex-col bg-card/90 backdrop-blur-md rounded-2xl shadow-lg border border-border/40 overflow-hidden pointer-events-auto">
          <button
            onClick={() => {
              setViewState((prev) => ({ ...prev, zoom: Math.min(20, prev.zoom + 1) }));
            }}
            className="w-11 h-11 flex items-center justify-center text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-border/20 cursor-pointer"
          >
            <span className="text-xl font-bold">+</span>
          </button>
          <button
            onClick={() => {
              setViewState((prev) => ({ ...prev, zoom: Math.max(1, prev.zoom - 1) }));
            }}
            className="w-11 h-11 flex items-center justify-center text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
          >
            <MapIcon className="w-5 h-5" />
          </button>

          {isLegendExpanded && (
            <div className="absolute right-13 bottom-0 bg-card/95 backdrop-blur-md border border-border/60 shadow-xl rounded-2xl p-3 w-36 flex flex-col gap-2 z-[1000] animate-in fade-in slide-in-from-right-3 duration-250">
              <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-border/10 pb-1">
                Leyenda
              </h4>
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
      </div>

      {/* Legend Area (Desktop only) */}
      <div
        className={`hidden md:flex absolute top-4 right-4 bg-card/95 border border-border backdrop-blur shadow-xl rounded-2xl z-[1000] flex-col transition-all duration-300 pointer-events-auto overflow-hidden ${isLegendExpanded ? 'p-3 w-48' : 'p-2 w-auto cursor-pointer hover:bg-card'}`}
        onClick={() => !isLegendExpanded && setIsLegendExpanded(true)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <MapIcon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </div>
            <h4 className="text-xs font-bold text-foreground whitespace-nowrap">Leyendas</h4>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsLegendExpanded(!isLegendExpanded);
            }}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-1 cursor-pointer"
          >
            {isLegendExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

        {isLegendExpanded && (
          <div className="mt-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full border border-white/50 dark:border-slate-800 shadow-sm"
                style={{ backgroundColor: getMarkerColor('Metro') }}
              ></div>
              <span className="text-[11px] font-medium text-foreground/80">Metro</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full border border-white/50 dark:border-slate-800 shadow-sm"
                style={{ backgroundColor: getMarkerColor('Cable') }}
              ></div>
              <span className="text-[11px] font-medium text-foreground/80">Metrocable</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full border border-white/50 dark:border-slate-800 shadow-sm"
                style={{ backgroundColor: getMarkerColor('Metroplus') }}
              ></div>
              <span className="text-[11px] font-medium text-foreground/80">Metroplús</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full border border-white/50 dark:border-slate-800 shadow-sm"
                style={{ backgroundColor: getMarkerColor('EnCicla') }}
              ></div>
              <span className="text-[11px] font-medium text-foreground/80">EnCicla</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
