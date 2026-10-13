import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// Bundle real legacy consumers in memory, replacing only the shared client boundary.
// This keeps adapter tests independent of client caching and concurrent client work.
const bundle = await build({
  stdin: {
    contents: "export { getStationStatus } from './src/lib/routing'; export { getLiveMetroStatus } from './src/lib/gemini';",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'service-status-contract', setup(builder) {
    builder.onResolve({ filter: /serviceStatusClient$/ }, () => ({ path: 'client', namespace: 'status-test' }));
    builder.onLoad({ filter: /.*/, namespace: 'status-test' }, () => ({
      contents: "export async function getServiceStatus() { return (await fetch('mock:service-status')).json(); }",
    }));
  } }],
});
// Import package dependencies relative to this test, even though the bundle is a data URL.
const bundledSource = bundle.outputFiles[0].text.replace(/from "(@[^\"]+)"/g,
  (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`);
const { getStationStatus, getLiveMetroStatus } = await import(`data:text/javascript;base64,${Buffer.from(bundledSource).toString('base64')}`);
const ids = ['A', 'B', 'H', 'J', 'K', 'L', 'M', 'P', 'T', 'O', '1', '2'];
const snapshot = () => ({
  availability: 'available', checkedAt: '2026-10-13T13:00:00.000Z',
  expiresAt: '2026-10-13T13:05:00.000Z', sourceUpdatedAt: null,
  lines: ids.map(id => ({ id, status: 'normal', message: `Servicio habitual ${id}` })),
});

test('station names and partial identifiers remain unverified without fetching', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ items: [], status: 'ok' }));
  for (const name of ['San Antonio', 'Estadio', 'Acevedo', 'Línea A San Antonio', 'AA', '3', '']) {
    const result = await getStationStatus(name);
    assert.match(result, /no verificado/i);
    assert.match(result, /solo.*líneas/i);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('only exact line identifiers use official line messages', async t => {
  const data = snapshot();
  data.lines[0] = { id: 'A', status: 'warning', message: 'Trenes con menor frecuencia' };
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  for (const id of ids) {
    for (const input of [id, `Línea ${id}`, `linea ${id.toLowerCase()}`]) {
      const result = await getStationStatus(input);
      assert.match(result, new RegExp(`Línea ${id}`));
      assert.ok(result.includes(data.lines.find(line => line.id === id)!.message));
      assert.match(result, /estaciones.*no verificado/i);
      assert.ok(result.includes('https://www.metrodemedellin.gov.co/'));
    }
  }
  assert.equal(fetchMock.mock.callCount(), 36);
});

test('unavailable, absent, unknown and failed line lookups never claim normal', async t => {
  const data = snapshot();
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  data.availability = 'unavailable';
  assert.match(await getStationStatus('A'), /no verificado/i);
  data.availability = 'available';
  data.lines = [];
  assert.match(await getStationStatus('A'), /no verificado/i);
  data.lines = [{ id: 'A', status: 'unknown', message: 'Sin dato oficial' }];
  assert.match(await getStationStatus('A'), /Sin dato oficial/);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.match(await getStationStatus('A'), /no verificado/i);
});

test('network adapter requires all twelve normal lines and preserves upstream query time', async t => {
  const data = snapshot();
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const result = await getLiveMetroStatus();
  assert.equal(result.status, 'normal');
  assert.equal(result.checkedAt, data.checkedAt);
  assert.deepEqual(result.affectedStations, []);
  assert.deepEqual(result.affectedLines, []);
  assert.deepEqual(result.sources, [{ title: 'Metro de Medellín', url: 'https://www.metrodemedellin.gov.co/', official: true }]);
  for (const line of data.lines) assert.ok(result.summary.includes(line.message));
  assert.match(result.summary, /estaciones.*no verificado/i);

  for (const scenario of ['missing', 'duplicate', 'unknown', 'unavailable']) {
    const incomplete = snapshot();
    if (scenario === 'missing') incomplete.lines.pop();
    if (scenario === 'duplicate') incomplete.lines[11] = incomplete.lines[0];
    if (scenario === 'unknown') incomplete.lines[0].status = 'unknown';
    if (scenario === 'unavailable') incomplete.availability = 'unavailable';
    t.mock.method(globalThis, 'fetch', async () => Response.json(incomplete));
    assert.equal((await getLiveMetroStatus()).status, 'no_verificado', scenario);
  }
});

test('warnings and suspensions become line alerts without inferring station closures', async t => {
  const data = snapshot();
  data.lines[0] = { id: 'A', status: 'warning', message: 'Menor frecuencia' };
  data.lines[1] = { id: 'B', status: 'suspended', message: 'Servicio suspendido' };
  t.mock.method(globalThis, 'fetch', async () => Response.json(data));
  const result = await getLiveMetroStatus();
  assert.equal(result.status, 'alerta');
  assert.deepEqual(result.affectedLines, ['A', 'B']);
  assert.deepEqual(result.affectedStations, []);
  assert.equal(result.checkedAt, data.checkedAt);
  assert.match(result.summary, /Menor frecuencia/);
  assert.match(result.summary, /Servicio suspendido/);
});

test('status feature has no Gemini search prompt, duplicate cache or news inference', () => {
  const gemini = readFileSync('src/lib/gemini.ts', 'utf8');
  const routing = readFileSync('src/lib/routing.ts', 'utf8');
  assert.doesNotMatch(gemini, /LIVE_STATUS_PROMPT|LIVE_STATUS_TTL_MS|liveStatusCache|liveStatusInFlight|googleSearch|parseLiveMetroStatus/);
  assert.doesNotMatch(routing, /fetchMetroNews|reportes de noticias/);
  assert.match(gemini, /getServiceStatus/);
});

test('assistant station tool uses the station-aware lookup', () => {
  const source = readFileSync('src/lib/gemini.ts', 'utf8');
  const handler = source.split("call.name === 'get_station_status'")[1]?.split('return answer;')[0];
  assert.ok(handler);
  assert.match(handler, /await getStationStatus\(/);
  assert.doesNotMatch(handler, /getLiveMetroStatus\(/);
});
