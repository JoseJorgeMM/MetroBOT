// tests/test_map_stations_filter.mjs
import { getVisibleStations } from './_map_stations_filter_impl.mjs';

let pass = 0, fail = 0;
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, '\n      actual:  ', a, '\n      expected:', e); }
}

const S = (id, nombre) => ({ id, nombre, lat: 0, lng: 0, sistema: 'metro', linea: '1' });
const R = (originName, destName, transferNames) => ({
  originStation: { name: originName, lat: 0, lng: 0 },
  destinationStation: { name: destName, lat: 0, lng: 0 },
  steps: transferNames.map((n) => ({ station: { name: n, lat: 0, lng: 0 } })),
});

const stations = [
  S('a', 'Acevedo'),
  S('b', 'San Javier'),
  S('c', 'Poblado'),
  S('d', 'Niquia'),
  S('e', 'Itagui'),
];

console.log('filter: not navigating -> show all');
assertEq('returns all when isNavigating=false', getVisibleStations(stations, null, false).length, 5);
assertEq('returns all when isNavigating=false and route present', getVisibleStations(stations, R('Acevedo', 'Poblado', []), false).length, 5);

console.log('filter: navigating, no route -> show none');
assertEq('empty list when isNavigating=true and route is null', getVisibleStations(stations, null, true), []);

console.log('filter: navigating, simple route -> origin + dest only');
{
  const route = R('Acevedo', 'Poblado', []);
  const out = getVisibleStations(stations, route, true);
  const names = out.map((s) => s.nombre).sort();
  assertEq('shows origin and dest only', names, ['Acevedo', 'Poblado']);
}

console.log('filter: navigating, route with transfer -> origin + transfer + dest');
{
  const route = R('Acevedo', 'Poblado', ['San Javier']);
  const out = getVisibleStations(stations, route, true);
  const names = out.map((s) => s.nombre).sort();
  assertEq('shows origin + transfer + dest', names, ['Acevedo', 'Poblado', 'San Javier']);
}

console.log('filter: name normalization (case + accents)');
{
  const route = {
    originStation: { name: 'Acevedo' },
    destinationStation: { name: 'Poblado' },
    steps: [{ station: { nameRef: 'San_Javier' } }],
  };
  const out = getVisibleStations(stations, route, true);
  const names = out.map((s) => s.nombre).sort();
  assertEq('case-insensitive + accent-stripped match', names, ['Acevedo', 'Poblado', 'San Javier']);
}

console.log('filter: nameRef preferred over name');
{
  const route = {
    originStation: { name: 'A' },
    destinationStation: { name: 'B' },
    steps: [{ station: { name: 'A', nameRef: 'Poblado' } }],
  };
  const out = getVisibleStations(stations, route, true);
  const names = out.map((s) => s.nombre).sort();
  assertEq('nameRef wins when both present', names, ['Poblado']);
}

console.log('filter: empty input');
assertEq('null allStations -> []', getVisibleStations(null, R('A', 'B', []), true), []);
assertEq('undefined allStations -> []', getVisibleStations(undefined, R('A', 'B', []), true), []);
assertEq('empty array -> []', getVisibleStations([], R('A', 'B', []), true), []);

console.log('filter: stations without matching route names -> []');
{
  const route = R('Estacion Inexistente 1', 'Estacion Inexistente 2', []);
  const out = getVisibleStations(stations, route, true);
  assertEq('no matches -> []', out, []);
}

console.log('filter: route with no origin/dest but with step.station');
{
  const route = {
    originStation: null,
    destinationStation: null,
    steps: [{ station: { name: 'Itagui' } }],
  };
  const out = getVisibleStations(stations, route, true);
  assertEq('steps still contribute', out.map((s) => s.nombre), ['Itagui']);
}

console.log('filter: returns a NEW array (does not mutate input)');
{
  const orig = stations.slice();
  getVisibleStations(stations, R('Acevedo', 'Poblado', []), true);
  assertEq('input unchanged', stations, orig);
}

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass + fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass + fail)); process.exit(1); }