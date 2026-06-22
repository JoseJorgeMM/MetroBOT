import { loadStations, Station } from './stations';
import { fetchMetroNews } from './news';
import { loadIntegratedRoutes, matchIntegratedRoutes, IntegratedRoute } from './integratedRoutes';

export type TransportMode = 'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk' | 'bus' | 'bus_articulado';

export interface RouteOption {
  id: string;
  modes: TransportMode[];
  duration: number;
  cost: number;
  transfers: number;
  originStation?: { name: string; lat: number; lng: number; };
  destinationStation?: { name: string; lat: number; lng: number; };
  userOrigin?: { name: string; lat: number; lng: number; };
  userDest?: { name: string; lat: number; lng: number; };
  steps: RouteStep[];
  validation?: {
    ok: boolean;
    validatedSteps: number;
    degradedSteps: number;
    busLegs: Array<{
      routeId: string;
      routeName: string;
      boardingStop: string;
      boardingLat: number;
      boardingLng: number;
      realStops: Array<{ name: string; lat: number; lng: number }>;
    }>;
    degradedReasons: string[];
  };
}

export interface RouteStep {
  instruction: string;
  mode: TransportMode;
  duration: number;
  line?: string;
  station?: { nameRef?: string; name?: string; lat?: number; lng?: number };
  cost?: number;
}

let stationsCache: Station[] = [];

async function getStations() {
  if (stationsCache.length > 0) return stationsCache;
  stationsCache = await loadStations();
  return stationsCache;
}

function routeToBusOption(route: IntegratedRoute, originStationName: string, destStationName: string, prefix: string): RouteOption {
  const firstStop = route.stops[0];
  const lastStop = route.stops[route.stops.length - 1];
  const driveMinutes = Math.min(120, route.stops.length * 2 + 5);
  return {
    id: prefix + '-' + route.id,
    modes: ['walk', 'bus', 'walk'],
    duration: driveMinutes,
    cost: 0,
    transfers: 0,
    originStation: firstStop
      ? { name: firstStop.name, lat: firstStop.lat, lng: firstStop.lng }
      : { name: originStationName, lat: NaN, lng: NaN },
    destinationStation: lastStop
      ? { name: lastStop.name, lat: lastStop.lat, lng: lastStop.lng }
      : { name: destStationName, lat: NaN, lng: NaN },
    userOrigin: { name: originStationName, lat: NaN, lng: NaN },
    userDest: { name: destStationName, lat: NaN, lng: NaN },
    steps: [
      { instruction: 'Camina hasta la parada "' + (firstStop ? firstStop.name : originStationName) + '"', mode: 'walk', duration: 5, cost: 0 },
      { instruction: 'Toma el Bus Integrado ' + route.id + ' (' + route.name + ')', mode: 'bus', duration: driveMinutes - 10, line: route.name, cost: 0 },
      { instruction: 'Baja en "' + (lastStop ? lastStop.name : destStationName) + '" y camina a tu destino', mode: 'walk', duration: 5, cost: 0 }
    ]
  };
}

export async function getRoute(start: string, end: string): Promise<RouteOption[]> {
  const stations = await getStations();
  const startStation = stations.find(s => s.nombre.toLowerCase().indexOf(start.toLowerCase()) !== -1)?.nombre || start;
  const endStation = stations.find(s => s.nombre.toLowerCase().indexOf(end.toLowerCase()) !== -1)?.nombre || end;
  await new Promise(resolve => setTimeout(resolve, 800));

  const results: RouteOption[] = [
    {
      id: 'route-1',
      modes: ['walk', 'metro', 'walk'],
      duration: 22,
      cost: 3430,
      transfers: 0,
      steps: [
        { instruction: 'Walk to ' + startStation + ' Station', mode: 'walk', duration: 4, cost: 0 },
        { instruction: 'Take Metro towards ' + endStation, mode: 'metro', duration: 15, line: 'Linea A', cost: 3430 },
        { instruction: 'Walk to destination', mode: 'walk', duration: 3, cost: 0 }
      ]
    },
    {
      id: 'route-2',
      modes: ['encicla', 'metro', 'walk'],
      duration: 18,
      cost: 3430,
      transfers: 1,
      steps: [
        { instruction: 'Take EnCicla near ' + startStation, mode: 'encicla', duration: 6, cost: 0 },
        { instruction: 'Take Metro to ' + endStation, mode: 'metro', duration: 10, line: 'Linea A', cost: 3430 },
        { instruction: 'Walk to destination', mode: 'walk', duration: 2, cost: 0 }
      ]
    }
  ];

  try {
    const matches = await matchIntegratedRoutes(startStation, endStation);
    for (const route of matches.slice(0, 3)) {
      results.push(routeToBusOption(route, startStation, endStation, 'bus'));
    }
  } catch (e) {
    console.error('Error matching integrated routes:', e);
  }

  return results;
}

export async function getStationStatus(stationId: string): Promise<string> {
  try {
    const news = await fetchMetroNews();
    const stationLower = stationId.toLowerCase();
    const now = new Date();
    const recentNews = news.filter(n => {
      const pubDate = new Date(n.pubDate);
      return (now.getTime() - pubDate.getTime()) < 12 * 60 * 60 * 1000;
    });

    for (const item of recentNews) {
      const title = item.title.toLowerCase();
      if (title.indexOf(stationLower) !== -1 || (stationLower.indexOf('linea') !== -1 && title.indexOf(stationLower) !== -1)) {
        if (title.indexOf('cierre') !== -1 || title.indexOf('cerrada') !== -1 || title.indexOf('fuera de servicio') !== -1) {
          return 'Alerta: ' + item.title + '. Se reporta cierre o suspension.';
        }
        if (title.indexOf('falla') !== -1 || title.indexOf('retraso') !== -1) {
          return 'Aviso: ' + item.title + '. Se reportan retrasos tecnicos.';
        }
      }
    }

    return 'Operacion normal segun los ultimos reportes de noticias.';
  } catch (e) {
    return 'Operacion normal (No se pudo verificar noticias en tiempo real).';
  }
}
