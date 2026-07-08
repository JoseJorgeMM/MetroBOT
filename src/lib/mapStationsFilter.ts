// src/lib/mapStationsFilter.ts
// -----------------------------------------------------------------------------
// Pure helpers for filtering which stations appear on the map during active
// navigation. Mirrors tests/_map_stations_filter_impl.mjs so the same logic is
// tested deterministically in Node and reused at runtime in the browser.
// -----------------------------------------------------------------------------

export interface StationLite {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  sistema?: string;
  linea?: string;
}

export interface RouteStation {
  name: string;
  lat?: number;
  lng?: number;
}

export interface RouteStepStation {
  name?: string;
  nameRef?: string;
  lat?: number;
  lng?: number;
}

export interface RouteLite {
  originStation?: RouteStation | null;
  destinationStation?: RouteStation | null;
  steps?: Array<{ station?: RouteStepStation | null } | null | undefined>;
}

export function getVisibleStations(
  allStations: StationLite[] | null | undefined,
  route: RouteLite | null | undefined,
  isNavigating: boolean,
): StationLite[] {
  if (!Array.isArray(allStations)) return [];
  if (!isNavigating) return allStations.slice();

  const keep = new Set<string>();
  if (route) {
    if (route.originStation && route.originStation.name) {
      keep.add(normalizeName(route.originStation.name));
    }
    if (route.destinationStation && route.destinationStation.name) {
      keep.add(normalizeName(route.destinationStation.name));
    }
    if (Array.isArray(route.steps)) {
      for (const step of route.steps) {
        if (!step || !step.station) continue;
        const name = step.station.nameRef || step.station.name;
        if (name) keep.add(normalizeName(name));
      }
    }
  }

  return allStations.filter((s) => {
    if (!s || !s.nombre) return false;
    return keep.has(normalizeName(s.nombre));
  });
}

function normalizeName(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}