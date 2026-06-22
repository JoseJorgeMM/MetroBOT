import { enrichStation } from './_stationResolver_impl.mjs';

let passed = 0, failed = 0;
const fails = [];
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; console.log('  \u2713', name); }
  else { failed++; fails.push({name, actual:a, expected:e}); console.log('  \u2717', name, '\n      actual:', a, '\n      expected:', e); }
}

console.log('enrichStation');
// 1) Passthrough when lat/lng already present
const a = await enrichStation({ nameRef: 'Niquia', lat: 6.31, lng: -75.55 });
assertEq('passthrough.lat', a.lat, 6.31);

// 2) Bus mode: looks up in rutas_integradas.json
const b = await enrichStation({ nameRef: 'Niquia' }, 'bus_articulado');
assertEq('bus.niquia.lat', b.lat, 6.3074);
assertEq('bus.niquia.lng', b.lng, -75.5535);

// 3) Metro mode: looks up in Estaciones_Sistema_Metro.csv
const c = await enrichStation({ nameRef: 'Acevedo' }, 'metro');
assertEq('metro.acevedo.lat', c.lat, 6.29994259053742);
assertEq('metro.acevedo.lng', c.lng, -75.55855570731788);

// 4) Unknown name returns same shape with no lat/lng (caller decides what to do)
const d = await enrichStation({ nameRef: 'Parada Inventada XYZ' });
assertEq('unknown.lat', d.lat, undefined);
assertEq('unknown.lng', d.lng, undefined);

console.log('\n-----');
if (failed === 0) { console.log('ALL TESTS PASS (' + passed + '/' + (passed+failed) + ')'); process.exit(0); }
else { console.log('FAILED ' + failed); process.exit(1); }
