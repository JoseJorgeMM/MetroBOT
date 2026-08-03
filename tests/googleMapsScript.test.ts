import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Google Maps loads asynchronously without blocking the mobile shell', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script[^>]*maps\.googleapis\.com\/maps\/api\/js[^>]*><\/script>/)?.[0] ?? '';

  assert.match(script, /(?:[?&]|&amp;)loading=async(?:&|&amp;|"|')/);
  assert.match(script, /\sasync(?:\s|>|=)/);
});
