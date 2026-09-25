import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Google Maps loads asynchronously without blocking the mobile shell', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /maps\.googleapis\.com\/maps\/api\/js/);
  const loader = await readFile(new URL('../src/lib/googleMapsLoader.ts', import.meta.url), 'utf8');
  assert.match(loader, /loading: 'async'/);
  assert.match(loader, /script\.async = true/);
  assert.match(loader, /VITE_GOOGLE_MAPS_API_KEY/);
  assert.doesNotMatch(loader, /libraries: 'places'/);
});
