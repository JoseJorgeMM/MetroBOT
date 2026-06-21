// Integrated bus routes loader.
//
// The app fetches a single JSON file (public/rutas_integradas.json) that
// already contains the geocoded stops for every C3/C5/C6/TPC/Ruta Integrada
// route. This module exposes:
//   - loadIntegratedRoutes(): cached Promise of the parsed JSON.
//   - findIntegratedRoutesNear(lat, lng, radius): routes whose stops fall
//     inside `radius` meters of the given point, sorted by closest stop.
//   - matchIntegratedRoutes(originName, destName): routes that contain
//     stops matching the origin/destination names (used by routing.ts).
//
// Stop coords in the JSON are guaranteed to be numbers (legacy null-coord
// stops are pruned by compile_new_routes.cjs). If you ever add new routes
// with un-geocoded names, re-run `node compile_new_routes.cjs`.
import { calculateDistance } from './stations';

export interface IntegratedStop {
  name: string;
  lat: number;
  lng: number;
}

export interface IntegratedRoute {
  id: string;
  name: string;
  folder?: string;
  sourceFile?: string;
  stops: IntegratedStop[];
  geocodedOk?: number;
  geocodedFail?: number;
}

let cached: Promise<IntegratedRoute[]> | null = null;

export function loadIntegratedRoutes(): Promise<IntegratedRoute[]> {
  if (cached) return cached;
  cached = (async () => {
    try {
      const res = await fetch('/rutas_integradas.json');
      if (!res.ok) {
        console.warn('rutas_integradas.json fetch failed:', res.status);
        return [];
      }
      const data = await res.json();
      // Defensive: drop any stop whose coordinates are not numbers.
      const cleaned: IntegratedRoute[] = [];
      for (const r of data as IntegratedRoute[]) {
        const validStops = (r.stops || []).filter(
          (s) => typeof s.lat === 'number' && typeof s.lng === 'number' && !isNaN(s.lat) && !isNaN(s.lng)
        );
        if (validStops.length >= 2) {
          cleaned.push({ ...r, stops: validStops });
        }
      }
      console.log('[integratedRoutes] loaded', cleaned.length, 'routes');
      return cleaned;
    } catch (e) {
      console.error('Error loading integrated routes:', e);
      return [];
    }
  })();
  return cached;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface IntegratedNearbyHit {
  route: IntegratedRoute;
  closestStop: IntegratedStop;
  distance: number; // meters
}

export async function findIntegratedRoutesNear(
  lat: number,
  lng: number,
  radiusMeters = 1200
): Promise<IntegratedNearbyHit[]> {
  const routes = await loadIntegratedRoutes();
  const hits: IntegratedNearbyHit[] = [];
  for (const r of routes) {
    let best: IntegratedNearbyHit | null = null;
    for (const stop of r.stops) {
      const d = calculateDistance(lat, lng, stop.lat, stop.lng);
      if (d <= radiusMeters && (!best || d < best.distance)) {
        best = { route: r, closestStop: stop, distance: d };
      }
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => a.distance - b.distance);
  return hits;
}

export async function matchIntegratedRoutes(
  originName: string,
  destName: string
): Promise<IntegratedRoute[]> {
  const routes = await loadIntegratedRoutes();
  const normOrigin = normalize(originName);
  const normDest = normalize(destName);
  const out: IntegratedRoute[] = [];
  for (const r of routes) {
    let hasOrigin = false;
    let hasDest = false;
    for (const stop of r.stops) {
      const n = normalize(stop.name);
      if (!hasOrigin && (n.includes(normOrigin) || normOrigin.includes(n))) hasOrigin = true;
      if (!hasDest && (n.includes(normDest) || normDest.includes(n))) hasDest = true;
      if (hasOrigin && hasDest) break;
    }
    if (hasOrigin && hasDest) out.push(r);
  }
  return out;
}

export async function findIntegratedRoutesPassingThrough(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  radiusMeters = 1500
): Promise<Array<IntegratedRoute & { originHit: IntegratedStop; destHit: IntegratedStop; originDist: number; destDist: number }>> {
  const routes = await loadIntegratedRoutes();
  const out: Array<IntegratedRoute & { originHit: IntegratedStop; destHit: IntegratedStop; originDist: number; destDist: number }> = [];
  for (const r of routes) {
    let originHit: IntegratedStop | null = null;
    let destHit: IntegratedStop | null = null;
    let originDist = Infinity;
    let destDist = Infinity;
    for (const stop of r.stops) {
      const dO = calculateDistance(originLat, originLng, stop.lat, stop.lng);
      if (dO < originDist) {
        originDist = dO;
        originHit = stop;
      }
      const dD = calculateDistance(destLat, destLng, stop.lat, stop.lng);
      if (dD < destDist) {
        destDist = dD;
        destHit = stop;
      }
    }
    if (originHit && destHit && originDist <= radiusMeters && destDist <= radiusMeters) {
      // Make sure the origin stop comes BEFORE the destination stop along the route.
      const oIdx = r.stops.indexOf(originHit);
      const dIdx = r.stops.indexOf(destHit);
      if (oIdx !== -1 && dIdx !== -1 && oIdx < dIdx) {
        out.push(Object.assign({}, r, { originHit, destHit, originDist, destDist }));
      }
    }
  }
  out.sort((a, b) => (a.originDist + a.destDist) - (b.originDist + b.destDist));
  return out;
}
