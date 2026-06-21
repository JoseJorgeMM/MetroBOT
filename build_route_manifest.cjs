// build_route_manifest.cjs
// -----------------------------------------------------------------------------
// Scans public/rutas_integradas/ (root + every subfolder) and emits
// public/rutas_integradas/manifest.json listing every <id>.csv. The manifest
// is fetched by the browser instead of relying on a hardcoded list.
//
// It also writes the same list into the legacy rutas_integradas.json "index"
// field (so existing consumers can keep using that file unchanged).
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'public');
const INTEGRADAS_DIR = path.join(ROOT, 'rutas_integradas');
const MANIFEST_PATH = path.join(INTEGRADAS_DIR, 'manifest.json');

function isCsv(name) {
  return name.toLowerCase().endsWith('.csv');
}

function collect() {
  const routes = [];
  // 1. Root-level CSVs (legacy C3, C6, etc.)
  for (const file of fs.readdirSync(INTEGRADAS_DIR)) {
    const full = path.join(INTEGRADAS_DIR, file);
    const stat = fs.statSync(full);
    if (stat.isFile() && isCsv(file)) {
      routes.push({ id: path.basename(file, '.csv'), folder: '.', file });
    } else if (stat.isDirectory()) {
      // 2. Each subfolder (tpc_*, TPC_*, Rutas_Circulares, Solo_Bus, etc.)
      for (const sub of fs.readdirSync(full)) {
        if (!isCsv(sub)) continue;
        routes.push({
          id: path.basename(sub, '.csv'),
          folder: file,
          file: `${file}/${sub}`
        });
      }
    }
  }
  // Dedup by id (prefer the root entry when collisions exist).
  const seen = new Set();
  const unique = [];
  // Sort so root entries come first.
  routes.sort((a, b) => (a.folder === '.' ? -1 : 1) - (b.folder === '.' ? -1 : 1));
  for (const r of routes) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    unique.push(r);
  }
  return unique;
}

function main() {
  const routes = collect();
  const manifest = { generatedAt: new Date().toISOString(), count: routes.length, routes };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log('Wrote', MANIFEST_PATH, 'with', routes.length, 'routes.');
  // Quick histogram by folder for sanity.
  const byFolder = {};
  for (const r of routes) byFolder[r.folder] = (byFolder[r.folder] || 0) + 1;
  for (const [k, v] of Object.entries(byFolder)) console.log('  ' + k.padEnd(22) + v);
}

main();
