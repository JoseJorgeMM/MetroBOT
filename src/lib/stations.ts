export interface Station {
  id: string;
  lat: number;
  lng: number;
  sistema: string;
  nombre: string;
  linea: string;
}

const RADIUS = 6378137;

function mercatorToWgs84(x: number, y: number) {
  const lng = (x / RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

export async function loadStations(): Promise<Station[]> {
  try {
    const allStations: Station[] = [];

    // Load Metro stations
    const metroRes = await fetch('/Estaciones_Sistema_Metro.csv');
    if (metroRes.ok) {
      const text = await metroRes.text();
      const rows = text.trim().split('\n').slice(1);
      
      const metroStations = rows.map((row, index) => {
        const cols = row.split(',');
        const x = parseFloat(cols[0]);
        const y = parseFloat(cols[1]);
        const { lat, lng } = mercatorToWgs84(x, y);
        
        return {
          id: cols[7] || `metro-${index}`,
          lat,
          lng,
          sistema: cols[4],
          nombre: cols[6] ? cols[6].replace(/^Estación /, '').replace(/ \(Línea .*\)$/, '') : 'Desconocida',
          linea: cols[8] || ''
        };
      });

      // Deduplicate stations
      const uniqueMetroStations = metroStations.reduce((acc, current) => {
        const isDuplicate = acc.find(item => item.nombre === current.nombre && item.sistema === current.sistema);
        if (!isDuplicate) {
          return acc.concat([current]);
        }
        return acc;
      }, [] as Station[]);

      allStations.push(...uniqueMetroStations);
    }

    // Load EnCicla stations
    const enciclaRes = await fetch('/Estaciones_En_Cicla.csv');
    if (enciclaRes.ok) {
      const text = await enciclaRes.text();
      const rows = text.trim().split('\n').slice(1);
      
      const enciclaStations = rows.map((row, index) => {
        const match = row.match(/"([^"]+)"/);
        let lat = 0;
        let lng = 0;
        
        if (match && match[1]) {
           const coords = match[1].split(';');
           if (coords.length === 2) {
             lat = parseFloat(coords[0].replace(',', '.'));
             lng = parseFloat(coords[1].replace(',', '.'));
           }
        }
        
        const cols = row.split(',');
        
        return {
          id: `encicla-${cols[0] || index}`,
          lat,
          lng,
          sistema: 'EnCicla',
          nombre: cols[1] || 'Estación EnCicla',
          linea: cols[3] || 'Bicis'
        };
      }).filter(s => s.lat !== 0 && s.lng !== 0);
      
      allStations.push(...enciclaStations);
    }

    // Load Integrated routes
    try {
      const integratedRes = await fetch('/rutas_integradas.json');
      if (integratedRes.ok) {
        const routes = await integratedRes.json();
        routes.forEach((route: any) => {
          route.stops.forEach((stop: any, idx: number) => {
            allStations.push({
              id: `integrado-${route.id}-${idx}`,
              lat: stop.lat,
              lng: stop.lng,
              sistema: 'Metroplús',
              nombre: stop.name,
              linea: route.id
            });
          });
        });
      }
    } catch (e) {
      console.error("Error loading integrated routes in loadStations:", e);
    }

    return allStations;
  } catch (error) {
    console.error("Error loading stations:", error);
    return [];
  }
}

let stationsCache: Station[] | null = null;

export async function getStations(): Promise<Station[]> {
  if (stationsCache) return stationsCache;
  stationsCache = await loadStations();
  return stationsCache;
}

export async function getNearbyStations(lat: number, lng: number, limit: number = 5): Promise<Station[]> {
  const stations = await getStations();
  return stations
    .map(s => ({ ...s, distance: calculateDistance(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
