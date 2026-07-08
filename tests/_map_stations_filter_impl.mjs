// tests/_map_stations_filter_impl.mjs
// Pure logic for filtering visible stations during navigation.
// Mirrors the contract consumed by src/components/Map/MapComponent.tsx.

/**
 * Decide which stations should be visible on the map.
 *
 * - If `isNavigating` is false, all stations are shown (default behavior).
 * - If `isNavigating` is true, only stations referenced by the active route
 *   are shown (origin, destination, and every intermediate transfer point).
 *   If no active route is present, the map shows zero stations (full focus).
 *
 * A station "matches" a route station by id when both are present. The
 * intermediate transfer points are extracted from
 * `route.steps[*].station.nameRef` (preferred) or `route.steps[*].station.name`
 * (fallback). Match is by name, normalized (case-insensitive, accent-stripped).
 */
export function getVisibleStations(allStations, route, isNavigating) {
  if (!Array.isArray(allStations)) return [];
  if (!isNavigating) return allStations.slice();

  // Collect the names of stations that should remain visible.
  const keep = new Set();

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

function normalizeName(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}