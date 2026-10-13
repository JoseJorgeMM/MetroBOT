import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMapLayerSystem, visibleMapSystems } from '../src/lib/mapLayers';

test('shows the core SITVA systems by default and keeps EnCicla hidden', () => {
  assert.deepEqual(visibleMapSystems(), ['Metro', 'Cable', 'MPLUS', 'T']);
});

test('adds systems used by the active route while navigating', () => {
  assert.deepEqual(
    visibleMapSystems({ isNavigating: true, routeSystems: ['Metro', 'EnCicla'] }),
    ['Metro', 'Cable', 'MPLUS', 'T', 'EnCicla'],
  );
});

test('does not reveal a normally hidden route system outside navigation', () => {
  assert.deepEqual(
    visibleMapSystems({ isNavigating: false, routeSystems: ['EnCicla'] }),
    ['Metro', 'Cable', 'MPLUS', 'T'],
  );
});

test('normalizes station catalog labels before applying a layer filter', () => {
  assert.equal(normalizeMapLayerSystem('MPLUS'), 'MPLUS');
  assert.equal(normalizeMapLayerSystem('Metroplús'), 'MPLUS');
  assert.equal(normalizeMapLayerSystem('T'), 'T');
  assert.equal(normalizeMapLayerSystem('desconocido'), undefined);
});
