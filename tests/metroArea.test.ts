import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinMetroArea, metroAreaRestriction } from '../src/lib/metroArea';

test('accepts places in the Valle de Aburrá and rejects outside search results', () => {
  assert.equal(isWithinMetroArea({ lat: 6.2533, lng: -75.5883 }), true, 'Estadio');
  assert.equal(isWithinMetroArea({ lat: 6.1577, lng: -75.6437 }), true, 'La Estrella');
  assert.equal(isWithinMetroArea({ lat: 4.6486, lng: -74.2479 }), false, 'Bogotá');
  assert.equal(isWithinMetroArea({ lat: Number.NaN, lng: -75.58 }), false);
});

test('exports a non-degenerate Google Places restriction covering the service area', () => {
  assert.ok(metroAreaRestriction.south < 6.1577);
  assert.ok(metroAreaRestriction.north > 6.2533);
  assert.ok(metroAreaRestriction.west < -75.6437);
  assert.ok(metroAreaRestriction.east > -75.5883);
});
