// compile_new_routes.cjs (v2)
// -----------------------------------------------------------------------------
// Compiles CSVs from public/rutas_integradas/ subfolders (everything NOT yet
// in public/rutas_integradas.json) into that JSON, reusing the same geocoding
// pipeline as compile_routes.cjs / compile_tpc_itagui.cjs.
//
// IMPORTANT: The "inline coord" detector now ONLY treats a line as a real
// coordinate when both numbers are in the Valle de Aburr\u00e1 bbox
// (lat in [6, 6.5], lng in [-76, -75]). This prevents stop names like
// "Avenida 42, 65, Niqu\u00eda" from being mis-parsed as (42, 65).
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const INTEGRADAS_DIR = path.join(PUBLIC_DIR, 'rutas_integradas');
const MANIFEST_PATH = path.join(INTEGRADAS_DIR, 'manifest.json');
const JSON_PATH = path.join(PUBLIC_DIR, 'rutas_integradas.json');
const CACHE_PATH = path.join(PUBLIC_DIR, 'geocoding_cache.json');
const METRO_CSV = path.join(PUBLIC_DIR, 'Estaciones_Sistema_Metro.csv');

const RADIUS = 6378137;

function mercatorToWgs84(x, y) {
  const lng = (x / RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

function normalize(name) {
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isInlineCoordLine(text) {
  if (!/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(text.trim())) return false;
  const parts = text.trim().split(',').map(s => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some(n => isNaN(n))) return false;
  const [lat, lng] = parts;
  return lat >= 6.0 && lat <= 6.5 && lng >= -76.0 && lng <= -75.4;
}

const manualOverrides = {
  "Estaci\u00f3n Parque Bel\u00e9n (Kr 76 - Cl 30, Medell\u00edn)": { lat: 6.2312, lng: -75.5908 },
  "Parque Biblioteca Bel\u00e9n (Kr 76 - Cl 19, Medell\u00edn)": { lat: 6.2252, lng: -75.5915 },
  "Br. San Bernardo (Kr 76 - Cl 20a, Medell\u00edn)": { lat: 6.2235, lng: -75.5918 },
  "Quebrada Chocho (Kr 76 - Cl 27, Medell\u00edn)": { lat: 6.2281, lng: -75.5912 },
  "Colegio De La Inmaculada (Kr 76 - Cl 13, Medell\u00edn)": { lat: 6.2168, lng: -75.5925 },
  "Br. Rodeo (Kr 79 - Cl 1 Sur, Medell\u00edn)": { lat: 6.2105, lng: -75.6001 },
  "Urbanizaci\u00f3n Quintas De Marbella (Kr 79 - Cl 2b Sur, Medell\u00edn)": { lat: 6.2085, lng: -75.6005 },
  "Parroquia Santa Mar\u00eda Mazzarello (Kr 79 - Cl 3a Sur, Medell\u00edn)": { lat: 6.20745, lng: -75.60101 },
  "Ciudadela El Rodeo (Kr 79 - Cl 3a Sur, Medell\u00edn)": { lat: 6.2065, lng: -75.6015 },
  "Urbanizaci\u00f3n Reserva De San Nicol\u00e1s (Kr 79 - Cl 6 Sur, Medell\u00edn)": { lat: 6.2045, lng: -75.6022 },
  "Urbanizaci\u00f3n Rodeo Verde (Cl 9b Sur - Kr 79a, Medell\u00edn)": { lat: 6.2052, lng: -75.6018 },
  "Br. Bel\u00e9n El Rinc\u00f3n (Kr 78b - Cl 3, Medell\u00edn)": { lat: 6.2162, lng: -75.6018 },

  "Estaci\u00f3n Acevedo (Cr 52 - Cl 108, Medell\u00edn)": { lat: 6.3001, lng: -75.5684 },
  "Hospital Zamora (Cl 21 - Cr 42, Bello)": { lat: 6.3075, lng: -75.5562 },
  "Br. El Play\u00f3n (Cl 20d - Cr 43c, Bello)": { lat: 6.3115, lng: -75.5642 },
  "Br. Zamora (Cl 20d - Cr 42d, Bello)": { lat: 6.3070, lng: -75.5558 },

  "Estaci\u00f3n Metro Estrella, Sabaneta, Antioquia": { lat: 6.1583, lng: -75.6106 },
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
  "Calle. 77 Sur #45-2 a 45-76, Sabaneta, Antioquia": { lat: 6.1660, lng: -75.6140 },

  "Calle 50, 40, Estaci\u00f3n Itag\u00fc\u00ed Buses": { lat: 6.1719, lng: -75.6167 },
  "Carrera 50a, 23a, Terminal Yarumito": { lat: 6.1612, lng: -75.6224 },
  "Calle 27, Estaci\u00f3n Sabaneta Buses": { lat: 6.1505, lng: -75.6180 },
  "Calle 85, 4279, Est Ayur\u00fa": { lat: 6.1986, lng: -75.5739 },
  "Carrera 42, 59a, Estaci\u00f3n Envigado Buses": { lat: 6.1721, lng: -75.5918 },
  "Cootrasana": { lat: 6.1830, lng: -75.6580 },

  "Niqu\u00eda": { lat: 6.3074, lng: -75.5535 },
  "Niquia": { lat: 6.3074, lng: -75.5535 }
};

const officialStations = [];
if (fs.existsSync(METRO_CSV)) {
  const text = fs.readFileSync(METRO_CSV, 'utf-8');
  const rows = text.trim().split('\n').slice(1);
  for (const row of rows) {
    const cols = row.split(',');
    if (cols.length < 9) continue;
    const x = parseFloat(cols[0]);
    const y = parseFloat(cols[1]);
    const { lat, lng } = mercatorToWgs84(x, y);
    const nombre = cols[6] ? cols[6].replace(/^Estaci\u00f3n /, '').replace(/ \(L\u00ednea .*\)$/, '').trim() : '';
    officialStations.push({ nombre, lat, lng });
  }
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

function cleanQueryForGeocoding(name, folder) {
  let query = name;
  const addrMatch = name.match(/\(([^)]+)\)/);
  if (addrMatch) {
    query = addrMatch[1];
  }
  
  // Determine default city from folder
  let city = 'Medellín';
  if (folder) {
    const f = folder.toLowerCase();
    if (f.includes('barbosa')) city = 'Barbosa';
    else if (f.includes('caldas')) city = 'Caldas';
    else if (f.includes('copacabana')) city = 'Copacabana';
    else if (f.includes('girardota')) city = 'Girardota';
    else if (f.includes('itagui')) city = 'Itagüí';
    else if (f.includes('sabaneta')) city = 'Sabaneta';
    else if (f.includes('niquia') || f.includes('bello')) city = 'Bello';
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

let geocodingCache = {};
if (fs.existsSync(CACHE_PATH)) {
  try { geocodingCache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')); }
  catch (e) { console.warn('Could not load geocoding cache, starting fresh.'); }
}

async function geocode(name, folder, manualSet) {
  if (manualSet.has(name)) return manualOverrides[name];
  if (geocodingCache[name]) return geocodingCache[name];

  const norm = normalize(name);
  for (const s of officialStations) {
    const sNorm = normalize(s.nombre);
    if (norm === sNorm || (norm.length > 5 && norm.includes(sNorm) && sNorm.length >= 4)) {
      geocodingCache[name] = { lat: s.lat, lng: s.lng };
      return { lat: s.lat, lng: s.lng };
    }
  }

  const query = cleanQueryForGeocoding(name, folder);

  try {
    const response = await fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(query) + '&limit=1', {
      headers: { 'User-Agent': 'MetroBOT-Project-Geocoding/3.1' }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.features && data.features.length > 0) {
        const f = data.features[0];
        const lng = f.geometry.coordinates[0];
        const lat = f.geometry.coordinates[1];
        if (lat > 6.0 && lat < 6.45 && lng > -75.75 && lng < -75.4) {
          const result = { lat, lng };
          geocodingCache[name] = result;
          return result;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function parseCsv(text) {
  const rawStops = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (isInlineCoordLine(line)) {
      if (rawStops.length > 0) {
        const parts = line.split(',').map(s => parseFloat(s.trim()));
        rawStops[rawStops.length - 1].lat = parts[0];
        rawStops[rawStops.length - 1].lng = parts[1];
        rawStops[rawStops.length - 1].hasCoords = true;
      }
    } else {
      const cleanName = line.replace(/^"|"$/g, '').trim();
      if (cleanName.toLowerCase().startsWith('más horarios') || cleanName.length < 3) continue;
      rawStops.push({ name: cleanName, lat: null, lng: null, hasCoords: false });
    }
  }
  return rawStops;
}

function interpolate(rawStops) {
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
}

async function compileRoute(route) {
  const fullPath = path.join(INTEGRADAS_DIR, route.file);
  const text = fs.readFileSync(fullPath, 'utf-8');
  const rawStops = parseCsv(text);
  if (rawStops.length < 2) return null;

  // Identify connected official stations on this route
  const connectedStations = [];
  for (const stop of rawStops) {
    const stopNorm = normalize(stop.name);
    for (const s of officialStations) {
      const sNorm = normalize(s.nombre);
      if (stopNorm === sNorm || (stopNorm.length > 5 && stopNorm.includes(sNorm) && sNorm.length >= 4)) {
        if (!connectedStations.some(cs => cs.nombre === s.nombre)) {
          connectedStations.push(s);
        }
      }
    }
  }

  let ok = 0, fail = 0;
  for (const stop of rawStops) {
    if (stop.hasCoords) continue;
    const res = await geocode(stop.name, route.folder, new Set(Object.keys(manualOverrides)));
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

        // Outlier criteria matching clean_geocoding_cache.cjs
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
  interpolate(rawStops);
  return {
    id: route.id,
    name: 'Ruta Integrada ' + route.id,
    folder: route.folder,
    sourceFile: route.file,
    stops: rawStops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })),
    geocodedOk: ok,
    geocodedFail: fail
  };
}


async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  let existing = [];
  if (fs.existsSync(JSON_PATH)) {
    existing = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  }
  // Wipe compiled entries that came from the new subfolders so we re-run with
  // the fixed parser (and purge bad coords from the prior pass).
  const targetFolders = new Set(manifest.routes.map(r => r.folder).filter(f => f && f !== '.'));
  const before = existing.length;
  existing = existing.filter(r => !r.folder || !targetFolders.has(r.folder));
  const removed = before - existing.length;
  if (removed > 0) console.log('Removed ' + removed + ' prior compiled entries to recompile with fixed parser.');

  const existingIds = new Set(existing.map(r => r.id));
  const targets = manifest.routes.filter(r => !existingIds.has(r.id));
  console.log('Manifest total:', manifest.count, '| existing in JSON:', existing.length, '| to compile:', targets.length);
  if (targets.length === 0) {
    console.log('Nothing new to compile.');
    fs.writeFileSync(JSON_PATH, JSON.stringify(existing, null, 2));
    return;
  }

  const compiled = [];
  for (const route of targets) {
    process.stdout.write('[compile] ' + route.id.padEnd(18) + ' (' + route.folder + ') ... ');
    try {
      const c = await compileRoute(route);
      if (!c) { console.log('skipped (too few stops)'); continue; }
      compiled.push(c);
      console.log(c.geocodedOk + ' geocoded, ' + c.geocodedFail + ' failed (total ' + c.stops.length + ' stops)');
    } catch (e) {
      console.log('error:', e.message);
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(geocodingCache, null, 2));
  }

  const newIds = new Set(compiled.map(r => r.id));
  const merged = existing.filter(r => !newIds.has(r.id)).concat(compiled);
  fs.writeFileSync(JSON_PATH, JSON.stringify(merged, null, 2));
  console.log('\nDone. Wrote', compiled.length, 'new routes. JSON total:', merged.length);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
