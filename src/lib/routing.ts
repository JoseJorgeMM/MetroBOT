import { loadStations, Station } from './stations';
import { fetchMetroNews } from './news';

export interface RouteOption {
  id: string;
  modes: ('metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk' | 'bus')[];
  duration: number; // in minutes
  cost: number;
  transfers: number;
  originStation?: { name: string; lat: number; lng: number; };
  destinationStation?: { name: string; lat: number; lng: number; };
  userOrigin?: { name: string; lat: number; lng: number; };
  userDest?: { name: string; lat: number; lng: number; };
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  mode: 'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk' | 'bus';
  duration: number;
  line?: string;
  station?: { name: string; lat: number; lng: number; };
  cost?: number;
}

// Global cache for stations to avoid re-fetching
let stationsCache: Station[] = [];

async function getStations() {
  if (stationsCache.length > 0) return stationsCache;
  stationsCache = await loadStations();
  return stationsCache;
}

export async function getRoute(start: string, end: string): Promise<RouteOption[]> {
  const stations = await getStations();

  // Find matching stations or use defaults
  const startStation = stations.find(s => s.nombre.toLowerCase().includes(start.toLowerCase()))?.nombre || start;
  const endStation = stations.find(s => s.nombre.toLowerCase().includes(end.toLowerCase()))?.nombre || end;

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const results: RouteOption[] = [
    {
      id: 'route-1',
      modes: ['walk', 'metro', 'walk'],
      duration: 22,
      cost: 3430,
      transfers: 0,
      steps: [
        { instruction: `Walk to ${startStation} Station`, mode: 'walk', duration: 4, cost: 0 },
        { instruction: `Take Metro towards ${endStation}`, mode: 'metro', duration: 15, line: 'Línea A', cost: 3430 },
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
        { instruction: `Take EnCicla near ${startStation}`, mode: 'encicla', duration: 6, cost: 0 },
        { instruction: `Take Metro to ${endStation}`, mode: 'metro', duration: 10, line: 'Línea A', cost: 3430 },
        { instruction: 'Walk to destination', mode: 'walk', duration: 2, cost: 0 }
      ]
    }
  ];

  try {
    const response = await fetch('/rutas_integradas.json');
    const integratedRoutes = await response.json();

    const normStart = startStation.toLowerCase();
    const normEnd = endStation.toLowerCase();

    for (const route of integratedRoutes) {
      const hasStart = route.stops.some((s: any) => s.name.toLowerCase().includes(normStart) || normStart.includes(s.name.toLowerCase()));
      const hasEnd = route.stops.some((s: any) => s.name.toLowerCase().includes(normEnd) || normEnd.includes(s.name.toLowerCase()));

      if (hasStart && hasEnd) {
        results.push({
          id: `bus-${route.id}`,
          modes: ['bus'],
          duration: 25, // Estimated duration
          cost: 3430,
          transfers: 0,
          steps: [
            {
              instruction: `Take Integrated Bus ${route.id} from ${startStation}`,
              mode: 'bus',
              duration: 20,
              line: route.name,
              cost: 3430
            },
            {
              instruction: `Get off at ${endStation} and walk to destination`,
              mode: 'walk',
              duration: 5,
              cost: 0
            }
          ]
        });
      }
    }
  } catch (e) {
    console.error('Error loading integrated routes:', e);
  }

  return results;
}

export async function getStationStatus(stationId: string): Promise<string> {
  try {
    const news = await fetchMetroNews();
    const stationLower = stationId.toLowerCase();
    
    // Buscar en las noticias de las últimas 12 horas
    const now = new Date();
    const recentNews = news.filter(n => {
      const pubDate = new Date(n.pubDate);
      return (now.getTime() - pubDate.getTime()) < 12 * 60 * 60 * 1000;
    });

    for (const item of recentNews) {
      const title = item.title.toLowerCase();
      if (title.includes(stationLower) || (stationLower.includes('línea') && title.includes(stationLower))) {
        if (title.includes('cierre') || title.includes('cerrada') || title.includes('fuera de servicio')) {
          return `Alerta: ${item.title}. Se reporta cierre o suspensión.`;
        }
        if (title.includes('falla') || title.includes('retraso')) {
          return `Aviso: ${item.title}. Se reportan retrasos técnicos.`;
        }
      }
    }

    return 'Operación normal según los últimos reportes de noticias.';
  } catch (e) {
    return 'Operación normal (No se pudo verificar noticias en tiempo real).';
  }
}
