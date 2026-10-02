import type { RouteOption, TransportMode } from './routing';
import { calculateDistance, type Station } from './stations';
import { validPoint, type TripPoint } from './googleTransit';

export const stationSystem = (system: string): string => ({
  Metro: 'Metro', C: 'Metrocable', Cable: 'Metrocable', MPLUS: 'Metroplús', T: 'Tranvía', EnCicla: 'EnCicla',
}[system] || system);

const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\([^)]*\)/g, '').replace(/\b(estacion|parada)\b/g, '').replace(/[^a-z0-9]/g, '');
const systems: Partial<Record<TransportMode, string[]>> = {
  metro: ['Metro'], metrocable: ['Cable', 'C'], tranvia: ['T'], metroplus: ['MPLUS'],
  bus: ['MPLUS'], bus_articulado: ['MPLUS'], encicla: ['EnCicla'],
};

/** Require both name and compatible system. Proximity alone is never an identity. */
export function matchStation(name: string, point: TripPoint | undefined, mode: TransportMode, stations: Station[]): Station | undefined {
  const matches = stations.filter(station => validPoint(station)
    && systems[mode]?.includes(station.sistema) && normalize(station.nombre) === normalize(name)
    && (!point || calculateDistance(point.lat, point.lng, station.lat, station.lng) <= 300));
  // Without a position, ambiguous station names cannot be resolved safely.
  if (!point) return matches.length === 1 ? matches[0] : undefined;
  return matches.sort((a, b) => calculateDistance(point.lat, point.lng, a.lat, a.lng)
    - calculateDistance(point.lat, point.lng, b.lat, b.lng))[0];
}

export interface StationVisit {
  role: 'Sube aquí' | 'Baja aquí' | 'Estación del trayecto';
  line?: string; time?: string; headsign?: string; stepIndex: number;
}
export interface RouteStop extends TripPoint {
  id: string; name: string; station?: Station; mode: TransportMode; visits: StationVisit[];
}

export function getRouteStops(route: RouteOption, stations: Station[]): RouteStop[] {
  const stops = new Map<string, RouteStop>();
  const add = (name: string | undefined, point: TripPoint | undefined, mode: TransportMode, visit: StationVisit) => {
    if (!name) return;
    const station = matchStation(name, validPoint(point) ? point : undefined, mode, stations);
    const position = validPoint(point) ? point : station;
    if (!validPoint(position)) return;
    const id = station ? `${station.sistema}:${station.id}` : `${mode}:${normalize(name)}:${position.lat.toFixed(5)},${position.lng.toFixed(5)}`;
    const current = stops.get(id);
    if (current) current.visits.push(visit);
    else stops.set(id, { ...position, id, name, station, mode, visits: [visit] });
  };
  route.steps.forEach((step, stepIndex) => {
    const transit = step.transit;
    if (transit) {
      add(transit.departureStop, transit.departureLocation, step.mode, { role: 'Sube aquí', time: transit.departureTime, line: step.line, headsign: transit.headsign, stepIndex });
      add(transit.arrivalStop, transit.arrivalLocation, step.mode, { role: 'Baja aquí', time: transit.arrivalTime, line: step.line, stepIndex });
    } else if (step.mode !== 'walk' && step.station) {
      const point = validPoint(step.station) ? step.station : undefined;
      add(step.station.name || step.station.nameRef, point, step.mode, { role: 'Estación del trayecto', line: step.line, stepIndex });
    }
  });
  return [...stops.values()];
}

export function nearbyStations(point: TripPoint, stations: Station[], excludeId?: string) {
  return stations.filter(station => validPoint(station) && `${station.sistema}:${station.id}` !== excludeId)
    .map(station => ({ station, distance: calculateDistance(point.lat, point.lng, station.lat, station.lng) }))
    .filter(item => item.distance <= 350).sort((a, b) => a.distance - b.distance).slice(0, 4);
}
