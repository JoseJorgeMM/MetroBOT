# CARTO Basemap API Key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Leaflet CARTO basemap authenticate with the user's free CARTO key while keeping the secret out of tracked source code.

**Architecture:** Store the key in the ignored `.env.local` file and expose it to Vite through `VITE_CARTO_API_KEY`. Build one optional query suffix and append it to both light and dark CARTO raster tile URLs; keep the existing URL fallback when the variable is absent.

**Tech Stack:** Vite, React, TypeScript, React-Leaflet, Node test scripts.

---

### Task 1: Configure CARTO key usage

**Files:**
- Create: `.env.local`
- Create: `.env.example`
- Modify: `src/components/Map/MapComponent.tsx:518-522`
- Create: `tests/test_carto_api_key.mjs`

- [ ] **Step 1: Write the failing source-contract test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/Map/MapComponent.tsx', 'utf8');
assert.match(source, /VITE_CARTO_API_KEY/);
assert.match(source, /[?]key=/);
assert.match(source, /dark_all.*cartoTileKey/);
assert.match(source, /light_all.*cartoTileKey/);
console.log('CARTO API key source contract passed');
```

- [ ] **Step 2: Run the test and verify it fails because the integration is absent**

Run: `node tests/test_carto_api_key.mjs`
Expected: FAIL because `VITE_CARTO_API_KEY` and `cartoTileKey` are not present in the map component.

- [ ] **Step 3: Add the local key and the documented placeholder**

`.env.local` receives the key supplied by the user and remains ignored by `.gitignore`.
`.env.example` contains only:

```env
# Pega aquí tu clave gratuita de CARTO Basemaps:
# VITE_CARTO_API_KEY=tu_clave_de_carto
```

- [ ] **Step 4: Add the key query parameter to both basemap modes**

Define `cartoTileKey` from `import.meta.env.VITE_CARTO_API_KEY` and append it to the existing light and dark tile URLs as `?key=${encodeURIComponent(...)}` when configured.

- [ ] **Step 5: Run the focused test and project checks**

Run: `node tests/test_carto_api_key.mjs`
Expected: PASS.

Run: `npm run lint`
Expected: TypeScript exits with code 0.

Run: `npm run build`
Expected: Vite build exits with code 0.
