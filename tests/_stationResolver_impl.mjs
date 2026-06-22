// tests/_stationResolver_impl.mjs
// Mirror of src/lib/stationResolver.ts (kept in sync by hand).
// Reads the real public/ catalog so the tests assert against the actual data.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'public');

function loadCSV(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines.shift();
  return lines.map(line => {
    const cols = [];
    let inQ = false, buf = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cols.push(buf); buf = ''; continue; }
      buf += c;
    }
    cols.push(buf);
    return cols;
  });
}

const RADIUS = 6378137;
function mercatorToWgs84(x, y) {
  const lng = (x / RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

const stations = (() => {
  const rows = loadCSV('Estaciones_Sistema_Metro.csv');
  const out = [];
  for (const cols of rows) {
    const x = parseFloat(cols[0]);
    const y = parseFloat(cols[1]);
    const { lat, lng } = mercatorToWgs84(x, y);
    const nombre = (cols[6] || '').replace(/^Estaci\u00f3n /, '').replace(/ \(L\u00ednea .*\)$/, '');
    out.push({ id: cols[7], lat, lng, sistema: cols[4], nombre, linea: cols[8] || '' });
  }
  return out;
})();

const busRoutes = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'rutas_integradas.json'), 'utf8'));
  return j.map(r => ({
    id: r.id,
    name: r.name,
    stops: (r.stops || []).filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
  }));
})();

async function findOfficialStation(query) {
  if (!query) return undefined;
  const q = normalize(query);
  for (const s of stations) {
    if (normalize(s.nombre) === q) return s;
  }
  for (const s of stations) {
    const n = normalize(s.nombre);
    if (n.includes(q) || q.includes(n)) return s;
  }
  return undefined;
}

async function findBusStop(query) {
  if (!query) return undefined;
  const q = normalize(query);
  for (const r of busRoutes) {
    for (const stop of r.stops) {
      if (normalize(stop.name) === q) return stop;
    }
  }
  let best;
  for (const r of busRoutes) {
    for (const stop of r.stops) {
      const n = normalize(stop.name);
      let score = 0;
      if (n.includes(q)) score = q.length / n.length;
      else if (q.includes(n)) score = n.length / q.length;
      if (score > 0 && (!best || score > best.score)) best = { stop, score };
    }
  }
  return best ? best.stop : undefined;
}

export async function enrichStation(station, mode) {
  if (!station) return station;
  if (typeof station.lat === 'number' && typeof station.lng === 'number' && !Number.isNaN(station.lat) && !Number.isNaN(station.lng)) {
    return station;
  }
  const query = station.nameRef || station.name;
  if (!query) return station;
  const isBus = mode === 'bus' || mode === 'bus_articulado';
  if (isBus) {
    const stop = await findBusStop(query);
    if (stop) return Object.assign({}, station, { name: stop.name, lat: stop.lat, lng: stop.lng });
  }
  const official = await findOfficialStation(query);
  if (official) return Object.assign({}, station, { name: official.nombre, lat: official.lat, lng: official.lng });
  const stop = await findBusStop(query);
  if (stop) return Object.assign({}, station, { name: stop.name, lat: stop.lat, lng: stop.lng });
  return station;
}
