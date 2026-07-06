const fs = require('fs');
const path = require('path');

function calculateDistance(lat1, lng1, lat2, lng2) {
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

function mercatorToWgs84(x, y) {
  const RADIUS = 6378137;
  const lng = (x / RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

// Load official SITVA stations
const officialStations = [];
const METRO_CSV = path.join(__dirname, 'public', 'Estaciones_Sistema_Metro.csv');
if (fs.existsSync(METRO_CSV)) {
  const text = fs.readFileSync(METRO_CSV, 'utf-8');
  const rows = text.trim().split('\n').slice(1);
  for (const row of rows) {
    const cols = row.split(',');
    if (cols.length < 9) continue;
    const x = parseFloat(cols[0]);
    const y = parseFloat(cols[1]);
    const { lat, lng } = mercatorToWgs84(x, y);
    const nombre = cols[6] ? cols[6].replace(/^(Estación|Parada) /, '').replace(/ \(Línea .*\)$/, '').trim() : '';
    officialStations.push({ nombre, lat, lng, sistema: cols[4] });
  }
}

// Load compiled routes
const routesPath = path.join(__dirname, 'public', 'rutas_integradas.json');
if (!fs.existsSync(routesPath)) {
  console.error("rutas_integradas.json not found!");
  process.exit(1);
}

const routes = JSON.parse(fs.readFileSync(routesPath, 'utf-8'));
console.log(`Loaded ${routes.length} routes.`);

let totalStops = 0;
let outlierStopsCount = 0;
const outliersList = [];

for (const r of routes) {
  // Find official stations on this route
  // A route is connected to a station if the stop name matches an official station name (normalized)
  const connectedStations = [];
  
  for (const stop of r.stops) {
    totalStops++;
    const stopNorm = stop.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    for (const s of officialStations) {
      const sNorm = s.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      if (stopNorm.includes(sNorm) || sNorm.includes(stopNorm)) {
        if (!connectedStations.some(cs => cs.nombre === s.nombre)) {
          connectedStations.push(s);
        }
      }
    }
  }

  if (connectedStations.length === 0) {
    // If no explicit station matches, use Loyola or San Antonio as a general center check, or look for the nearest official station to the median of the route stops.
    // But usually routes have matching stations.
    continue;
  }

  // Check each stop on this route
  for (const stop of r.stops) {
    // Find min distance to connected stations
    let minDistConnected = Infinity;
    let closestConnected = null;
    for (const s of connectedStations) {
      const dist = calculateDistance(stop.lat, stop.lng, s.lat, s.lng);
      if (dist < minDistConnected) {
        minDistConnected = dist;
        closestConnected = s;
      }
    }

    // Find min distance to ANY official station in the entire network
    let minDistAny = Infinity;
    for (const s of officialStations) {
      const dist = calculateDistance(stop.lat, stop.lng, s.lat, s.lng);
      if (dist < minDistAny) minDistAny = dist;
    }

    // Outlier check matching clean_geocoding_cache.cjs
    const isOutlier = (minDistConnected > 3500) && (minDistConnected - minDistAny > 2500);

    if (isOutlier && minDistConnected !== Infinity) {
      outlierStopsCount++;
      outliersList.push({
        routeId: r.id,
        stopName: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        distanceKm: (minDistConnected / 1000).toFixed(2),
        closestStation: closestConnected.nombre
      });
    }
  }
}

console.log(`\nTotal stops checked: ${totalStops}`);
console.log(`Outlier stops found: ${outlierStopsCount} (${((outlierStopsCount / totalStops) * 100).toFixed(2)}%)`);

console.log("\nSample Outliers (first 20):");
outliersList.slice(0, 20).forEach(o => {
  console.log(`Route: ${o.routeId} | Stop: "${o.stopName}" | Coords: ${o.lat.toFixed(5)}, ${o.lng.toFixed(5)} | Dist: ${o.distanceKm} km from ${o.closestStation}`);
});

