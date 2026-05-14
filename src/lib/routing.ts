import { loadStations, Station } from './stations';

export interface RouteOption {
  id: string;
  modes: ('metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk')[];
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
  mode: 'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk';
  duration: number;
  line?: string;
  station?: { name: string; lat: number; lng: number; };
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

  // Mock response using real names
  return [
    {
      id: 'route-1',
      modes: ['walk', 'metro', 'walk'],
      duration: 22,
      cost: 3430,
      transfers: 0,
      steps: [
        { instruction: `Walk to ${startStation} Station`, mode: 'walk', duration: 4 },
        { instruction: `Take Metro towards ${endStation}`, mode: 'metro', duration: 15, line: 'Línea A' },
        { instruction: 'Walk to destination', mode: 'walk', duration: 3 }
      ]
    },
    {
      id: 'route-2',
      modes: ['encicla', 'metro', 'walk'],
      duration: 18,
      cost: 3430,
      transfers: 1,
      steps: [
        { instruction: `Take EnCicla near ${startStation}`, mode: 'encicla', duration: 6 },
        { instruction: `Take Metro to ${endStation}`, mode: 'metro', duration: 10, line: 'Línea A' },
        { instruction: 'Walk to destination', mode: 'walk', duration: 2 }
      ]
    }
  ];
}

export async function getStationStatus(stationId: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const normalizedId = stationId.toLowerCase();
  
  if (normalizedId.includes('cable') || normalizedId.includes('arvi') || normalizedId.includes('h') || normalizedId.includes('k') || normalizedId.includes('j')) {
    // Randomly mock some issues for certain systems to show functionality
    if (Math.random() > 0.7) {
      return 'Service suspended due to adverse weather conditions (Lightning/Wind).';
    }
  }
  return 'Operating normally.';
}
