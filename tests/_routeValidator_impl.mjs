// tests/_routeValidator_impl.mjs
// Mirror of src/lib/routeValidator.ts. Kept in sync by hand; if you change one,
// change both. The test runner asserts behavior against this file. The
// production TS module is the one shipped to the browser.

export const BBOX_VALLE_ABURRA = { latMin: 5.95, latMax: 6.45, lngMin: -75.85, lngMax: -75.30 };

export function clampBbox(p) {
  if (!p) return false;
  if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return false;
  if (Number.isNaN(p.lat) || Number.isNaN(p.lng)) return false;
  return p.lat >= BBOX_VALLE_ABURRA.latMin && p.lat <= BBOX_VALLE_ABURRA.latMax && p.lng >= BBOX_VALLE_ABURRA.lngMin && p.lng <= BBOX_VALLE_ABURRA.lngMax;
}

const MAX_BOARDING_DISTANCE_METERS = 400;
const MAX_USER_DISTANCE_METERS = 25000;

function normalize(name) {
  return String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/s+/g, ' ').trim();
}

function distanceMeters(a, b) {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dPhi = toRad(b.lat - a.lat);
  const dLambda = toRad(b.lng - a.lng);
  const x = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function findRoute(routes, line) {
  if (!line) return undefined;
  const norm = normalize(line);
  const direct = routes.find((r) => normalize(r.id) === norm);
  if (direct) return direct;
  const byName = routes.find((r) => normalize(r.name) === norm);
  if (byName) return byName;
  return routes.find((r) => normalize(r.id).includes(norm) || norm.includes(normalize(r.id)));
}

function matchStopByName(stops, query) {
  if (!query) return undefined;
  const q = normalize(query);
  let best;
  for (const s of stops) {
    const n = normalize(s.name);
    if (n === q) return s;
    if (n.includes(q) || q.includes(n)) {
      if (!best || n.length < normalize(best.name).length) best = s;
    }
  }
  return best;
}

export function validateBusStep(step, routes) {
  if (!step || step.mode !== 'bus_articulado') {
    return { ok: true, reason: 'not-bus-step' };
  }
  const route = findRoute(routes, step.line);
  if (!route) return { ok: false, reason: 'route-not-found' };

  const station = step.station;
  const queryName = station && (station.nameRef || station.name);
  if (!queryName) return { ok: false, reason: 'invalid-step', validatedRoute: route };

  const byName = matchStopByName(route.stops, queryName);
  if (!byName) return { ok: false, reason: 'stop-too-far', validatedRoute: route };

  let bestStop = byName;
  let bestDist = 0;
  if (station && typeof station.lat === 'number' && typeof station.lng === 'number') {
    bestDist = distanceMeters({ lat: station.lat, lng: station.lng }, byName);
    if (bestDist > MAX_BOARDING_DISTANCE_METERS) {
      return { ok: false, reason: 'stop-too-far', validatedRoute: route, distanceMeters: bestDist };
    }
  }
  return { ok: true, validatedRoute: route, boardingStop: bestStop, distanceMeters: bestDist };
}

export function reconstructBusStep(step, routes) {
  if (!step || step.mode !== 'bus_articulado') {
    return { step, validation: { ok: true, reason: 'not-bus-step' } };
  }
  const v = validateBusStep(step, routes);
  if (v.ok && v.validatedRoute && v.boardingStop) {
    const newStep = {
      ...step,
      instruction: 'Toma el Bus Integrado ' + v.validatedRoute.id + ' (' + v.validatedRoute.stops.length + ' paradas) en "' + v.boardingStop.name + '".',
      mode: 'bus_articulado',
      cost: typeof step.cost === 'number' ? step.cost : 0,
      line: v.validatedRoute.name,
      station: {
        nameRef: v.boardingStop.name,
        lat: v.boardingStop.lat,
        lng: v.boardingStop.lng,
      },
    };
    return { step: newStep, validation: v };
  }
  const degraded = {
    ...step,
    instruction: 'Camina hacia tu destino (no pudimos verificar un bus integrado para este tramo).',
    mode: 'walk',
    cost: 0,
    station: undefined,
  };
  return { step: degraded, validation: v };
}

const METRO_MODES = new Set(['metro', 'metrocable', 'tranvia', 'metroplus', 'encicla']);

export function validateMetroStation(step, stations) {
  if (!step) return { ok: false, reason: 'invalid-step' };
  const mode = String(step.mode || '').toLowerCase();
  if (!METRO_MODES.has(mode)) return { ok: true, reason: 'not-applicable' };
  const q = step.station && (step.station.nameRef || step.station.name);
  if (!q) return { ok: false, reason: 'no-name' };
  const norm = normalize(q);
  for (const s of stations) {
    if (normalize(s.nombre) === norm) return { ok: true, station: s };
  }
  for (const s of stations) {
    const n = normalize(s.nombre);
    if (n.includes(norm) || norm.includes(n)) return { ok: true, station: s };
  }
  return { ok: false, reason: 'unknown-station' };
}

export function validateUserCoords(point, stations) {
  if (!clampBbox(point)) return { ok: false, reason: 'out-of-bbox' };
  let nearest = null;
  let best = Infinity;
  for (const s of stations) {
    const d = distanceMeters(point, { lat: s.lat, lng: s.lng });
    if (d < best) { best = d; nearest = s; }
  }
  if (!nearest || best > MAX_USER_DISTANCE_METERS) return { ok: false, reason: 'far-from-network' };
  return { ok: true, nearest: nearest, distanceMeters: best };
}

export function summarizeRouteValidation(routes, allIntegratedRoutes, allStations) {
  let validatedSteps = 0;
  let degradedSteps = 0;
  let total = 0;
  const reasons = [];
  for (const r of routes) {
    for (const s of (r.steps || [])) {
      total++;
      if (s.mode === 'bus_articulado') {
        const v = validateBusStep(s, allIntegratedRoutes);
        if (v.ok) validatedSteps++;
        else { degradedSteps++; reasons.push(v.reason || 'invalid'); }
      } else {
        const v = validateMetroStation(s, allStations);
        if (v.reason !== 'not-applicable' && v.ok) validatedSteps++;
        else { degradedSteps++; reasons.push(v.reason || 'invalid'); }
      }
    }
  }
  return {
    ok: degradedSteps === 0 && total > 0,
    validatedSteps: validatedSteps,
    degradedSteps: degradedSteps,
    total: total,
    reasons: reasons,
  };
}
export const BUS_UNSAFE_THRESHOLD = 0.5;

export function isRouteUnsafe(route, allIntegratedRoutes, allStations, threshold) {
  if (!route || !Array.isArray(route.steps) || route.steps.length === 0) return { unsafe: false };
  const t = typeof threshold === 'number' ? threshold : BUS_UNSAFE_THRESHOLD;
  let busCount = 0;
  for (const s of route.steps) {
    if (s && s.mode === 'bus_articulado') busCount++;
  }
  if (busCount === 0) return { unsafe: false };
  // dominant = more bus steps than non-bus steps
  if (busCount <= route.steps.length - busCount) return { unsafe: false };
  const summary = summarizeRouteValidation([route], allIntegratedRoutes, allStations);
  if (summary.total === 0) return { unsafe: false };
  const ratio = summary.degradedSteps / summary.total;
  if (ratio >= t) {
    return { unsafe: true, reason: 'mostly-invalid-buses', ratio, threshold: t };
  }
  return { unsafe: false, ratio, threshold: t };
}
