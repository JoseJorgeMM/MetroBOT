import test from 'node:test';
import assert from 'node:assert/strict';
import { parseServiceStatus, isFreshStatus, routeServiceLines, LINE_IDS } from '../src/lib/serviceStatus';
import { createServiceStatusHandler } from '../server/serviceStatus';
import { createServiceStatusClient } from '../src/lib/serviceStatusClient';

const now = Date.parse('2026-10-13T15:00:00Z');
const payload = () => ({ ok: true, data: {
  semaforos: LINE_IDS.map(lineaId => ({ lineaId, estado: lineaId === 'L' ? '58' : '2' })),
  estados: [{ id: '2', text: 'Normal', color: 'Verde' }, { id: '58', text: 'Fuera de servicio - Baja', color: 'Rojo' }, { id: '59', text: 'Normal - Alta', color: 'Estación o parada por fuera' }],
} });
const request = () => new Request('http://localhost/api/metro-status');

test('official feed preserves wording and is explicitly line-level without publication time', () => {
  const result = parseServiceStatus(payload(), now);
  assert.equal(result.lines.length, 12);
  assert.equal(result.lines.find(l => l.id === 'L')?.status, 'suspended');
  assert.equal(result.lines.find(l => l.id === 'L')?.message, 'Fuera de servicio - Baja');
  assert.equal(result.sourceUpdatedAt, null);
  assert.equal(Date.parse(result.expiresAt) - Date.parse(result.checkedAt), 300000);
  assert.equal(isFreshStatus(result, now + 300000), false);
});
test('missing, duplicated and unknown lines/states never silently turn green', () => {
  const data = payload();
  data.data.semaforos = [{ lineaId: 'A', estado: '2' }, { lineaId: 'A', estado: '2' }, { lineaId: 'B', estado: '999' }, { lineaId: 'T', estado: '59' }];
  const result = parseServiceStatus(data, now);
  for (const id of ['A', 'B', 'K']) assert.equal(result.lines.find(l => l.id === id)?.status, 'unknown');
  assert.equal(result.lines.find(l => l.id === 'T')?.status, 'warning');
  for (const malformed of [null, {}, { ok: false }, { ok: true, data: { semaforos: [], estados: [] } }]) assert.throws(() => parseServiceStatus(malformed, now));
});
test('a changed normal definition is not treated as normal', () => {
  const data = payload(); data.data.estados[0].text = 'Normal con restricciones';
  assert.notEqual(parseServiceStatus(data, now).lines[0].status, 'normal');
});
test('backend uses fixed upstream, cache headers and GET only', async () => {
  let calls = 0;
  const handler = createServiceStatusHandler({ now: () => now, fetcher: async (url, init) => {
    calls++; assert.equal(String(url), 'https://www.metrodemedellin.gov.co/_hcms/api/semaforos');
    assert.ok(init?.signal); return Response.json(payload());
  } });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('Vercel-CDN-Cache-Control')!, /s-maxage=300/);
  const rejected = await handler(new Request(request(), { method: 'POST' }));
  assert.equal(rejected.status, 405); assert.equal(calls, 1);
});
test('upstream HTTP, malformed JSON and network failure return uncached unknown, never stale success', async () => {
  for (const fetcher of [async () => new Response('', { status: 503 }), async () => new Response('not json'), async () => { throw Error('offline'); }]) {
    const response = await createServiceStatusHandler({ fetcher, now: () => now })(request());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'no-store');
    const data = await response.json(); assert.equal(data.availability, 'unavailable');
    assert.ok(data.lines.every(l => l.status === 'unknown'));
  }
});
test('client deduplicates concurrent requests and expires cached evidence', async () => {
  let time = now, calls = 0;
  const client = createServiceStatusClient({ now: () => time, fetcher: async () => {
    calls++; return Response.json(parseServiceStatus(payload(), time));
  } });
  await Promise.all([client(), client(), client()]); assert.equal(calls, 1);
  await client(); assert.equal(calls, 1);
  time += 300001; await client(); assert.equal(calls, 2);
});
test('client rejects expired, malformed and future evidence', async () => {
  for (const body of [{}, parseServiceStatus(payload(), now - 300001), parseServiceStatus(payload(), now + 120000)]) {
    const result = await createServiceStatusClient({ now: () => now, fetcher: async () => Response.json(body) })();
    assert.equal(result.availability, 'unavailable');
  }
});
test('route matching requires a compatible system or official bus agency, not just a line number', () => {
  const result = routeServiceLines({ steps: [
    { mode: 'metro', line: 'Línea A' }, { mode: 'metrocable', line: 'L' },
    { mode: 'bus', line: '1', transit: { agencies: [{ name: 'Metro de Medellín' }] } },
    { mode: 'bus', line: '2', transit: { agencies: [{ name: 'Otro operador' }] } },
    { mode: 'bus', line: '260-2' }, { mode: 'metro', line: 'A' }, { mode: 'walk' },
  ] } as any);
  assert.deepEqual(result.ids, ['A', 'L', '1']); assert.equal(result.uncovered, true);
  assert.deepEqual(routeServiceLines({ steps: [{ mode: 'bus', line: '1' }] } as any).ids, []);
});

test('backend aborts stalled upstream and rejects oversized responses', async () => {
  const stalled: typeof fetch = (_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Error('timeout')), { once: true });
  });
  // Keep the event loop alive while AbortSignal.timeout (an unref timer) fires.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const response = await createServiceStatusHandler({ fetcher: stalled, timeoutMs: 5 })(request());
    assert.equal(response.status, 503);
    const oversized = await createServiceStatusHandler({ fetcher: async () => new Response('x'.repeat(65000)) })(request());
    assert.equal(oversized.status, 503);
  } finally { clearTimeout(keepAlive); }
});

test('synchronous fetch failures recover after cooldown instead of pinning a resolved in-flight promise', async () => {
  let time = now, calls = 0;
  const client = createServiceStatusClient({ now: () => time, fetcher: () => {
    calls++; if (calls === 1) throw Error('unavailable');
    return Promise.resolve(Response.json(parseServiceStatus(payload(), time)));
  } });
  assert.equal((await client()).availability, 'unavailable');
  time += 30001;
  assert.equal((await client()).availability, 'available');
});
