import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

test('compiled journey entrypoint runs in plain Node and reads private environment settings', async () => {
  const output = await mkdtemp(join(tmpdir(), 'metrobot-journey-build-'));
  try {
    await writeFile(join(output, 'package.json'), '{"type":"module"}');
    for (const file of ['api/journey-intent.ts', 'server/journeyIntent.ts']) {
      const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
      const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
      const target = join(output, file.replace(/\.ts$/, '.js'));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, compiled.outputText);
    }
    const entrypoint = pathToFileURL(join(output, 'api/journey-intent.js')).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      globalThis.fetch = async (url, init) => {
        assert.ok(url.endsWith('/models/gemini-test:generateContent'));
        assert.equal(new Headers(init.headers).get('x-goog-api-key'), 'test-key');
        return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
          origin: null, destination: 'Centro', priority: 'balanced', maxCost: null,
          maxWalkingMinutes: null, maxDurationMinutes: null, maxTransfers: null, notes: []
        }) }] } }] });
      };
      const { default: handler } = await import(${JSON.stringify(entrypoint)});
      assert.equal((await handler.fetch(new Request('https://metro.test/api/journey-intent'))).status, 405);
      const response = await handler.fetch(new Request('https://metro.test/api/journey-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Al Centro' })
      }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).provider, 'gemini');
    `], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test' } });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    // Remove only the exact temporary directory created by this test.
    await rm(output, { recursive: true, force: true });
  }
});

test('dev plugin serves the Web handler with the first fallback key and bounds bodies', async (t) => {
  const { createServer } = await import('vite');
  const { journeyDevPlugin } = await import('../server/journeyDevPlugin.js');
  const realFetch = globalThis.fetch;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls++;
    assert.equal(new Headers(init.headers).get('x-goog-api-key'), 'first-key');
    assert.ok(String(url).includes('/models/gemini-test:'));
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
      origin: null, destination: 'Centro', priority: 'balanced', maxCost: null,
      maxWalkingMinutes: null, maxDurationMinutes: null, maxTransfers: null, notes: []
    }) }] } }] });
  });
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, plugins: [journeyDevPlugin({
    GEMINI_API_KEYS: ' first-key,second-key ', GEMINI_MODEL: 'gemini-test',
  })], server: { port: 0, host: '127.0.0.1' } });
  try {
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/api/journey-intent`;
    const result = await realFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Centro' }) });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).intent.destination, 'Centro');
    const large = await realFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(8193) });
    assert.equal(large.status, 413);
    assert.deepEqual(await large.json(), { code: 'INVALID_REQUEST' });
    assert.equal(calls, 1);
  } finally { await server.close(); }
});

test('dev middleware returns TIMEOUT for an unfinished upload without calling Gemini', async (t) => {
  const { createServer } = await import('vite');
  const { request: httpRequest } = await import('node:http');
  const { journeyDevPlugin } = await import('../server/journeyDevPlugin.js');
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('must not call'); });
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [journeyDevPlugin({ GEMINI_API_KEY: 'key' })], server: { port: 0, host: '127.0.0.1' } });
  let client: ReturnType<typeof httpRequest>;
  let timer: ReturnType<typeof setTimeout>;
  try {
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    const response = new Promise<{ status: number; body: string }>((resolve, reject) => {
      client = httpRequest(`http://127.0.0.1:${address.port}/api/journey-intent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
        res.on('error', reject);
      });
      client.on('error', reject);
      client.write('{'); // Deliberately never finish the request body.
    });
    const result = await Promise.race([response, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('dev upload remained pending past deadline')), 14000);
    })]);
    assert.equal(result.status, 504);
    assert.deepEqual(JSON.parse(result.body), { code: 'TIMEOUT' });
    assert.equal(calls, 0);
  } finally { clearTimeout(timer); client?.destroy(); await server.close(); }
});

test('dev client disconnect aborts the provider request', async (t) => {
  const { createServer } = await import('vite');
  const { request: httpRequest } = await import('node:http');
  const { journeyDevPlugin } = await import('../server/journeyDevPlugin.js');
  let started: () => void;
  let aborted: () => void;
  const providerStarted = new Promise<void>(resolve => { started = resolve; });
  const providerAborted = new Promise<void>(resolve => { aborted = resolve; });
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    started();
    return new Promise<Response>((_resolve, reject) => {
      init.signal.addEventListener('abort', () => { aborted(); reject(new Error('aborted')); }, { once: true });
    });
  });
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, plugins: [journeyDevPlugin({ GEMINI_API_KEY: 'key' })], server: { port: 0, host: '127.0.0.1' } });
  let client: ReturnType<typeof httpRequest>;
  let timer: ReturnType<typeof setTimeout>;
  try {
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    client = httpRequest(`http://127.0.0.1:${address.port}/api/journey-intent`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    client.on('error', () => {});
    client.end(JSON.stringify({ text: 'Centro' }));
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Provider was not cancelled on disconnect')), 1000); });
    await Promise.race([providerStarted, deadline]);
    client.destroy();
    await Promise.race([providerAborted, deadline]);
  } finally {
    clearTimeout(timer);
    client?.destroy();
    await server.close();
  }
});
