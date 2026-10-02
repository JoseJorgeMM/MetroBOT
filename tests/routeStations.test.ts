import test from 'node:test';
import assert from 'node:assert/strict';
import { mapGoogleRoutes } from '../src/lib/googleTransit';
import { getRouteStops, matchStation } from '../src/lib/routeStations';
import type { Station } from '../src/lib/stations';

const point = { lat: 6.269, lng: -75.566 };
const metro: Station = { ...point, id: 'm', nombre: 'Universidad', sistema: 'Metro', linea: 'A' };
const bike: Station = { ...point, id: 'b', nombre: 'Universidad', sistema: 'EnCicla', linea: 'Bicis' };
const fixture = { routes: [{ duration: '600s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }, legs: [{ steps: [{
  travelMode: 'TRANSIT', staticDuration: '600s', transitDetails: { transitLine: { vehicle: { type: 'SUBWAY' } }, stopDetails: {
    departureStop: { name: 'Universidad', location: { latLng: { latitude: point.lat, longitude: point.lng } } },
    arrivalStop: { name: 'Invalid', location: { latLng: { latitude: 999, longitude: 0 } } },
  } },
}] }] }] };
test('preserves real Google stop positions and rejects invalid ones', () => {
  const route = mapGoogleRoutes(fixture, point, point)[0];
  assert.deepEqual(route.steps[0].transit?.departureLocation, point);
  assert.equal(route.steps[0].transit?.arrivalLocation, undefined);
});
test('matches normalized name, position and mode, not a nearby bicycle namesake', () => {
  assert.equal(matchStation('Estación Universidad', point, 'metro', [bike, metro])?.id, 'm');
  assert.equal(matchStation('Universidad', { lat: 6.5, lng: -75.5 }, 'metro', [metro]), undefined);
  assert.equal(matchStation('Other', point, 'metro', [metro]), undefined);
  assert.equal(matchStation('Universidad', point, 'bus', [metro]), undefined);
});
test('recognizes Metroplús bus endpoints only when their names also match', () => {
  const stop = { ...metro, nombre: 'Gardel', sistema: 'MPLUS', linea: '1' };
  assert.equal(matchStation('Gardel', point, 'bus', [stop])?.linea, '1');
  assert.equal(matchStation('Hospital', point, 'bus', [stop]), undefined);
});
test('keeps unmatched Google stops and omits stops without trustworthy coordinates', () => {
  const route = mapGoogleRoutes(fixture, point, point)[0];
  const stops = getRouteStops(route, []);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].name, 'Universidad');
  assert.equal(stops[0].visits[0].role, 'Sube aquí');
  assert.equal(stops[0].station, undefined);
});
test('merges transfers at a station without losing either route instruction', () => {
  const route = mapGoogleRoutes(fixture, point, point)[0];
  route.steps.push({ mode: 'metro', duration: 2, instruction: 'Baja', transit: { agencies: [], arrivalStop: 'Universidad', arrivalLocation: point } });
  const stops = getRouteStops(route, [metro]);
  assert.equal(stops.length, 1);
  assert.equal(stops[0].visits.length, 2);
});
