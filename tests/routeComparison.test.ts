import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { rankRoutes, walkingMinutes, timeTradeoff } from '../src/lib/routeComparison';
import type { RouteOption } from '../src/lib/routing';

const route = (id: string, duration: number, cost: number, walk: number, transfers = 0): RouteOption => ({
  id, duration, cost, transfers, modes: ['metro', 'walk'],
  steps: [{ mode: 'walk', duration: walk, instruction: 'Camina' }],
});
const routes = [route('fast', 20, 5000, 10, 2), route('cheap', 30, 3000, 5, 1), route('short-walk', 25, 4000, 2)];

test('ranks each priority and keeps original indices for map selection', () => {
  assert.deepEqual(rankRoutes(routes, 'cost').map(x => x.index), [1, 2, 0]);
  assert.deepEqual(rankRoutes(routes, 'duration').map(x => x.index), [0, 2, 1]);
  assert.deepEqual(rankRoutes(routes, 'walking').map(x => x.index), [2, 1, 0]);
  assert.deepEqual(rankRoutes(routes, 'transfers').map(x => x.index), [2, 1, 0]);
  assert.deepEqual(routes.map(x => x.id), ['fast', 'cheap', 'short-walk']);
});
test('unknown or incomplete walking time is not presented as zero', () => {
  assert.equal(walkingMinutes({ ...routes[0], steps: [] }), null);
  assert.equal(walkingMinutes(route('unknown', 20, 0, NaN)), null);
  assert.equal(walkingMinutes({ ...routes[0], modes: ['metro'], steps: [{ mode: 'metro', duration: 12, instruction: 'Metro' }] }), 0);
});
test('missing values sort last and equal priorities use duration', () => {
  assert.deepEqual(rankRoutes([route('unknown', 10, NaN, NaN), route('known', 25, 0, 0)], 'cost').map(x => x.index), [1, 0]);
  assert.deepEqual(rankRoutes([route('a', 30, 1, 2), route('b', 20, 1, 2)], 'cost').map(x => x.index), [1, 0]);
  assert.deepEqual(rankRoutes([], 'duration'), []);
});
test('tradeoffs reflect actual candidates rather than a fabricated promise', () => {
  assert.equal(timeTradeoff(routes[1], routes), 10);
  assert.equal(timeTradeoff(routes[0], routes), 0);
  assert.equal(timeTradeoff(route('unknown', NaN, 0, 0), routes), null);
});
