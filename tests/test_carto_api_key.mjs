import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/Map/MapComponent.tsx', 'utf8');
assert.match(source, /VITE_CARTO_API_KEY/);
assert.match(source, /[?]key=/);
assert.match(source, /dark_all.*cartoTileKey/);
assert.match(source, /light_all.*cartoTileKey/);
console.log('CARTO API key source contract passed');
