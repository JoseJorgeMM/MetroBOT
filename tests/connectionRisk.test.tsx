import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RouteOption, RouteStep } from '../src/lib/routing';
import { assessConnections } from '../src/lib/journey/connectionRisk';
import { ConnectionRiskPanel } from '../src/components/RouteCards/ConnectionRiskPanel';

const transit = (arrivalTime?: string, departureTime?: string): RouteStep => ({ mode: 'metro', duration: 10, instruction: 'Metro', transit: { arrivalTime, departureTime, arrivalStop: 'San Antonio', departureStop: 'San Antonio', agencies: [] } });
const route = (steps: RouteStep[]): RouteOption => ({ id: 'test', source: 'google', duration: 30, cost: -1, transfers: 1, modes: steps.map(s => s.mode), steps });
const trip = route([transit('2026-10-13T10:00:00-05:00'), { mode: 'walk', duration: 4, instruction: 'Camina' }, transit(undefined, '2026-10-13T10:08:00-05:00')]);

test('subtracts walking once and exposes a delay scenario without changing the itinerary', () => {
  const original = JSON.stringify(trip);
  assert.equal(assessConnections(trip)[0].margin, 4);
  assert.equal(assessConnections(trip, 2)[0].adjustedMargin, 2);
  assert.equal(assessConnections(trip, 2)[0].status, 'tight');
  assert.equal(assessConnections(trip, 5)[0].status, 'insufficient');
  assert.equal(JSON.stringify(trip), original);
});
test('missing or reversed schedules never produce a reassuring margin', () => {
  assert.equal(assessConnections(route([transit(), transit()]))[0].status, 'unknown');
  const reversed = route([transit('2026-10-13T10:00:00-05:00'), transit(undefined, '2026-10-13T09:59:00-05:00')]);
  assert.equal(assessConnections(reversed)[0].margin, null);
});
test('only intermediate walking counts and midnight uses full timestamps', () => {
  const steps: RouteStep[] = [{ mode: 'walk', duration: 20, instruction: 'Inicio' }, transit('2026-10-13T23:58:00-05:00'), transit(undefined, '2026-10-14T00:03:00-05:00')];
  assert.equal(assessConnections(route(steps))[0].margin, 5);
  assert.equal(assessConnections(route(steps))[0].walking, 0);
});
test('unknown walking, bikes, and invalid delay inputs cannot imply sufficient time', () => {
  for (const step of [{ mode: 'walk', duration: -1 }, { mode: 'encicla', duration: 2 }, { mode: 'walk', duration: NaN }] as const) {
    assert.equal(assessConnections(route([trip.steps[0], { ...step, instruction: 'Traslado' }, trip.steps[2]]))[0].status, 'unknown');
  }
  assert.throws(() => assessConnections(trip, -1));
  assert.throws(() => assessConnections(trip, NaN));
  assert.equal(assessConnections(route([transit()])).length, 0);
});
test('long transfer walks are visible even when schedules are missing', () => {
  const result = assessConnections(route([transit(), { mode: 'walk', duration: 12, instruction: 'Camina' }, transit()]))[0];
  assert.equal(result.longWalk, true);
  assert.equal(result.margin, null);
});
test('card explains evidence and missing operational coverage without a probability', () => {
  const html = renderToStaticMarkup(<ConnectionRiskPanel route={trip} />);
  assert.match(html, /Margen de transbordos/);
  assert.match(html, /4 min/);
  assert.match(html, /Accesibilidad e interrupciones sin verificar/);
  assert.match(html, /retraso/i);
  assert.doesNotMatch(html, /riesgo bajo|garantizado|\d+%/i);
});

test('selecting a delay updates the displayed connection, and resetting restores it', async () => {
  const window = new Window();
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const container = window.document.createElement('div');
  const root = createRoot(container as unknown as HTMLElement);
  try {
    await act(() => root.render(<ConnectionRiskPanel route={trip} />));
    const select = container.querySelector('select')!;
    await act(() => { select.value = '5'; select.dispatchEvent(new window.Event('change', { bubbles: true })); });
    assert.match(container.textContent, /Tiempo insuficiente/);
    assert.match(container.textContent, /Con retraso: -1 min/);
    await act(() => { select.value = '0'; select.dispatchEvent(new window.Event('change', { bubbles: true })); });
    assert.doesNotMatch(container.textContent, /Tiempo insuficiente/);
  } finally {
    await act(() => root.unmount());
    await window.happyDOM.abort();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
