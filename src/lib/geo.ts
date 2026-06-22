// ---------------------------------------------------------------------------
// Geospatial helpers for live navigation.
// All points are [lat, lng]. Distances in meters. Bearings in degrees [0,360).
// ---------------------------------------------------------------------------

const R = 6371000; // Earth radius in meters
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export type LatLng = { lat: number; lng: number };
export type LatLngTuple = [number, number];

/** Great-circle distance between two points, in meters (haversine). */
export function distanceTo(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing (compass heading) from a -> b, in degrees [0,360). */
export function bearing(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest absolute angular difference between two headings, in degrees [-180,180]. */
export function headingDelta(a: number, b: number): number {
  let d = ((b - a + 540) % 360) - 180;
  return d;
}

export interface NearestPoint {
  /** Index of the segment start vertex in the path. */
  index: number;
  /** The nearest projected point on the path. */
  point: LatLng;
  /** Perpendicular distance from pos to the path, in meters. */
  distance: number;
  /** Fractional progress [0,1] along the segment containing the projection. */
  fraction: number;
}

/**
 * Project a position onto a polyline: returns the nearest point, the segment
 * index it belongs to, and the perpendicular distance (used to detect when the
 * user has strayed off the route).
 */
export function nearestPointOnPath(pos: LatLng, path: LatLng[]): NearestPoint | null {
  if (path.length === 0) return null;
  if (path.length === 1) return { index: 0, point: { ...path[0] }, distance: distanceTo(pos, path[0]), fraction: 0 };

  let best: NearestPoint | null = null;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const proj = projectSegment(pos, p1, p2);
    if (!best || proj.distance < best.distance) {
      best = { index: i, point: proj.point, distance: proj.distance, fraction: proj.fraction };
    }
  }
  return best;
}

function projectSegment(pos: LatLng, a: LatLng, b: LatLng): { point: LatLng; distance: number; fraction: number } {
  // Local equirectangular approximation (good for short city blocks).
  const xA = a.lng * Math.cos(toRad(a.lat));
  const yA = a.lat;
  const xB = b.lng * Math.cos(toRad((a.lat + b.lat) / 2));
  const yB = b.lat;
  const xP = pos.lng * Math.cos(toRad((a.lat + pos.lat) / 2));
  const yP = pos.lat;

  const dx = xB - xA;
  const dy = yB - yA;
  const lenSq = dx * dx + dy * dy || 1e-12;
  let t = ((xP - xA) * dx + (yP - yA) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = a.lat + t * (b.lat - a.lat);
  const projLng = a.lng + t * (b.lng - a.lng);
  const point = { lat: projLat, lng: projLng };
  return { point, distance: distanceTo(pos, point), fraction: t };
}

/** Cumulative distance along a polyline, in meters. */
export function pathLength(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceTo(path[i - 1], path[i]);
  return total;
}

/** Format a distance for display: "120 m" or "1,2 km". */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  const km = m / 1000;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** Format a duration (seconds) as "X min". */
export function formatDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  return `${min} min`;
}

/** Compass cardinal/intercardinal label for a heading, in Spanish. */
export function cardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(deg / 45) % 8];
}
