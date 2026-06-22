// tests/test_enrichment.cjs
// Simulates the post-processing chain in gemini.ts: given a Gemini render_route
// response with nameRef-only stations, the enrichment step must fill lat/lng
// from the real catalog before the UI tries to draw polyline.

const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

function loadMetroCSV() {
  const text = fs.readFileSync(path.join(PUBLIC, 'Estaciones_Sistema_Metro.csv'), 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  lines.shift();
  const RADIUS = 6378137;
  const out = [];
  for (const line of lines) {
    const cols = [];
    let inQ = false, buf = '';
    for (const c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cols.push(buf); buf = ''; continue; }
      buf += c;
    }
    cols.push(buf);
    const x = parseFloat(cols[0]);
    const y = parseFloat(cols[1]);
    const lng = (x / RADIUS) * (180 / Math.PI);
    const lat = (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) * (180 / Math.PI);
    const nombre = (cols[6] || '').replace(/^Estaci\u00f3n /, '').replace(/ \(L\u00ednea .*\)$/, '');
    out.push({ id: cols[7], lat, lng, sistema: cols[4], nombre, linea: cols[8] || '' });
  }
  return out;
}

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

const OFFICIAL = loadMetroCSV();
const BUS = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'rutas_integradas.json'), 'utf8'))
  .map(r => ({ id: r.id, name: r.name, stops: (r.stops || []).filter(s => typeof s.lat === 'number') }));

function findOfficial(query) {
  if (!query) return undefined;
  const q = normalize(query);
  for (const s of OFFICIAL) if (normalize(s.nombre) === q) return s;
  for (const s of OFFICIAL) { const n = normalize(s.nombre); if (n.includes(q) || q.includes(n)) return s; }
  return undefined;
}

function findBusStop(query) {
  if (!query) return undefined;
  const q = normalize(query);
  for (const r of BUS) for (const s of r.stops) if (normalize(s.name) === q) return s;
  let best;
  for (const r of BUS) for (const s of r.stops) {
    const n = normalize(s.name);
    let score = 0;
    if (n.includes(q)) score = q.length / n.length;
    else if (q.includes(n)) score = n.length / q.length;
    if (score > 0 && (!best || score > best.score)) best = { stop: s, score };
  }
  return best ? best.stop : undefined;
}

function enrichStation(station, mode) {
  if (!station) return station;
  if (typeof station.lat === 'number' && typeof station.lng === 'number' && !Number.isNaN(station.lat) && !Number.isNaN(station.lng)) return station;
  const query = station.nameRef || station.name;
  if (!query) return station;
  const isBus = mode === 'bus' || mode === 'bus_articulado';
  if (isBus) {
    const s = findBusStop(query);
    if (s) return Object.assign({}, station, { name: s.name, lat: s.lat, lng: s.lng });
  }
  const o = findOfficial(query);
  if (o) return Object.assign({}, station, { name: o.nombre, lat: o.lat, lng: o.lng });
  const s = findBusStop(query);
  if (s) return Object.assign({}, station, { name: s.name, lat: s.lat, lng: s.lng });
  return station;
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  \u2713', name); }
  else { fail++; console.log('  \u2717', name); }
}

// Simulate Gemini returning a render_route where the only coords are nameRefs.
const llmResponse = {
  routes: [
    {
      id: 'r1',
      modes: ['metro', 'walk'],
      duration: 20,
      cost: 3430,
      transfers: 0,
      originStation: { nameRef: 'Acevedo' },
      destinationStation: { nameRef: 'Estrella' },
      steps: [
        { instruction: 'Camina a Acevedo', mode: 'walk', duration: 5, station: { nameRef: 'Poblado' } },
        { instruction: 'Toma el metro hacia Estrella', mode: 'metro', duration: 10, line: 'L\u00ednea A', station: { nameRef: 'Poblado' } },
        { instruction: 'Baja en Estrella', mode: 'metro', duration: 5, line: 'L\u00ednea A', station: { nameRef: 'Estrella' } },
      ],
    },
    {
      id: 'r2',
      modes: ['bus_articulado', 'walk'],
      duration: 30,
      cost: 0,
      transfers: 0,
      originStation: { nameRef: 'Niquia' },
      destinationStation: { nameRef: 'C7-001 parada 50' },
      steps: [
        { instruction: 'Toma el bus C7-001', mode: 'bus_articulado', duration: 20, line: 'C7-001', station: { nameRef: 'Niquia' } },
      ],
    },
  ],
};

// Apply enrichment
for (const route of llmResponse.routes) {
  route.originStation = enrichStation(route.originStation);
  route.destinationStation = enrichStation(route.destinationStation);
  for (const s of route.steps) if (s.station) s.station = enrichStation(s.station, s.mode);
}

// Validate everything got coords
check('route 1 originStation has coords', typeof llmResponse.routes[0].originStation.lat === 'number');
check('route 1 destinationStation has coords', typeof llmResponse.routes[0].destinationStation.lat === 'number');
check('route 1 step[1].station has coords (Poblado)', typeof llmResponse.routes[0].steps[1].station.lat === 'number');
check('route 2 originStation has coords (Niquia)', typeof llmResponse.routes[1].originStation.lat === 'number');
check('route 2 step[0].station has coords (Niquia)', typeof llmResponse.routes[1].steps[0].station.lat === 'number');

console.log('\n-----');
console.log(pass + '/' + (pass+fail) + ' checks pass');
process.exit(fail === 0 ? 0 : 1);
