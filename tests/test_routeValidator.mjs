// tests/test_routeValidator.mjs
// Self-contained Node test runner for src/lib/routeValidator.ts.
// Run with: node tests/test_routeValidator.mjs
//
// We mirror the validator surface in tests/_routeValidator_impl.mjs so this
// script has zero compile-time deps. The production TS module is the source
// of truth; this runner catches behavioral drift when the .mjs mirror is
// forgotten. (See the plan: "if the .ts drifts from the impl, tests fail".)

import { clampBbox, validateBusStep, reconstructBusStep } from './_routeValidator_impl.mjs';

let passed = 0, failed = 0;
const failures = [];

function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log('  \u2713', name);
  } else {
    failed++;
    failures.push({ name, actual: a, expected: e });
    console.log('  \u2717', name, '\n      actual:  ', a, '\n      expected:', e);
  }
}

function assertTrue(name, cond, hint) {
  if (cond) { passed++; console.log('  \u2713', name); }
  else { failed++; failures.push({ name, hint }); console.log('  \u2717', name, hint ? '('+hint+')' : ''); }
}

const FAKE_ROUTES = [
  {
    id: 'C7-001',
    name: 'Ruta Integrada C7-001',
    stops: [
      { name: 'Niqu\u00eda', lat: 6.3074, lng: -75.5535 },
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

console.log('clampBbox');
assertTrue('inside-bbox', clampBbox({ lat: 6.25, lng: -75.58 }) === true);
assertTrue('outside-lat', clampBbox({ lat: 4.0, lng: -75.58 }) === false);
assertTrue('outside-lng', clampBbox({ lat: 6.25, lng: -90 }) === false);
assertTrue('null-point',  clampBbox(null) === false);

console.log('validateBusStep');
const validResult = validateBusStep({
  mode: 'bus_articulado',
  line: 'C7-001',
  station: { nameRef: 'Niqu\u00eda', lat: 6.3074, lng: -75.5535 },
}, FAKE_ROUTES);
assertEq('valid-step.ok', validResult.ok, true);
assertEq('valid-step.route.id', validResult.validatedRoute?.id, 'C7-001');
assertTrue('valid-step.boardingStop', !!validResult.boardingStop);
assertTrue('valid-step.distanceMeters < 50', validResult.distanceMeters < 50, 'distance=' + validResult.distanceMeters);

const unknownRoute = validateBusStep({
  mode: 'bus_articulado',
  line: 'C7-999',
  station: { nameRef: 'Niqu\u00eda', lat: 6.3074, lng: -75.5535 },
}, FAKE_ROUTES);
assertEq('unknown-route.reason', unknownRoute.reason, 'route-not-found');
assertEq('unknown-route.ok', unknownRoute.ok, false);

const tooFar = validateBusStep({
  mode: 'bus_articulado',
  line: 'C7-001',
  station: { nameRef: 'Niqu\u00eda', lat: 6.40, lng: -75.40 },
}, FAKE_ROUTES);
assertEq('too-far.reason', tooFar.reason, 'stop-too-far');

const wrongMode = validateBusStep({
  mode: 'metro',
  line: 'L\u00ednea A',
  station: undefined,
}, FAKE_ROUTES);
assertEq('wrong-mode.ok', wrongMode.ok, true);

console.log('reconstructBusStep');
const validReconstruct = reconstructBusStep({
  mode: 'bus_articulado',
  line: 'C7-001',
  station: { nameRef: 'Niqu\u00eda', lat: 6.3074, lng: -75.5535 },
  duration: 20,
  instruction: 'Toma el bus inventado',
}, FAKE_ROUTES);
assertEq('reconstruct.mode', validReconstruct.step.mode, 'bus_articulado');
assertEq('reconstruct.cost', validReconstruct.step.cost, 0);
assertTrue('reconstruct.instruction mentions route', validReconstruct.step.instruction.includes('C7-001'), validReconstruct.step.instruction);
assertTrue('reconstruct.instruction mentions boarding stop', validReconstruct.step.instruction.includes('Niqu'), validReconstruct.step.instruction);
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

console.log('\n-----');
if (failed === 0) {
  console.log('ALL TESTS PASS (' + passed + '/' + (passed + failed) + ')');
  process.exit(0);
} else {
  console.log('FAILED ' + failed + '/' + (passed + failed) + ' tests');
  for (const f of failures) console.log(' -', f.name, JSON.stringify(f));
  process.exit(1);
}
