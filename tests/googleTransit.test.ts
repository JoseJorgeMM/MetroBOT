import test from 'node:test';
import assert from 'node:assert/strict';
import { mapGoogleRoutes, decodePolyline, validPoint } from '../src/lib/googleTransit';
import { planTransit } from '../src/lib/transitPlanner';
import { createTransitHandler } from '../server/transit';

const origin = { lat: 6.25, lng: -75.57, name: 'Origen' };
const destination = { lat: 6.28, lng: -75.59, name: 'Destino' };
const polyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const fixture = { routes: [{ duration: '2460s', polyline: { encodedPolyline: polyline }, legs: [{ steps: [
  { travelMode: 'WALK', staticDuration: '120s', navigationInstruction: { instructions: 'Camina a la parada' }, polyline: { encodedPolyline: polyline } },
  { travelMode: 'TRANSIT', staticDuration: '1800s', polyline: { encodedPolyline: polyline }, transitDetails: {
    headsign: 'Robledo', stopCount: 8,
    stopDetails: { departureStop: { name: 'Universidad' }, arrivalStop: { name: 'Robledo' }, departureTime: '2026-09-25T13:25:00Z', arrivalTime: '2026-09-25T13:55:00Z' },
    transitLine: { nameShort: '260-2', vehicle: { type: 'BUS' }, agencies: [{ name: 'Operador', uri: 'https://example.org' }] },
  } },
] }] }] };

test('maps Google transit geometry, stops and times without inventing fares or waiting time', () => {
  const [route] = mapGoogleRoutes(fixture, origin, destination);
  assert.equal(route.source, 'google');
  assert.equal(route.duration, 41);
  assert.equal(route.cost, -1);
  assert.equal(route.transfers, 0);
  assert.equal(route.googlePolyline, polyline);
  assert.equal(route.steps[1].line, '260-2');
  assert.equal(route.steps[1].transit?.departureStop, 'Universidad');
  assert.equal(route.steps[1].transit?.departureTime, '2026-09-25T13:25:00Z');
  assert.match(route.steps[1].instruction, /Robledo/);
});
test('validates coordinates and rejects malformed geometry or incomplete Google results', () => {
  assert.equal(validPoint(origin), true);
  assert.equal(validPoint({ lat: '6.25', lng: -75.57 }), false);
  assert.equal(validPoint({ lat: NaN, lng: -75.57 }), false);
  assert.equal(validPoint({ lat: 91, lng: 0 }), false);
  assert.deepEqual(decodePolyline(polyline)[0], { lat: 38.5, lng: -120.2 });
  assert.throws(() => decodePolyline('_'));
  assert.deepEqual(mapGoogleRoutes({}, origin, destination), []);
  assert.deepEqual(mapGoogleRoutes({ routes: [{ duration: 'NaNs' }] }, origin, destination), []);
});
test('primary success never calls local routing; errors use labelled local fallback', async () => {
  const routes = mapGoogleRoutes(fixture, origin, destination);
  const good = await planTransit(origin, destination, { google: async () => routes, local: async () => { throw Error('must not call'); } });
  assert.equal(good.routes[0].source, 'google');
  const backup = await planTransit(origin, destination, { google: async () => { throw Error('QUOTA'); }, local: async () => routes });
  assert.equal(backup.routes[0].source, 'local');
  assert.match(backup.notice, /respaldo local/i);
  const empty = await planTransit(origin, destination, { google: async () => [], local: async () => [] });
  assert.equal(empty.routes.length, 0);
});
const req = (body: unknown = { origin, destination }) => new Request('https://metro.test/api/transit-routes', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://metro.test' }, body: JSON.stringify(body) });
test('endpoint validates before Google, uses TRANSIT and protects key and cache', async () => {
  let calls = 0;
  const handler = createTransitHandler({ key: 'server-secret', fetcher: async (_url, init) => {
    calls++;
    const body = JSON.parse(init!.body as string);
    assert.equal(body.travelMode, 'TRANSIT');
    assert.equal(body.computeAlternativeRoutes, true);
    assert.equal(new Headers(init?.headers).get('X-Goog-Api-Key'), 'server-secret');
    return Response.json(fixture);
  } });
  assert.equal((await handler(req({ origin: { lat: 100, lng: 0 }, destination }))).status, 400);
  assert.equal(calls, 0);
  const response = await handler(req());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control')!, /no-store/);
  assert.doesNotMatch(await response.text(), /server-secret/);
  assert.equal(calls, 1);
});
test('endpoint reports configuration, quota, empty results and rejects cross-origin requests', async () => {
  assert.equal((await createTransitHandler({ key: '' })(req())).status, 503);
  for (const status of [403, 429, 500]) {
    const response = await createTransitHandler({ key: 'private', fetcher: async () => new Response('private upstream details', { status }) })(req());
    assert.doesNotMatch(await response.text(), /private/);
    assert.notEqual(response.status, 200);
  }
  const noRoutes = await createTransitHandler({ key: 'key', fetcher: async () => Response.json({}) })(req());
  assert.equal(noRoutes.status, 404);
  assert.equal((await createTransitHandler({ key: 'key' })(new Request('https://metro.test/api/transit-routes'))).status, 405);
  const foreign = new Request(req(), { headers: { Origin: 'https://foreign.test', 'Content-Type': 'application/json' } });
  assert.equal((await createTransitHandler({ key: 'key' })(foreign)).status, 403);
});

test('endpoint aborts a slow provider and never exposes upstream detail', async () => {
  const handler = createTransitHandler({ key: 'secret', timeoutMs: 5, fetcher: async (_, init) => new Promise<Response>((_, reject) => {
    init!.signal!.addEventListener('abort', () => reject(Error('secret detail')), { once: true });
  }) });
  const response = await handler(req());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { code: 'TIMEOUT' });
});
test('endpoint limits payloads and request bursts without additional Google calls', async () => {
  let calls = 0;
  const handler = createTransitHandler({ key: 'key', fetcher: async () => { calls++; return Response.json(fixture); } });
  assert.equal((await handler(req({ origin, destination, extra: 'x'.repeat(5000) }))).status, 413);
  assert.equal(calls, 0);
  for (let i = 0; i < 20; i++) assert.equal((await handler(req())).status, 200);
  assert.equal((await handler(req())).status, 429);
  assert.equal(calls, 20);
});
test('COP fares are preserved and empty Google routes trigger local exactly once', async () => {
  const payload = structuredClone(fixture) as any;
  payload.routes[0].travelAdvisory = { transitFare: { currencyCode: 'COP', units: '3500' } };
  assert.equal(mapGoogleRoutes(payload, origin, destination)[0].cost, 3500);
  payload.routes[0].travelAdvisory.transitFare.currencyCode = 'USD';
  assert.equal(mapGoogleRoutes(payload, origin, destination)[0].cost, -1);
  let calls = 0;
  const result = await planTransit(origin, destination, { google: async () => [], local: async () => { calls++; return []; } });
  assert.equal(calls, 1);
  assert.match(result.notice, /no encontró recorridos/);
});

test('malformed Google agency data fails at the server boundary, not in React', async () => {
  for (const agencies of [{ name: 'not an array' }, [null], [{ name: { nested: 'bad' } }]]) {
    const payload = structuredClone(fixture) as any;
    payload.routes[0].legs[0].steps[1].transitDetails.transitLine.agencies = agencies;
    const response = await createTransitHandler({ key: 'key', fetcher: async () => Response.json(payload) })(req());
    assert.notEqual(response.status, 200);
  }
});
