# Geocoding Outliers & Query Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the coordinates of integrated bus stops in theCompiled SITVA network by implementing query normalization and outlier filtering during compilation, and cleaning the cache.

**Architecture:**
1. A cache cleaning script (`clean_geocoding_cache.cjs`) will run retroactively to remove outlier coordinates from `public/geocoding_cache.json`.
2. Compilation scripts (`compile_new_routes.cjs`, `compile_routes.cjs`, `compile_tpc_itagui.cjs`) will be updated to expand abbreviations and use proper intersection syntax (`con`) for geocoder queries.
3. Compilation scripts will also reject any geocoded stop coordinates that lie more than 3.5 km away from connecting SITVA stations, defaulting to linear interpolation.

**Tech Stack:** Node.js (CommonJS), Leaflet/SITVA coordinate definitions.

---

### Task 1: Create Cache Cleanup Script

**Files:**
- Create: `clean_geocoding_cache.cjs`

- [ ] **Step 1: Write the cache cleanup script**
  Create the file `C:\Users\ASUS\Documents\MetroBOT\clean_geocoding_cache.cjs` with the following content:

  ```javascript
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
      const nombre = cols[6] ? cols[6].replace(/^Estación /, '').replace(/ \(Línea .*\)$/, '').trim() : '';
      officialStations.push({ nombre, lat, lng });
    }
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

    if (connectedStations.length === 0) continue;

    for (const stop of r.stops) {
      let minDist = Infinity;
      for (const s of connectedStations) {
        const dist = calculateDistance(stop.lat, stop.lng, s.lat, s.lng);
        if (dist < minDist) minDist = dist;
      }

      if (minDist > 3500 && minDist !== Infinity) {
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
  ```

- [ ] **Step 2: Run cache cleanup dry-run / verify**
  Run: `node clean_geocoding_cache.cjs`
  Expected: Cleaned logs showing specific removed keys like `"Avenida 80 - Calle 32b"`.

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add clean_geocoding_cache.cjs
  git commit -m "tool: add cache cleanup script for outliers"
  ```

---

### Task 2: Implement geocoding query normalization & outlier filtering in `compile_new_routes.cjs`

**Files:**
- Modify: `compile_new_routes.cjs`

- [ ] **Step 1: Write query cleaning helper and integrate into geocode()**
  Modify the `geocode` function in `C:\Users\ASUS\Documents\MetroBOT\compile_new_routes.cjs` (around lines 120-167) to parse queries and expand abbreviations, and add the helper:

  ```javascript
  function cleanQueryForGeocoding(name) {
    let query = name;
    const addrMatch = name.match(/\(([^)]+)\)/);
    if (addrMatch) {
      query = addrMatch[1];
    }
    
    let city = 'Medellín';
    const cities = ['Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'Copacabana', 'Caldas', 'La Estrella', 'Barbosa', 'Girardota'];
    for (const c of cities) {
      const reg = new RegExp(c, 'i');
      if (name.match(reg)) {
        city = c;
        break;
      }
    }

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
  ```

  And modify the API URL format inside the geocode function:
  ```javascript
  const query = cleanQueryForGeocoding(name);
  // ... fetch using komoot/photon ...
  ```

- [ ] **Step 2: Define calculateDistance and implement outlier filter in compileRoute**
  In `compile_new_routes.cjs`, define the `calculateDistance` function at the top of the file:
  ```javascript
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
  ```

  Inside `compileRoute(route)`, implement the check against `officialStations` to detect outliers:
  ```javascript
    let ok = 0, fail = 0;
    for (const stop of rawStops) {
      if (stop.hasCoords) continue;
      const res = await geocode(stop.name, new Set(Object.keys(manualOverrides)));
      if (res) {
        // Outlier detection
        let isOutlier = false;
        if (officialStations.length > 0) {
          let minDist = Infinity;
          for (const s of officialStations) {
            const dist = calculateDistance(res.lat, res.lng, s.lat, s.lng);
            if (dist < minDist) minDist = dist;
          }
          if (minDist > 3500 && minDist !== Infinity) {
            isOutlier = true;
          }
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
  ```

- [ ] **Step 3: Verify syntax**
  Run: `node -e "require('./compile_new_routes.cjs')"`
  Expected: Execution begins and exits without syntax errors.

- [ ] **Step 4: Commit**
  Run:
  ```bash
  git add compile_new_routes.cjs
  git commit -m "build: implement clean queries and outlier filter in compile_new_routes"
  ```

---

### Task 3: Implement query cleaning and outlier filtering in `compile_routes.cjs`

**Files:**
- Modify: `compile_routes.cjs`

- [ ] **Step 1: Implement cleanQueryForGeocoding and distance checks**
  Apply the exact same changes (`cleanQueryForGeocoding` function and `calculateDistance` outlier detection filter in `compileRoute` or `main`) to `C:\Users\ASUS\Documents\MetroBOT\compile_routes.cjs`.

- [ ] **Step 2: Commit**
  Run:
  ```bash
  git add compile_routes.cjs
  git commit -m "build: implement clean queries and outlier filter in compile_routes"
  ```

---

### Task 4: Implement query cleaning and outlier filtering in `compile_tpc_itagui.cjs`

**Files:**
- Modify: `compile_tpc_itagui.cjs`

- [ ] **Step 1: Implement cleanQueryForGeocoding and distance checks**
  Apply the exact same changes to `C:\Users\ASUS\Documents\MetroBOT\compile_tpc_itagui.cjs`.

- [ ] **Step 2: Commit**
  Run:
  ```bash
  git add compile_tpc_itagui.cjs
  git commit -m "build: implement clean queries and outlier filter in compile_tpc_itagui"
  ```

---

### Task 5: Clean cache and Recompile everything

- [ ] **Step 1: Run cache cleaner**
  Run: `node clean_geocoding_cache.cjs`
  Expected: Success output reporting multiple removed entries.

- [ ] **Step 2: Recompile existing routes**
  Run: `node compile_routes.cjs`
  Expected: Compilation outputs showing routes geocoding and completing successfully.

- [ ] **Step 3: Recompile new routes**
  Run: `node compile_new_routes.cjs`
  Expected: Recompiles successfully.

- [ ] **Step 4: Recompile Itagüí TPC routes**
  Run: `node compile_tpc_itagui.cjs`
  Expected: Recompiles successfully.

- [ ] **Step 5: Run outlier analysis and verify**
  Run: `node analyze_outliers.cjs`
  Expected: `Outlier stops found: 0 (0.00%)` (or extremely close to 0%).

- [ ] **Step 6: Verify whole project build and lints**
  Run: `npm run build` and `npm run lint`
  Expected: Build succeeds, no TS compiler errors.

- [ ] **Step 7: Commit compiled assets**
  Run:
  ```bash
  git add public/geocoding_cache.json public/rutas_integradas.json
  git commit -m "build: recompile all routes with improved geocoding query format and outlier filtering"
  ```
