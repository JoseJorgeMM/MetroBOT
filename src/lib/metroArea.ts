/** Geographic boundary for MetroBOT's current service area: Valle de Aburrá. */
export const metroAreaRestriction = {
  south: 5.95,
  west: -75.82,
  north: 6.45,
  east: -75.30,
} as const;

export type GeoPoint = { lat: number; lng: number };

export function isWithinMetroArea(point: GeoPoint): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat >= metroAreaRestriction.south
    && point.lat <= metroAreaRestriction.north
    && point.lng >= metroAreaRestriction.west
    && point.lng <= metroAreaRestriction.east;
}
