import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

test('compiled server entrypoint imports and handles requests in plain Node without a TS loader', async () => {
  const output = await mkdtemp(join(tmpdir(), 'metrobot-transit-build-'));
  try {
    await writeFile(join(output, 'package.json'), '{"type":"module"}');
    for (const file of ['api/transit-routes.ts', 'server/transit.ts', 'src/lib/googleTransit.ts']) {
      const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
      const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
      const target = join(output, file.replace(/\.ts$/, '.js'));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, compiled.outputText);
    }
    const entrypoint = pathToFileURL(join(output, 'api/transit-routes.js')).href;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      const { default: handler } = await import(${JSON.stringify(entrypoint)});
      const response = await handler.fetch(new Request('https://metro.test/api/transit-routes'));
      if (response.status !== 405) throw new Error('Expected method rejection');
    `], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    // Only remove the exact newly-created test output directory under os.tmpdir().
    await rm(output, { recursive: true, force: true });
  }
});
