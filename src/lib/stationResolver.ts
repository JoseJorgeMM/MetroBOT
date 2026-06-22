// stationResolver.ts
// -----------------------------------------------------------------------------
// Bridges Gemini's nameRef-only schema to MapComponent's lat/lng-requiring code.
// After Gemini returns render_route, we only have nameRef for stations; we must
// resolve those to coordinates using the official Metro catalog + the real bus
// route stops so the map can draw polylines and markers.
// -----------------------------------------------------------------------------

import { loadIntegratedRoutes, IntegratedStop, IntegratedRoute } from './integratedRoutes';
import { loadStations, Station } from './stations';

export interface ResolvableStation {
  nameRef?: string;
  name?: string;
  lat?: number;
  lng?: number;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

let cachedStations: Promise<Station[]> | null = null;
function getStations(): Promise<Station[]> {
  if (!cachedStations) cachedStations = loadStations();
  return cachedStations;
}

let cachedBusRoutes: Promise<IntegratedRoute[]> | null = null;
function getBusRoutes(): Promise<IntegratedRoute[]> {
  if (!cachedBusRoutes) cachedBusRoutes = loadIntegratedRoutes();
  return cachedBusRoutes;
}

async function findOfficialStation(query: string): Promise<Station | undefined> {
  if (!query) return undefined;
  const stations = await getStations();
  const q = normalize(query);
  for (const s of stations) {
    if (normalize(s.nombre) === q) return s;
  }
  for (const s of stations) {
    const n = normalize(s.nombre);
    if (n.includes(q) || q.includes(n)) return s;
  }
  return undefined;
}

async function findBusStop(query: string, mode: string): Promise<IntegratedStop | undefined> {
  if (!query) return undefined;
  const routes = await getBusRoutes();
  const q = normalize(query);
  const considerBus = mode === 'bus' || mode === 'bus_articulado';
  let best: { stop: IntegratedStop; score: number } | undefined;
  for (const r of routes) {
    for (const stop of r.stops) {
      const n = normalize(stop.name);
      if (n === q) return stop;
      let score = 0;
      if (n.includes(q)) score = q.length / n.length;
      else if (q.includes(n)) score = n.length / q.length;
      if (score > 0 && (considerBus || !considerBus)) {
        if (!best || score > best.score) best = { stop, score };
      }
    }
  }
  return best ? best.stop : undefined;
}

export async function enrichStation(station: ResolvableStation | null | undefined, mode?: string): Promise<ResolvableStation | undefined> {
  if (!station) return station;
  if (typeof station.lat === 'number' && typeof station.lng === 'number' && !isNaN(station.lat) && !isNaN(station.lng)) {
    return station;
  }
  const query = station.nameRef || station.name;
  if (!query) return station;
  const isBus = mode === 'bus' || mode === 'bus_articulado';
  if (isBus) {
    const stop = await findBusStop(query, mode || '');
    if (stop) return { ...station, name: stop.name, lat: stop.lat, lng: stop.lng };
  }
  const official = await findOfficialStation(query);
  if (official) return { ...station, name: official.nombre, lat: official.lat, lng: official.lng };
  const stop = await findBusStop(query, mode || '');
  if (stop) return { ...station, name: stop.name, lat: stop.lat, lng: stop.lng };
  return station;
}
