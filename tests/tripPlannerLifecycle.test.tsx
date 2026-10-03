import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import React, { act, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { TripPlannerPanel } from '../src/components/TripPlannerPanel';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function harness(t: TestContext, startOnMount = false, initialQuery = '') {
  const window = new Window({ url: 'https://metro.test' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window, document: window.document,
    navigator: window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const changes: unknown[] = [];
  const alerts: string[] = [];
  t.mock.method(globalThis, 'fetch', async () => Response.json({ display_name: 'Actual' }));
  saved.set('alert', Object.getOwnPropertyDescriptor(globalThis, 'alert'));
  Object.defineProperty(globalThis, 'alert', { value: (text: string) => alerts.push(text), configurable: true });
  let success: PositionCallback;
  let failure: PositionErrorCallback;
  const successes: PositionCallback[] = [];
  Object.defineProperty(window.navigator, 'geolocation', { value: {
    getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) => { success = ok; failure = fail; successes.push(ok); },
  } });
  const container = window.document.createElement('div');
  window.document.body.append(container);
  const root = createRoot(container as unknown as HTMLElement);
  let mounted = true;
  const unmount = async () => { if (mounted) { await act(() => root.unmount()); mounted = false; } };
  t.after(async () => {
    await unmount();
    await window.happyDOM.abort();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  function Host() {
    useEffect(() => {
      if (startOnMount) [...container.querySelectorAll('button')].find(item => item.textContent.includes('Usar mi ubicación'))!.click();
    }, []);
    return <TripPlannerPanel origin={null} destination={null} initialQueries={{ origin: initialQuery, destination: '' }}
    busesEnabled isLoading={false} onOriginChange={place => changes.push(place)}
    onDestinationChange={place => changes.push(place)} onBusesEnabledChange={() => {}}
    onRequestMapSelection={() => {}} onSubmit={() => {}} onClose={() => {}} />;
  }
  await act(() => root.render(<StrictMode><Host /></StrictMode>));
  const locate = async () => act(() => {
    const button = [...container.querySelectorAll('button')].find(item => item.textContent.includes('Usar mi ubicación'))!;
    button.click();
  });
  return { window, container, changes, alerts, unmount, locate, successes,
    success: () => success!({ coords: { latitude: 6.25, longitude: -75.57 } } as GeolocationPosition),
    failure: () => failure!({ code: 1, message: 'denied' } as GeolocationPositionError) };
}

test('StrictMode replay leaves the active planner able to accept geolocation', async t => {
  const h = await harness(t);
  await h.locate();
  await act(async () => { await h.success(); });
  assert.deepEqual(h.changes, [{ lat: 6.25, lng: -75.57, name: 'Actual' }]);
});

test('geolocation delivered after unmount starts no reverse lookup or parent effect', async t => {
  const h = await harness(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({}); });
  await h.locate();
  await h.unmount();
  await act(async () => { await h.success(); });
  assert.equal(calls, 0);
  assert.deepEqual(h.changes, []);
});

test('reverse lookup completing after unmount cannot update parent endpoints', async t => {
  const h = await harness(t);
  const response = deferred<Response>();
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', (_url, init) => { signal = init?.signal as AbortSignal; return response.promise; });
  await h.locate();
  let completion: unknown;
  await act(() => { completion = h.success(); });
  await h.unmount();
  assert.equal(signal?.aborted, true);
  await act(async () => { response.resolve(Response.json({ display_name: 'Old trip' })); await completion; });
  assert.deepEqual(h.changes, []);
});

test('geolocation failure after unmount does not alert', async t => {
  const h = await harness(t);
  await h.locate();
  await h.unmount();
  await act(() => h.failure());
  assert.deepEqual(h.alerts, []);
});

test('StrictMode cleanup invalidates callbacks from its first setup', async t => {
  const h = await harness(t, true);
  assert.equal(h.successes.length, 2);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ display_name: 'Current' }); });
  await act(async () => { await h.successes[0]({ coords: { latitude: 1, longitude: 2 } } as GeolocationPosition); });
  assert.equal(calls, 0);
  assert.deepEqual(h.changes, []);
  await act(async () => { await h.success(); });
  assert.equal(h.changes.length, 1);
});

test('Google details delivered after unmount cannot update endpoints', async t => {
  const h = await harness(t, false, 'Old');
  let details!: (place: unknown, status: string) => void;
  const google = { maps: {
    LatLng: class {},
    places: {
      AutocompleteService: class { getPlacePredictions(_query: unknown, callback: Function) {
        callback([{ place_id: 'old', description: 'Old place' }]);
      } },
      PlacesService: class { getDetails(_query: unknown, callback: typeof details) { details = callback; } },
      PlacesServiceStatus: { OK: 'OK' },
    },
  } };
  Object.assign(h.window, { google });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'google');
  Object.defineProperty(globalThis, 'google', { value: google, configurable: true });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'google', previous); else Reflect.deleteProperty(globalThis, 'google'); });
  const input = h.container.querySelector('input')!;
  await act(() => input.focus());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
  await act(() => [...h.container.querySelectorAll('button')].find(button => button.getAttribute('role') === 'option')!.click());
  h.changes.length = 0;
  await h.unmount();
  await act(async () => { details({ geometry: { location: { lat: () => 1, lng: () => 2 } } }, 'OK'); });
  assert.deepEqual(h.changes, []);
});
