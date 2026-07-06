const fs = require('fs');
const path = require('path');

const EARTH_RADIUS_METERS = 6371e3;
const OUTLIER_THRESHOLD_METERS = 3500;
const OUTLIER_DIFFERENCE_METERS = 2500;
const MERCATOR_RADIUS = 6378137;

function calculateDistance(lat1, lng1, lat2, lng2) {
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c; // in metres
}

function mercatorToWgs84(x, y) {
  const lng = (x / MERCATOR_RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

function normalize(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function main() {
  const officialStations = [];
  const METRO_CSV = path.join(__dirname, 'public', 'Estaciones_Sistema_Metro.csv');
  if (!fs.existsSync(METRO_CSV)) {
    console.error(`Fatal Error: METRO_CSV file not found at: ${METRO_CSV}`);
    process.exit(1);
  }

  const text = fs.readFileSync(METRO_CSV, 'utf-8');
  const rows = text.trim().split(/\r?\n/).slice(1);
  for (const row of rows) {
    const cols = row.split(',');
    if (cols.length < 9) continue;
    const x = parseFloat(cols[0]);
    const y = parseFloat(cols[1]);
    const { lat, lng } = mercatorToWgs84(x, y);
    const nombre = cols[6] ? cols[6].replace(/^(Estación|Parada) /, '').replace(/ \(Línea .*\)$/, '').trim() : '';
    officialStations.push({
      nombre,
      lat,
      lng,
      sNorm: normalize(nombre)
    });
  }

  const cachePath = path.join(__dirname, 'public', 'geocoding_cache.json');
  const routesPath = path.join(__dirname, 'public', 'rutas_integradas.json');

  if (!fs.existsSync(cachePath) || !fs.existsSync(routesPath)) {
    console.error("Cache or routes file missing.");
    process.exit(1);
  }

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));

  let deletedCount = 0;
  const toDelete = new Set();

  for (const r of routes) {
    const connectedStations = [];
    for (const stop of r.stops) {
      const stopNorm = normalize(stop.name);
      for (const s of officialStations) {
        if (stopNorm === s.sNorm || (stopNorm.length > 5 && stopNorm.includes(s.sNorm) && s.sNorm.length >= 4)) {
          if (!connectedStations.some(cs => cs.nombre === s.nombre)) {
            connectedStations.push(s);
          }
        }
      }
    }

    if (connectedStations.length === 0) continue;

    for (const stop of r.stops) {
      // Find min distance to connected stations
      let minDistConnected = Infinity;
      for (const s of connectedStations) {
        const dist = calculateDistance(stop.lat, stop.lng, s.lat, s.lng);
        if (dist < minDistConnected) minDistConnected = dist;
      }

      // Find min distance to ANY official station in the entire network
      let minDistAny = Infinity;
      for (const s of officialStations) {
        const dist = calculateDistance(stop.lat, stop.lng, s.lat, s.lng);
        if (dist < minDistAny) minDistAny = dist;
      }

      // Outlier check:
      // Must be further than OUTLIER_THRESHOLD_METERS from connected stations AND
      // significantly closer to some unconnected station (difference > OUTLIER_DIFFERENCE_METERS).
      const isOutlier = (minDistConnected > OUTLIER_THRESHOLD_METERS) && 
                        (minDistConnected - minDistAny > OUTLIER_DIFFERENCE_METERS);

      if (isOutlier && minDistConnected !== Infinity) {
        if (cache[stop.name]) {
          toDelete.add(stop.name);
        }
      }
    }
  }

  for (const name of toDelete) {
    delete cache[name];
    deletedCount++;
    console.log(`Removed outlier: "${name}"`);
  }

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.log(`\nSuccessfully cleaned ${deletedCount} outlier entries from cache.`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

