// Compiles ONLY the TPC Itagui routes and merges them into rutas_integradas.json.
// Mirrors compile_c5_only.cjs: reuses existing geocoding cache + manual overrides,
// falls back to Photon (komoot) for addresses within the Valle de Aburrá bbox,
// and linearly interpolates between known coords.

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'public', 'rutas_integradas', 'tpc_itagui');
const jsonPath = path.join(__dirname, 'public', 'rutas_integradas.json');
const cachePath = path.join(__dirname, 'public', 'geocoding_cache.json');

if (!fs.existsSync(srcDir)) {
  console.error(`Missing source dir: ${srcDir}`);
  process.exit(1);
}

const FILES = fs.readdirSync(srcDir).filter(f => f.toLowerCase().endsWith('.csv'));

// Load cache
let geocodingCache = {};
if (fs.existsSync(cachePath)) {
  try { geocodingCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')); }
  catch (e) { console.warn('Could not load geocoding cache, starting fresh.'); }
}

// Manual overrides (shared with compile_c5_only.cjs for Itagui / Sabaneta area)
const manualOverrides = {
  'Estación Metro Estrella, Sabaneta, Antioquia': { lat: 6.1583, lng: -75.6106 },
  'Calle 51 Sur, 4883, Est Itag Buses': { lat: 6.1719, lng: -75.6167 },
  'Calle 51 Sur #105 a 103, Sabaneta, Antioquia': { lat: 6.1719, lng: -75.6167 },
  'Carnes Sabanita, Cra. 45 #128, Sabaneta, Antioquia': { lat: 6.1671, lng: -75.6152 },
  'Calle. 68 Sur #45-81, Sabaneta, Antioquia': { lat: 6.1646, lng: -75.6142 },
  'Calle. 68 Sur #45 - 83, Sabaneta, Antioquia': { lat: 6.1646, lng: -75.6142 },
  'Carrera. 45 #72s40, Sabaneta, Antioquia': { lat: 6.1702, lng: -75.6136 },
  'Carrera. 45 #72s40': { lat: 6.1702, lng: -75.6136 },
  'Carrera. 45 #72s-35, Sabaneta, Antioquia': { lat: 6.1705, lng: -75.6136 },
  'Carrera. 45 #71 sur, Sabaneta, Antioquia': { lat: 6.1714, lng: -75.6135 },
  'Carrera. 43A, Alto Las Flores, Sabaneta, Antioquia': { lat: 6.1642, lng: -75.6148 },
  'Carrera. 43C #67S-15, Sabaneta, Antioquia': { lat: 6.1670, lng: -75.6145 },
  'Carrera. 43C, Sabaneta, Antioquia': { lat: 6.1670, lng: -75.6145 },
  'Carrera. 48, Sabaneta, Antioquia': { lat: 6.1651, lng: -75.6115 },
  'Carrera. 49 #61 Sur-303 a 61 Sur-331, Sabaneta, Antioquia': { lat: 6.1684, lng: -75.6107 },
  'Carrera. 29, La Doctora, Sabaneta, Antioquia': { lat: 6.1626, lng: -75.6245 },
  'Calle. 75 Sur #32-45 a 32-3, Sabaneta, Antioquia': { lat: 6.1623, lng: -75.6233 },
  'Calle. 75 Sur #34-366 a 34-446, Sabaneta, Antioquia': { lat: 6.1632, lng: -75.6212 },
  'Calle. 77 Sur #45-2 a 45-76, Sabaneta, Antioquia': { lat: 6.1660, lng: -75.6140 },

  // Itagui landmarks
  'Calle 50, 40, Estación Itagüí Buses': { lat: 6.1719, lng: -75.6167 },
  'Carrera 50a, 23a, Terminal Yarumito': { lat: 6.1612, lng: -75.6224 },
  'Calle 27, Estación Sabaneta Buses': { lat: 6.1505, lng: -75.6180 },
  'Calle 85, 4279, Est Ayurú': { lat: 6.1986, lng: -75.5739 },
  'Carrera 42, 59a, Estación Envigado Buses': { lat: 6.1721, lng: -75.5918 },
  'Cootrasana': { lat: 6.1830, lng: -75.6580 }
};

const metroStationsFile = path.join(__dirname, 'public', 'Estaciones_Sistema_Metro.csv');
const officialStations = [];
if (fs.existsSync(metroStationsFile)) {
  const content = fs.readFileSync(metroStationsFile, 'utf-8');
  const rows = content.trim().split(/\r?\n/).slice(1);
  const RADIUS = 6378137;
  rows.forEach(row => {
    const cols = row.split(',');
    if (cols.length < 9) return;
    const x = parseFloat(cols[0]), y = parseFloat(cols[1]);
    const lng = (x / RADIUS) * (180 / Math.PI);
    const lat = (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) * (180 / Math.PI);
    const nombre = cols[6] ? cols[6].replace(/^(Estación|Parada) /, '').replace(/ \(Línea .*\)$/, '').trim() : '';
    officialStations.push({ nombre, lat, lng });
  });
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in metres
}

function cleanQueryForGeocoding(name, defaultCity) {
  let query = name;
  const addrMatch = name.match(/\(([^)]+)\)/);
  if (addrMatch) {
    query = addrMatch[1];
  }
  
  let city = defaultCity || 'Itagüí';
  const cities = ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'Copacabana', 'Caldas', 'La Estrella', 'Barbosa', 'Girardota'];
  for (const c of cities) {
    const reg = new RegExp(c, 'i');
    if (name.match(reg)) {
      city = c;
      break;
    }
  }

  // Remove existing city/state suffixes from query part
  query = query.replace(/,\s*Medell[ií]n/gi, '')
               .replace(/,\s*Bello/gi, '')
               .replace(/,\s*Itag[uü][ií]/gi, '')
               .replace(/,\s*Envigado/gi, '')
               .replace(/,\s*Sabaneta/gi, '')
               .replace(/,\s*Copacabana/gi, '')
               .replace(/,\s*Caldas/gi, '')
               .replace(/,\s*La Estrella/gi, '')
               .replace(/,\s*Barbosa/gi, '')
               .replace(/,\s*Girardota/gi, '')
               .replace(/,\s*Antioquia/gi, '')
               .trim();

  // Expand abbreviations
  query = query
    .replace(/\bKr\b/gi, 'Carrera')
    .replace(/\bCra\b/gi, 'Carrera')
    .replace(/\bCr\b/gi, 'Carrera')
    .replace(/\bCl\b/gi, 'Calle')
    .replace(/\bCll\b/gi, 'Calle')
    .replace(/\bDiag\b/gi, 'Diagonal')
    .replace(/\bTv\b/gi, 'Transversal')
    .replace(/\bTrans\b/gi, 'Transversal')
    .replace(/\bAv\b\.?/gi, 'Avenida')
    .replace(/\s*-\s*/g, ' con ')
    .replace(/\s*&\s*/g, ' con ')
    .replace(/\s+/g, ' ')
    .trim();

  query += `, ${city}`;
  return query;
}

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}

async function geocode(name, defaultCity) {
  if (manualOverrides[name]) return manualOverrides[name];
  if (geocodingCache[name]) return geocodingCache[name];

  const norm = normalizeName(name);
  for (const s of officialStations) {
    const sNorm = normalizeName(s.nombre);
    if (norm === sNorm || (norm.length > 5 && norm.includes(sNorm) && sNorm.length >= 4)) {
      return { lat: s.lat, lng: s.lng };
    }
  }

  const query = cleanQueryForGeocoding(name, defaultCity);

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
  } catch (e) { console.error(`Photon error for ${name}:`, e.message); }

  return null;
}

async function compileRoute(file) {
  const routeId = file.replace(/\.csv$/i, '');
  const lines = fs.readFileSync(path.join(srcDir, file), 'utf-8')
    .split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
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
      if (cleanName.startsWith('Más horarios') || cleanName.length < 3) continue;
      rawStops.push({ name: cleanName, lat: null, lng: null, hasCoords: false });
    }
  }

  // Identify connected official stations on this route
  const connectedStations = [];
  for (const stop of rawStops) {
    const stopNorm = normalizeName(stop.name);
    for (const s of officialStations) {
      const sNorm = normalizeName(s.nombre);
      if (stopNorm === sNorm || (stopNorm.length > 5 && stopNorm.includes(sNorm) && sNorm.length >= 4)) {
        if (!connectedStations.some(cs => cs.nombre === s.nombre)) {
          connectedStations.push(s);
        }
      }
    }
  }

  console.log(`[${routeId}] ${rawStops.length} stops, geocoding...`);
  let ok = 0, fail = 0;
  for (const stop of rawStops) {
    if (stop.hasCoords) continue;
    const res = await geocode(stop.name, 'Itagüí');
    if (res) {
      // Outlier check:
      let isOutlier = false;
      if (connectedStations.length > 0) {
        let minDistConnected = Infinity;
        for (const s of connectedStations) {
          const dist = calculateDistance(res.lat, res.lng, s.lat, s.lng);
          if (dist < minDistConnected) minDistConnected = dist;
        }

        let minDistAny = Infinity;
        for (const s of officialStations) {
          const dist = calculateDistance(res.lat, res.lng, s.lat, s.lng);
          if (dist < minDistAny) minDistAny = dist;
        }

        // Outlier check using difference logic
        isOutlier = (minDistConnected > 3500) && (minDistConnected - minDistAny > 2500);
      }

      if (!isOutlier) {
        stop.lat = res.lat;
        stop.lng = res.lng;
        stop.hasCoords = true;
        ok++;
      } else {
        fail++;
        console.log(`[Outlier] Discarded geocoded coords for "${stop.name}" (${res.lat.toFixed(5)}, ${res.lng.toFixed(5)})`);
      }
    } else {
      fail++;
    }
    await new Promise(r => setTimeout(r, 180));
  }
  console.log(`  -> ${ok} geocoded, ${fail} failed`);

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
  let existing = [];
  if (fs.existsSync(jsonPath)) {
    existing = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`Loaded existing JSON: ${existing.length} routes`);
  }

  const newRoutes = [];
  for (const file of FILES) {
    const route = await compileRoute(file);
    newRoutes.push(route);
  }

  // Remove any existing TPC Itagui entries (by id prefix), keep C3/C5/C6 intact.
  const tpcItaguiIds = new Set(newRoutes.map(r => r.id));
  const merged = existing.filter(r => !tpcItaguiIds.has(r.id)).concat(newRoutes);

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2));
  fs.writeFileSync(cachePath, JSON.stringify(geocodingCache, null, 2));
  console.log(`\nSuccess! Compiled ${newRoutes.length} TPC Itagui routes. Total in JSON: ${merged.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
