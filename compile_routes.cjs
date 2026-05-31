const fs = require('fs');
const path = require('path');

// Configuration
const srcDir = path.join(__dirname, 'public', 'bus_routes');
const destDir = path.join(__dirname, 'public', 'rutas_integradas');
const jsonPath = path.join(__dirname, 'public', 'rutas_integradas.json');
const cachePath = path.join(__dirname, 'public', 'geocoding_cache.json');

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// 1. Load Geocoding Cache
let geocodingCache = {};
if (fs.existsSync(cachePath)) {
  try {
    geocodingCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch (e) {
    console.warn("Could not load geocoding cache, starting fresh.");
  }
}

// 2. Manual Overrides (High Precision for reported issues)
const manualOverrides = {
  // Belén / Rodeo Area (C3 routes)
  "Estación Parque Belén (Kr 76 - Cl 30, Medellín)": { lat: 6.2312, lng: -75.5908 },
  "Parque Biblioteca Belén (Kr 76 - Cl 19, Medellín)": { lat: 6.2252, lng: -75.5915 },
  "Br. San Bernardo (Kr 76 - Cl 20a, Medellín)": { lat: 6.2235, lng: -75.5918 },
  "Quebrada Chocho (Kr 76 - Cl 27, Medellín)": { lat: 6.2281, lng: -75.5912 },
  "Colegio De La Inmaculada (Kr 76 - Cl 13, Medellín)": { lat: 6.2168, lng: -75.5925 },
  "Br. Rodeo (Kr 79 - Cl 1 Sur, Medellín)": { lat: 6.2105, lng: -75.6001 },
  "Urbanización Quintas De Marbella (Kr 79 - Cl 2b Sur, Medellín)": { lat: 6.2085, lng: -75.6005 },
  "Parroquia Santa María Mazzarello (Kr 79 - Cl 3a Sur, Medellín)": { lat: 6.20745, lng: -75.60101 },
  "Ciudadela El Rodeo (Kr 79 - Cl 3a Sur, Medellín)": { lat: 6.2065, lng: -75.6015 },
  "Urbanización Reserva De San Nicolás (Kr 79 - Cl 6 Sur, Medellín)": { lat: 6.2045, lng: -75.6022 },
  "Urbanización Rodeo Verde (Cl 9b Sur - Kr 79a, Medellín)": { lat: 6.2052, lng: -75.6018 },
  "Br. Belén El Rincón (Kr 78b - Cl 3, Medellín)": { lat: 6.2162, lng: -75.6018 },
  
  // North Area (C6 routes)
  "Estación Acevedo (Cr 52 - Cl 108, Medellín)": { lat: 6.3001, lng: -75.5684 },
  "Hospital Zamora (Cl 21 - Cr 42, Bello)": { lat: 6.3075, lng: -75.5562 },
  "Br. El Playón (Cl 20d - Cr 43c, Bello)": { lat: 6.3115, lng: -75.5642 },
  "Br. Zamora (Cl 20d - Cr 42d, Bello)": { lat: 6.3070, lng: -75.5558 }
};

// 3. Official Stations matching
const metroStationsFile = path.join(__dirname, 'public', 'Estaciones_Sistema_Metro.csv');
const officialStations = [];
if (fs.existsSync(metroStationsFile)) {
  const content = fs.readFileSync(metroStationsFile, 'utf-8');
  const rows = content.trim().split('\n').slice(1);
  const RADIUS = 6378137;
  rows.forEach(row => {
    const cols = row.split(',');
    if (cols.length < 9) return;
    const x = parseFloat(cols[0]), y = parseFloat(cols[1]);
    const lng = (x / RADIUS) * (180 / Math.PI);
    const lat = (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) * (180 / Math.PI);
    const nombre = cols[6] ? cols[6].replace(/^Estación /, '').replace(/ \(Línea .*\)$/, '').trim() : '';
    officialStations.push({ nombre, lat, lng });
  });
}

function normalizeName(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function geocode(name) {
  if (manualOverrides[name]) return manualOverrides[name];
  if (geocodingCache[name]) return geocodingCache[name];

  const norm = normalizeName(name);
  for (const s of officialStations) {
    const sNorm = normalizeName(s.nombre);
    if (norm === sNorm || (norm.length > 5 && sNorm.includes(norm)) || (sNorm.length > 5 && norm.includes(sNorm))) {
      return { lat: s.lat, lng: s.lng };
    }
  }

  let query = name;
  const addrMatch = name.match(/\(([^)]+)\)/);
  if (addrMatch) {
    query = addrMatch[1];
    if (!query.toLowerCase().includes("medellin") && !query.toLowerCase().includes("bello")) query += ", Medellín";
  }

  console.log(`Geocoding: ${query}...`);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'MetroBOT-Project-Geocoding/2.0' }
    });
    if (response.status === 429) {
        console.warn("Rate limited. Waiting 5s...");
        await new Promise(r => setTimeout(r, 5000));
        return null;
    }
    const data = await response.json();
    if (data && data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      if (result.lat > 6.0 && result.lat < 6.4 && result.lng > -75.7 && result.lng < -75.4) {
        geocodingCache[name] = result;
        return result;
      }
    }
  } catch (e) {
    console.error(`Error geocoding ${name}:`, e.message);
  }
  return null;
}

async function main() {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.csv'));
  const compiledRoutes = [];

  for (const file of files) {
    const routeId = file.replace('.csv', '');
    const lines = fs.readFileSync(path.join(srcDir, file), 'utf-8').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const rawStops = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const coordMatch = line.match(/"?\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*"?/);
      if (coordMatch) {
        if (rawStops.length > 0) {
          rawStops[rawStops.length - 1].lat = parseFloat(coordMatch[1]);
          rawStops[rawStops.length - 1].lng = parseFloat(coordMatch[2]);
          rawStops[rawStops.length - 1].hasCoords = true;
        }
      } else {
        const cleanName = line.replace(/^"|"$/g, '').trim();
        if (cleanName.startsWith("Más horarios") || cleanName.length < 3) continue;
        rawStops.push({ name: cleanName, lat: null, lng: null, hasCoords: false });
      }
    }

    console.log(`Route ${routeId}: Geocoding ${rawStops.length} stops...`);
    for (let stop of rawStops) {
      if (!stop.hasCoords) {
        const res = await geocode(stop.name);
        if (res) { stop.lat = res.lat; stop.lng = res.lng; stop.hasCoords = true; }
        if (res && !geocodingCache[stop.name] && !manualOverrides[stop.name]) await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Interpolation
    const known = rawStops.map((s, i) => s.hasCoords ? i : -1).filter(i => i !== -1);
    if (known.length > 0) {
      for (let i = 0; i < rawStops.length; i++) {
        if (rawStops[i].hasCoords) continue;
        let p = -1, n = -1;
        for (let j = i + 1; j < rawStops.length; j++) { if (rawStops[j].hasCoords) { n = j; break; } }
        if (n === -1) n = known[0];
        for (let j = i - 1; j >= 0; j--) { if (rawStops[j].hasCoords) { p = j; break; } }
        if (p === -1) p = known[known.length - 1];
        const dist = (n > p) ? (n - p) : ((rawStops.length - p) + n);
        const fromP = (i > p) ? (i - p) : ((rawStops.length - p) + i);
        const f = fromP / dist;
        rawStops[i].lat = rawStops[p].lat + (rawStops[n].lat - rawStops[p].lat) * f;
        rawStops[i].lng = rawStops[p].lng + (rawStops[n].lng - rawStops[p].lng) * f;
      }
    }

    compiledRoutes.push({ id: routeId, name: `Ruta Integrada ${routeId}`, stops: rawStops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })) });
    fs.writeFileSync(cachePath, JSON.stringify(geocodingCache, null, 2));
  }

  fs.writeFileSync(jsonPath, JSON.stringify(compiledRoutes, null, 2));
  console.log(`Success! Compiled ${compiledRoutes.length} routes.`);
}

main().catch(console.error);
