import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { RouteOption } from '../../lib/routing';
import { decodePolyline, googleDirectionsUrl } from '../../lib/googleTransit';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';
import type { PlaceValue, PlannerField } from '../TripPlannerPanel';
import { getStations, type Station } from '../../lib/stations';
import { getRouteStops, nearbyStations, type RouteStop } from '../../lib/routeStations';
import { createMapPointOverlay } from '../../lib/mapPointOverlay';
import { StationDialog } from './StationDialog';

export function GoogleTransitMap({ route, onClear, mapSelectionMode, onMapPlaceSelected, bottomInset, panelExpanded }: {
  route: RouteOption; onClear: () => void;
  mapSelectionMode: PlannerField | null;
  onMapPlaceSelected: (field: PlannerField, place: PlaceValue) => void;
  bottomInset: string;
  panelExpanded: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [stations, setStations] = useState<Station[]>([]);
  const [selected, setSelected] = useState<{ route: RouteOption; stop: RouteStop } | null>(null);
  const markerButton = useRef<HTMLButtonElement | null>(null);
  const stops = useMemo(() => getRouteStops(route, stations), [route, stations]);
  const activeStop = selected?.route === route ? selected.stop : null;
  const closeStation = () => { setSelected(null); markerButton.current?.focus(); };
  useEffect(() => { let active = true; getStations().then(items => { if (active) setStations(items); }); return () => { active = false; }; }, []);
  const selection = useRef({ mapSelectionMode, onMapPlaceSelected });
  selection.current = { mapSelectionMode, onMapPlaceSelected };

  useEffect(() => {
    let cancelled = false;
    let instance: any;
    let listener: any;
    const globals = window as unknown as Record<string, any>;
    let previousAuthFailure: any;
    setError('');
    loadGoogleMaps().then(maps => {
      if (cancelled || !container.current) return;
      previousAuthFailure = globals.gm_authFailure;
      globals.gm_authFailure = () => setError('Google rechazó la clave del mapa. Revisa las restricciones de dominio y la facturación.');
      instance = new maps.Map(container.current, {
        center: { lat: 6.2442, lng: -75.5812 }, zoom: 13,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        clickableIcons: false, gestureHandling: 'greedy',
      });
      listener = instance.addListener('click', (event: any) => {
        const current = selection.current;
        if (current.mapSelectionMode && event.latLng) current.onMapPlaceSelected(current.mapSelectionMode, {
          lat: event.latLng.lat(), lng: event.latLng.lng(), name: 'Punto seleccionado en el mapa',
        });
      });
      setMap(instance);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => {
      cancelled = true; listener?.remove();
      if (instance) { window.google?.maps?.event.clearInstanceListeners(instance); globals.gm_authFailure = previousAuthFailure; }
    };
  }, [attempt]);

  useEffect(() => {
    if (!map) return;
    const maps = window.google.maps;
    const overlays: any[] = [];
    try {
      const points = decodePolyline(route.googlePolyline || '');
      const bounds = new maps.LatLngBounds();
      points.forEach(point => bounds.extend(point));
      const completeSteps = route.steps.every(step => !!step.googlePolyline);
      const segments = completeSteps ? route.steps : [{ googlePolyline: route.googlePolyline, mode: 'transit' }];
      segments.forEach(step => overlays.push(new maps.Polyline({
        map, path: decodePolyline(step.googlePolyline || ''), strokeColor: step.mode === 'walk' ? '#64748b' : '#087f5b',
        strokeOpacity: 0.95, strokeWeight: step.mode === 'walk' ? 4 : 7,
      })));
      for (const [point, kind, label] of [[route.userOrigin, 'origin', 'Origen'], [route.userDest, 'destination', 'Llegada']] as const) {
        if (point) {
          overlays.push(createMapPointOverlay(maps, map, point, kind, `${label}: ${point.name}`));
          bounds.extend(point);
        }
      }
      map.fitBounds(bounds, 48);
    } catch { setError('No se pudo representar el recorrido. Consulta sus instrucciones o ábrelo en Google Maps.'); }
    return () => overlays.forEach(overlay => overlay.setMap(null));
  }, [map, route, bottomInset, panelExpanded]);

  useEffect(() => {
    if (!map) return;
    const overlays = stops.map(stop => createMapPointOverlay(window.google.maps, map, stop, 'station', `Ver estación ${stop.name}`, button => {
      if (selection.current.mapSelectionMode) return;
      markerButton.current = button;
      setSelected({ route, stop });
    }));
    return () => overlays.forEach(overlay => overlay.setMap(null));
  }, [map, route, stops]);

  const url = route.userOrigin && route.userDest ? googleDirectionsUrl(route.userOrigin, route.userDest) : undefined;
  return <div className={`${panelExpanded ? 'hidden lg:block' : ''} absolute inset-0 bg-slate-100`} aria-label="Mapa de rutas de Google Maps" style={{ '--google-map-bottom': bottomInset } as CSSProperties}>
    {/* Leave the map's own attribution above the mobile bottom sheet. */}
    <div ref={container} className="absolute inset-x-0 top-0 bottom-[var(--google-map-bottom)] lg:bottom-0" />
    <div className="absolute left-3 top-3 right-3 flex flex-wrap gap-2">
      <span translate="no" className="rounded-lg bg-white px-3 py-2 text-sm text-slate-800 shadow">Google Maps</span>
      <button type="button" onClick={onClear} className="min-h-11 rounded-lg bg-white px-3 text-sm text-slate-800 shadow">Nuevo trayecto</button>
      {mapSelectionMode && <span className="rounded-lg bg-white p-3 text-sm text-slate-800">Toca el mapa para elegir {mapSelectionMode === 'origin' ? 'origen' : 'destino'}.</span>}
    </div>
    {activeStop && !mapSelectionMode && <StationDialog onClose={closeStation} stop={activeStop} source="google" nearby={nearbyStations(activeStop, stations, activeStop.station ? `${activeStop.station.sistema}:${activeStop.station.id}` : undefined)} onNearby={station => setSelected({ route, stop: {
          id: `${station.sistema}:${station.id}`, name: station.nombre, lat: station.lat, lng: station.lng, station, mode: station.sistema === 'EnCicla' ? 'encicla' : 'transit', visits: [],
        } })} />}
    {error && <div role="alert" className="absolute top-20 left-3 right-3 rounded-xl bg-white p-4 text-sm text-slate-900 shadow">
      <p>{error}</p>
      <button type="button" className="mr-4 min-h-11 underline" onClick={() => { setMap(null); setAttempt(value => value + 1); }}>Reintentar mapa</button>
      {url && <a href={url} target="_blank" rel="noreferrer" className="underline">Abrir en Google Maps</a>}
    </div>}
  </div>;
}
