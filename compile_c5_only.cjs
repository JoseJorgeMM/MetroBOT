// Compiles ONLY the C5 routes and merges them into the existing rutas_integradas.json.
// Reads the existing JSON, preserves all C3/C6 routes unchanged, appends 9 new C5 routes.
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'public', 'bus_routes');
const jsonPath = path.join(__dirname, 'public', 'rutas_integradas.json');
const cachePath = path.join(__dirname, 'public', 'geocoding_cache.json');

const C5_FILES = ['C5-001.csv', 'C5-003.csv', 'C5-004.csv', 'C5-005.csv', 'C5-006.csv', 'C5-007.csv', 'C5-008.csv', 'C5-009.csv', 'C5-010.csv'];

// Load cache
let geocodingCache = {};
if (fs.existsSync(cachePath)) {
  try {
    geocodingCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch (e) {
    console.warn("Could not load geocoding cache, starting fresh.");
  }
}

// Sabaneta / Itagüí manual overrides (same as compile_routes.cjs)
const manualOverrides = {
  "Estación Metro Estrella, Sabaneta, Antioquia": { lat: 6.1583, lng: -75.6106 },
  "Calle 51 Sur, 4883, Est Itag Buses": { lat: 6.1719, lng: -75.6167 },
  "Calle 51 Sur #105 a 103, Sabaneta, Antioquia": { lat: 6.1719, lng: -75.6167 },
  "Carnes Sabanita, Cra. 45 #128, Sabaneta, Antioquia": { lat: 6.1671, lng: -75.6152 },
  "Calle. 68 Sur #45-81, Sabaneta, Antioquia": { lat: 6.1646, lng: -75.6142 },
  "Calle. 68 Sur #45 - 83, Sabaneta, Antioquia": { lat: 6.1646, lng: -75.6142 },
  "Carrera. 45 #72s40, Sabaneta, Antioquia": { lat: 6.1702, lng: -75.6136 },
  "Carrera. 45 #72s40": { lat: 6.1702, lng: -75.6136 },
  "Carrera. 45 #72s-35, Sabaneta, Antioquia": { lat: 6.1705, lng: -75.6136 },
  "Carrera. 45 #71 sur, Sabaneta, Antioquia": { lat: 6.1714, lng: -75.6135 },
  "Carrera. 43A, Alto Las Flores, Sabaneta, Antioquia": { lat: 6.1642, lng: -75.6148 },
  "Carrera. 43C #67S-15, Sabaneta, Antioquia": { lat: 6.1670, lng: -75.6145 },
  "Carrera. 43C, Sabaneta, Antioquia": { lat: 6.1670, lng: -75.6145 },
  "Carrera. 48, Sabaneta, Antioquia": { lat: 6.1651, lng: -75.6115 },
  "Carrera. 49 #61 Sur-303 a 61 Sur-331, Sabaneta, Antioquia": { lat: 6.1684, lng: -75.6107 },
  "Carrera. 29, La Doctora, Sabaneta, Antioquia": { lat: 6.1626, lng: -75.6245 },
  "Calle. 75 Sur #32-45 a 32-3, Sabaneta, Antioquia": { lat: 6.1623, lng: -75.6233 },
  "Calle. 75 Sur #34-366 a 34-446, Sabaneta, Antioquia": { lat: 6.1632, lng: -75.6212 },
  "Calle. 77 Sur #45-2 a 45-76, Sabaneta, Antioquia": { lat: 6.1660, lng: -75.6140 }
};

async function geocode(name) {
  if (manualOverrides[name]) return manualOverrides[name];
  if (geocodingCache[name]) return geocodingCache[name];

  let query = name;
  const addrMatch = name.match(/\(([^)]+)\)/);
  if (addrMatch) {
    query = addrMatch[1];
  }
  // Sabaneta/Itagüí addresses usually include "Sabaneta" or "Antioquia" already; if not, add Medellín as fallback
  const q = query.toLowerCase();
  if (!q.includes('medellin') && !q.includes('medellín') && !q.includes('bello') &&
      !q.includes('sabaneta') && !q.includes('itagüí') && !q.includes('itagui') &&
      !q.includes('estrella') && !q.includes('envigado')) {
    query += ", Medellín";
  }

  // Try Photon
  try {
    const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`, {
      headers: { 'User-Agent': 'MetroBOT-Project-Geocoding/2.1' }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.features && data.features.length > 0) {
        const f = data.features[0];
        const lng = f.geometry.coordinates[0];
        const lat = f.geometry.coordinates[1];
        if (lat > 6.0 && lat < 6.4 && lng > -75.7 && lng < -75.4) {
          const result = { lat, lng };
          geocodingCache[name] = result;
          return result;
        }
      }
    }
  } catch (e) {
    console.error(`Photon error for ${name}:`, e.message);
  }

  return null;
}

async function compileRoute(file) {
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

  console.log(`[${routeId}] ${rawStops.length} stops, geocoding...`);
  let successCount = 0, failCount = 0;
  for (let stop of rawStops) {
    if (!stop.hasCoords) {
      const res = await geocode(stop.name);
      if (res) { stop.lat = res.lat; stop.lng = res.lng; stop.hasCoords = true; successCount++; }
      else { failCount++; }
      // 200ms is enough for Photon (no rate limit)
      await new Promise(r => setTimeout(r, 200));
    }
  }
  console.log(`  -> ${successCount} geocoded, ${failCount} failed`);

  // Linear interpolation between known coords (handles circular routes via wraparound)
  const known = rawStops.map((s, i) => s.hasCoords ? i : -1).filter(i => i !== -1);
  if (known.length >= 2) {
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
      rawStops[i].hasCoords = true;
    }
  } else if (known.length === 1) {
    // Single known point: copy to all
    const k = known[0];
    for (let i = 0; i < rawStops.length; i++) {
      if (!rawStops[i].hasCoords) {
        rawStops[i].lat = rawStops[k].lat;
        rawStops[i].lng = rawStops[k].lng;
        rawStops[i].hasCoords = true;
      }
    }
  }

  return {
    id: routeId,
    name: `Ruta Integrada ${routeId}`,
    stops: rawStops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng }))
  };
}

async function main() {
  // Load existing JSON
  let existing = [];
  if (fs.existsSync(jsonPath)) {
    existing = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`Loaded existing JSON: ${existing.length} routes`);
  }

  const c5Routes = [];
  for (const file of C5_FILES) {
    const route = await compileRoute(file);
    c5Routes.push(route);
  }

  // Merge: remove any existing C5 entries, then append new ones
  const merged = existing.filter(r => !r.id.startsWith('C5-')).concat(c5Routes);

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2));
  fs.writeFileSync(cachePath, JSON.stringify(geocodingCache, null, 2));
  console.log(`\nSuccess! Compiled ${c5Routes.length} C5 routes. Total in JSON: ${merged.length}`);
}

main().catch(console.error);
