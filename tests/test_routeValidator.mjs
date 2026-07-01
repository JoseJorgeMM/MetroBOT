// tests/test_routeValidator.mjs
// Self-contained Node test runner for src/lib/routeValidator.ts.
import { clampBbox, validateBusStep, reconstructBusStep, validateMetroStation, validateUserCoords, summarizeRouteValidation } from './_routeValidator_impl.mjs';

let passed = 0, failed = 0;
const failures = [];

function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; console.log('  ?', name); }
  else { failed++; failures.push({ name, actual: a, expected: e }); console.log('  ?', name, '\n      actual:  ', a, '\n      expected:', e); }
}

function assertTrue(name, cond, hint) {
  if (cond) { passed++; console.log('  ?', name); }
  else { failed++; failures.push({ name, hint }); console.log('  ?', name, hint ? '('+hint+')' : ''); }
}

const FAKE_ROUTES = [
  {
    id: 'C7-001',
    name: 'Ruta Integrada C7-001',
    stops: [
      { name: 'Niquía', lat: 6.3074, lng: -75.5535 },
      { name: 'Autopista Norte, 3279', lat: 6.3100, lng: -75.5600 },
      { name: 'Dg. 50A #32-200, Bello', lat: 6.3340, lng: -75.5700 },
    ],
  },
  {
    id: '142I',
    name: 'Ruta Integrada 142I',
    stops: [
      { name: 'Calle 9 sur, 54e, Urb Quintas Del Rodeo', lat: 6.2019, lng: -75.5933 },
      { name: 'Calle 10 sur #55a-13', lat: 6.2025, lng: -75.5920 },
    ],
  },
];

const FAKE_STATIONS = [
  { nombre: 'Acevedo', lat: 6.2999, lng: -75.5586, sistema: 'metro' },
  { nombre: 'San Javier', lat: 6.2520, lng: -75.6128, sistema: 'metro' },
  { nombre: 'Poblado', lat: 6.2109, lng: -75.5719, sistema: 'metro' },
];

console.log('clampBbox');
assertTrue('inside-bbox', clampBbox({ lat: 6.25, lng: -75.58 }) === true);
assertTrue('outside-lat', clampBbox({ lat: 4.0, lng: -75.58 }) === false);
assertTrue('outside-lng', clampBbox({ lat: 6.25, lng: -90 }) === false);
assertTrue('null-point',  clampBbox(null) === false);

console.log('validateBusStep');
const validResult = validateBusStep({
  mode: 'bus_articulado',
  line: 'C7-001',
  station: { nameRef: 'Niquía', lat: 6.3074, lng: -75.5535 },
}, FAKE_ROUTES);
assertEq('valid-step.ok', validResult.ok, true);
assertEq('valid-step.route.id', validResult.validatedRoute && validResult.validatedRoute.id, 'C7-001');
assertTrue('valid-step.boardingStop', !!validResult.boardingStop);
assertTrue('valid-step.distanceMeters < 50', validResult.distanceMeters < 50, 'distance=' + validResult.distanceMeters);

const unknownRoute = validateBusStep({
  mode: 'bus_articulado',
  line: 'C7-999',
  station: { nameRef: 'Niquía', lat: 6.3074, lng: -75.5535 },
}, FAKE_ROUTES);
assertEq('unknown-route.reason', unknownRoute.reason, 'route-not-found');
assertEq('unknown-route.ok', unknownRoute.ok, false);

const tooFar = validateBusStep({
  mode: 'bus_articulado',
  line: 'C7-001',
  station: { nameRef: 'Niquía', lat: 6.40, lng: -75.40 },
}, FAKE_ROUTES);
assertEq('too-far.reason', tooFar.reason, 'stop-too-far');

const wrongMode = validateBusStep({
  mode: 'metro',
  line: 'Línea A',
  station: undefined,
}, FAKE_ROUTES);
assertEq('wrong-mode.ok', wrongMode.ok, true);

console.log('reconstructBusStep');
const validReconstruct = reconstructBusStep({
  mode: 'bus_articulado',
  line: 'C7-001',
  station: { nameRef: 'Niquía', lat: 6.3074, lng: -75.5535 },
  duration: 20,
  instruction: 'Toma el bus inventado',
}, FAKE_ROUTES);
assertEq('reconstruct.mode', validReconstruct.step.mode, 'bus_articulado');
assertEq('reconstruct.cost', validReconstruct.step.cost, 0);
assertTrue('reconstruct.instruction mentions route', validReconstruct.step.instruction.indexOf('C7-001') !== -1, validReconstruct.step.instruction);
assertTrue('reconstruct.instruction mentions boarding stop', validReconstruct.step.instruction.indexOf('Niqu') !== -1, validReconstruct.step.instruction);
assertEq('reconstruct.station.lat', validReconstruct.step.station.lat, 6.3074);
assertEq('reconstruct.validation.ok', validReconstruct.validation.ok, true);

const invalidReconstruct = reconstructBusStep({
  mode: 'bus_articulado',
  line: 'C7-999',
  station: { nameRef: 'Inventada', lat: 6.31, lng: -75.55 },
  duration: 20,
  instruction: 'Toma el bus fantasma',
}, FAKE_ROUTES);
assertEq('degraded.mode', invalidReconstruct.step.mode, 'walk');
assertEq('degraded.validation.ok', invalidReconstruct.validation.ok, false);
assertEq('degraded.cost', invalidReconstruct.step.cost, 0);
assertTrue('degraded.instruction is honest', /camina|destino|no estaba/i.test(invalidReconstruct.step.instruction), invalidReconstruct.step.instruction);

const walkPassthrough = reconstructBusStep({
  mode: 'walk',
  duration: 5,
  instruction: 'Camina 5 min',
}, FAKE_ROUTES);
assertEq('walk-passthrough.mode', walkPassthrough.step.mode, 'walk');
assertEq('walk-passthrough.ok', walkPassthrough.validation.ok, true);

console.log('validateMetroStation');
const metroOk = validateMetroStation({ mode: 'metro', station: { nameRef: 'Acevedo' } }, FAKE_STATIONS);
assertEq('metro.known.ok', metroOk.ok, true);
assertEq('metro.known.station', metroOk.station && metroOk.station.nombre, 'Acevedo');

const metroBad = validateMetroStation({ mode: 'metro', station: { nameRef: 'Parada X' } }, FAKE_STATIONS);
assertEq('metro.unknown.ok', metroBad.ok, false);
assertEq('metro.unknown.reason', metroBad.reason, 'unknown-station');

const metroWalk = validateMetroStation({ mode: 'walk' }, FAKE_STATIONS);
assertEq('metro.walk.ok', metroWalk.ok, true);
assertEq('metro.walk.reason', metroWalk.reason, 'not-applicable');

const metroBus = validateMetroStation({ mode: 'bus_articulado' }, FAKE_STATIONS);
assertEq('metro.bus.ok', metroBus.ok, true);
assertEq('metro.bus.reason', metroBus.reason, 'not-applicable');

console.log('validateUserCoords');
const userOk = validateUserCoords({ lat: 6.30, lng: -75.56 }, FAKE_STATIONS);
assertEq('user.inbbox.ok', userOk.ok, true);
assertEq('user.inbbox.nearest', userOk.nearest && userOk.nearest.nombre, 'Acevedo');

const userOut = validateUserCoords({ lat: 4.0, lng: -75.0 }, FAKE_STATIONS);
assertEq('user.out.ok', userOut.ok, false);
assertEq('user.out.reason', userOut.reason, 'out-of-bbox');

const userFar = validateUserCoords({ lat: 6.30, lng: -75.56 }, []);
assertEq('user.far.ok', userFar.ok, false);
assertEq('user.far.reason', userFar.reason, 'far-from-network');

console.log('summarizeRouteValidation');
const sumRoutes = [
  {
    steps: [
      { mode: 'bus_articulado', line: 'C7-001', station: { nameRef: 'Niquía', lat: 6.3074, lng: -75.5535 } },
      { mode: 'bus_articulado', line: 'C7-999', station: { nameRef: 'Inventada', lat: 6.31, lng: -75.55 } },
      { mode: 'metro', station: { nameRef: 'Poblado' } },
    ],
  },
];
const sum = summarizeRouteValidation(sumRoutes, FAKE_ROUTES, FAKE_STATIONS);
assertEq('summary.validatedSteps', sum.validatedSteps, 2);
assertEq('summary.degradedSteps', sum.degradedSteps, 1);
assertEq('summary.total', sum.total, 3);
assertEq('summary.ok', sum.ok, false);
assertTrue('summary.reasons has one entry', Array.isArray(sum.reasons) && sum.reasons.length === 1, JSON.stringify(sum.reasons));

const sumEmpty = summarizeRouteValidation([], FAKE_ROUTES, FAKE_STATIONS);
assertEq('summary.empty.ok', sumEmpty.ok, false);
assertEq('summary.empty.total', sumEmpty.total, 0);

console.log('\n-----');
if (failed === 0) {
  console.log('ALL TESTS PASS (' + passed + '/' + (passed + failed) + ')');
  process.exit(0);
} else {
  console.log('FAILED ' + failed + '/' + (passed + failed) + ' tests');
  for (const f of failures) console.log(' -', f.name, JSON.stringify(f));
  process.exit(1);
}
