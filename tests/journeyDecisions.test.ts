import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { evaluateJourneys, serviceKeys, serviceLabel } from '../src/lib/journey/decisions';
import { defaultNeeds } from '../src/lib/journey/types';
import type { RouteOption } from '../src/lib/routing';
import type { FareResult } from '../src/lib/fares/types';

const fare = (total: number | null, status: FareResult['status'] = 'DETERMINADA'): FareResult => ({
  total, status, currency: 'COP', profile: 'adult', version: 'test', integrationApplied: false,
  withoutIntegration: total, savings: null, chains: [], breakdown: [], warnings: [], unresolved: [],
});
const route = (duration = 20, walk = 5, transfers = 1, total = 3000): RouteOption => ({
  id: 'route', duration, transfers, cost: 0, fare: fare(total), modes: ['walk', 'metro'],
  steps: [{ mode: 'walk', duration: walk, instruction: 'Camina' },
    { mode: 'metro', duration: 10, line: 'Línea A', instruction: 'Metro' }],
});

test('budget uses calculated fares and rejects missing, unresolved and invalid totals', () => {
  const routes = [route(), { ...route(), fare: undefined }, { ...route(), fare: fare(100, 'NO_DETERMINADA') },
    ...[null, NaN, Infinity, -1].map(total => ({ ...route(), fare: fare(total) }))];
  const result = evaluateJourneys(routes, { ...defaultNeeds, maxCost: 3000 });
  assert.equal(result.recommendedIndex, 0);
  assert.deepEqual(result.options.map(x => x.eligible), [true, false, false, false, false, false, false]);
  assert.ok(result.options.slice(1).every(x => x.unknowns.length > 0));
  assert.equal(evaluateJourneys([{ ...route(), fare: undefined, cost: 1, providerFare: { amount: 1 } }],
    { ...defaultNeeds, maxCost: 5000 }).recommendedIndex, null);
});

test('conditional fares satisfy a budget only conditionally and still obey its limit', () => {
  const candidate = { ...route(), fare: fare(3000, 'CONDICIONAL') };
  const result = evaluateJourneys([candidate], { ...defaultNeeds, maxCost: 3000 });
  assert.equal(result.options[0].conditional, true);
  assert.equal(result.options[0].eligible, true);
  assert.equal(result.recommendedIndex, 0);
  assert.equal(evaluateJourneys([candidate], { ...defaultNeeds, maxCost: 2999 }).recommendedIndex, null);
});

test('conflicting constraints yield no recommendation rather than relaxing requirements', () => {
  const result = evaluateJourneys([route(10, 10), route(30, 1)],
    { ...defaultNeeds, maxDurationMinutes: 15, maxWalkingMinutes: 2 });
  assert.equal(result.recommendedIndex, null);
  assert.equal(result.tradeoff, null);
  assert.ok(result.options.every(x => !x.eligible && x.violations.length));
});

test('service identities normalize accents, line prefixes and whitespace, and exclude exactly', () => {
  const candidate = route();
  candidate.steps.push({ mode: 'metro', line: '  línea   á  ', duration: 1, instruction: '' },
    { mode: 'bus', line: 'Línea A', duration: 1, instruction: '' },
    { mode: 'encicla', duration: 1, instruction: '' });
  assert.deepEqual(serviceKeys(candidate), ['metro:A', 'bus:A']);
  assert.equal(serviceLabel('metro:A'), 'Metro · Línea A');
  assert.equal(serviceLabel('bus:A'), 'Bus · Línea A');
  assert.deepEqual(serviceKeys({ ...route(), steps: [{ mode: 'transit', duration: 2, instruction: '' }] }), ['transit:']);
  assert.equal(serviceLabel('transit:'), 'Transporte público');
  const result = evaluateJourneys([candidate], defaultNeeds, 'metro:A');
  assert.deepEqual(result.services, ['metro:A', 'bus:A']);
  assert.equal(result.options.length, 1);
  assert.equal(result.recommendedIndex, null);
  assert.ok(result.options[0].violations.some(x => x.includes('Metro')));
  assert.equal(evaluateJourneys([route()], defaultNeeds, 'bus:A').recommendedIndex, 0);
});

test('finite nonnegative constrained metrics are required, including overflowing walking totals', () => {
  for (const invalid of [NaN, Infinity, -1, undefined]) {
    for (const metric of ['duration', 'walking', 'transfers'] as const) {
      const candidate = route();
      if (metric === 'walking') candidate.steps[0].duration = invalid as number;
      else candidate[metric] = invalid as number;
      const result = evaluateJourneys([candidate], {
        ...defaultNeeds, maxDurationMinutes: 100, maxWalkingMinutes: 100, maxTransfers: 100,
      });
      assert.equal(result.recommendedIndex, null, `${metric}: ${invalid}`);
      assert.ok(result.options[0].unknowns.length);
    }
  }
  const overflowing = route();
  overflowing.steps = [0, 1].map(() => ({ mode: 'walk', duration: Number.MAX_VALUE, instruction: '' }));
  assert.equal(evaluateJourneys([overflowing], { ...defaultNeeds, maxWalkingMinutes: 100 }).recommendedIndex, null);
  assert.equal(evaluateJourneys([route(0, 0, 0, 0)], {
    ...defaultNeeds, maxCost: 0, maxWalkingMinutes: 0, maxDurationMinutes: 0, maxTransfers: 0,
  }).recommendedIndex, 0);
});

test('unknown unconstrained metrics never receive a zero ranking advantage', () => {
  const unknown = { ...route(NaN, NaN, NaN), fare: undefined };
  for (const priority of ['balanced', 'cost', 'duration', 'walking', 'transfers'] as const) {
    const result = evaluateJourneys([unknown, route()], { ...defaultNeeds, priority });
    assert.equal(result.options[0].eligible, false);
    assert.ok(result.options[0].unknowns.length);
    assert.equal(result.recommendedIndex, 1, priority);
  }
});

test('each priority ranks its metric and equal values retain original index', () => {
  const routes = [route(10, 10, 3, 6000), route(30, 6, 2, 1000), route(40, 1, 1, 4000), route(50, 7, 0, 5000)];
  for (const [priority, expected] of [['duration', 0], ['cost', 1], ['walking', 2], ['transfers', 3]] as const) {
    assert.equal(evaluateJourneys(routes, { ...defaultNeeds, priority }).recommendedIndex, expected);
  }
  assert.equal(evaluateJourneys([route(50), route(10)], { ...defaultNeeds, priority: 'cost' }).recommendedIndex, 0);
  assert.equal(evaluateJourneys([route(), route()], defaultNeeds).recommendedIndex, 0);
  assert.equal(evaluateJourneys([], defaultNeeds).recommendedIndex, null);
});

test('explicit priorities abstain when every eligible primary metric is unknown', () => {
  const cases = {
    cost: [{ ...route(), fare: undefined }, { ...route(), fare: fare(100, 'NO_DETERMINADA') }],
    duration: [route(NaN), route(Infinity)],
    walking: [route(20, NaN), route(20, -1)],
    transfers: [route(20, 5, NaN), route(20, 5, Infinity)],
  };
  for (const priority of ['cost', 'duration', 'walking', 'transfers'] as const) {
    const result = evaluateJourneys(cases[priority], { ...defaultNeeds, priority });
    assert.equal(result.recommendedIndex, null, priority);
    assert.equal(result.tradeoff, null);
    assert.ok(result.options.every(option => !option.eligible && option.unknowns.length));
    // A known metric on a constraint-rejected route must not enable a fallback.
    assert.equal(evaluateJourneys([...cases[priority], route(20, 5, 1, 9000)],
      { ...defaultNeeds, priority, maxCost: 5000 }).recommendedIndex, null, priority);
  }
});

test('balanced recommendations require known duration on the selected candidate', () => {
  assert.equal(evaluateJourneys([route(NaN, 0, 0), route(Infinity, 1, 1)], defaultNeeds).recommendedIndex, null);
  // Missing duration cannot win through better walking and transfer ranks.
  assert.equal(evaluateJourneys([route(NaN, 0, 0), route(30, 10, 2)], defaultNeeds).recommendedIndex, 1);
  assert.equal(evaluateJourneys([route(0, NaN, NaN)], defaultNeeds).recommendedIndex, 0);
});

test('missing primary data explains ineligibility even without constrained limits', () => {
  const cases = [
    ['cost', { ...route(), fare: undefined }, 'Costo: falta tarifa para comparar esta prioridad'],
    ['duration', route(NaN), 'Duración: falta duración para comparar esta prioridad'],
    ['walking', route(20, NaN), 'Caminata: falta tiempo a pie para comparar esta prioridad'],
    ['transfers', route(20, 5, NaN), 'Transbordos: falta cantidad de transbordos para comparar esta prioridad'],
    ['balanced', route(NaN), 'Duración: falta duración para comparar la prioridad equilibrada'],
  ] as const;
  for (const [priority, candidate, reason] of cases) {
    const result = evaluateJourneys([candidate], { ...defaultNeeds, priority });
    assert.deepEqual(result.options[0].unknowns, [reason], priority);
    assert.equal(result.options[0].eligible, false, priority);
    assert.deepEqual(result.options[0].violations, []);
    assert.equal(result.recommendedIndex, null);
  }
});

test('missing nonprimary unconstrained data remains optional', () => {
  const candidate = { ...route(20, NaN, NaN), fare: undefined };
  for (const priority of ['duration', 'balanced'] as const) {
    const result = evaluateJourneys([candidate], { ...defaultNeeds, priority });
    assert.equal(result.options[0].eligible, true);
    assert.deepEqual(result.options[0].unknowns, []);
    assert.equal(result.recommendedIndex, 0);
  }
});

test('wheelchair and other pending needs block recommendations until explicitly cleared', () => {
  const notes = ['Necesito acceso en silla de ruedas', 'Viajo con una bicicleta'];
  const needs = { ...defaultNeeds, notes };
  const result = evaluateJourneys([route(), route(30)], needs);
  assert.equal(result.recommendedIndex, null);
  assert.equal(result.tradeoff, null);
  for (const option of result.options) {
    assert.equal(option.eligible, false);
    assert.equal(option.pareto, false);
    assert.deepEqual(option.unknowns, notes.map(note => `Necesidad pendiente de verificar: ${note}`));
    assert.deepEqual(option.violations, []);
  }
  assert.deepEqual(needs.notes, ['Necesito acceso en silla de ruedas', 'Viajo con una bicicleta']);
  assert.equal(evaluateJourneys([route()], { ...needs, notes: [] }).recommendedIndex, 0);
});

test('pending needs retain the missing primary metric explanation', () => {
  const result = evaluateJourneys([{ ...route(), fare: undefined }], {
    ...defaultNeeds, priority: 'cost', notes: ['Necesito acceso en silla de ruedas'],
  });
  assert.deepEqual(result.options[0].unknowns, [
    'Necesidad pendiente de verificar: Necesito acceso en silla de ruedas',
    'Costo: falta tarifa para comparar esta prioridad',
  ]);
  assert.equal(result.options[0].eligible, false);
  assert.equal(result.recommendedIndex, null);
});

test('balanced ranking sums ordinal duration, walking and transfer ranks', () => {
  const routes = [route(10, 30, 4), route(20, 5, 1), route(30, 1, 0)];
  assert.equal(evaluateJourneys(routes, defaultNeeds).recommendedIndex, 2);
});

test('Pareto compares complete eligible metrics only, preserves ties and ignores unknowns', () => {
  const routes = [route(20, 5, 1, 3000), route(30, 6, 2, 4000), route(10, 10, 2, 5000),
    { ...route(1, 1, 0), fare: undefined }, route(20, 5, 1, 3000)];
  const result = evaluateJourneys(routes, defaultNeeds);
  assert.deepEqual(result.options.map(x => x.pareto), [true, false, true, false, true]);
});

test('failed or unsafe validation prevents recommendation with an explanation', () => {
  const validation = { ok: false, validatedSteps: 0, degradedSteps: 1, busLegs: [], degradedReasons: ['missing-route'] };
  for (const value of [validation, { ...validation, ok: true, unsafe: true }]) {
    const result = evaluateJourneys([{ ...route(), validation: value }], defaultNeeds);
    assert.equal(result.recommendedIndex, null);
    assert.ok(result.options[0].violations.length);
    assert.equal(result.options[0].pareto, false);
  }
});

test('tradeoff gives factual differences against fastest eligible option only', () => {
  const result = evaluateJourneys([route(20, 10), route(30, 2)], { ...defaultNeeds, priority: 'walking' });
  assert.equal(result.tradeoff, '10 min más de viaje; 8 min menos a pie');
  assert.equal(evaluateJourneys([route(), route()], defaultNeeds).tradeoff, null);
  assert.equal(evaluateJourneys([route(NaN, 2), route(20, NaN)], { ...defaultNeeds, priority: 'walking' }).tradeoff, null);
});

test('evaluation preserves inputs, references and original indices', () => {
  const routes = [route(30), route(10)];
  const before = structuredClone(routes);
  const result = evaluateJourneys(routes, { ...defaultNeeds, priority: 'duration' });
  assert.deepEqual(routes, before);
  assert.deepEqual(result.options.map(x => x.index), [0, 1]);
  assert.equal(result.options[1].route, routes[1]);
});
