# Bus Route Honesty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Gemini from fabricating bus routes, and stop the UI from rendering routes whose bus steps are mostly invalid.

**Architecture:** Rewrite the Gemini prompt to be SITVA-first, balance the catalog it sees (capped at 30 bus routes + 30 stations), and add a hard-fail validator flag (`unsafe`) that the UI respects. Three independent layers: prompt, data, validator.

**Tech Stack:** Vite + React 19 + TypeScript 5.8 + `@google/genai`. No new runtime deps. Node 18+ for tests.

---

## File Structure

- Modify: `src/lib/routeValidator.ts` (add `BUS_UNSAFE_THRESHOLD`, `isRouteUnsafe`, extend `RouteValidationSummary`).
- Modify: `src/lib/honesty.ts` (add `'unsafe'` level, `UNSAFE_DEGRADED_THRESHOLD`).
- Modify: `src/lib/gemini.ts` (rewrite `sysPrompt` builder, cap catalogs at 30, add `buildSysPrompt` pure helper).
- Modify: `src/App.tsx` (drop unsafe routes in the route callback).
- Create: `tests/_routeValidator_impl.mjs` + extend `tests/test_routeValidator.mjs`.
- Create: `tests/_honesty_impl.mjs` + extend `tests/test_honesty.mjs`.
- Create: `tests/_gemini_prompt_impl.mjs` + `tests/test_gemini_prompt.mjs`.
- Modify: `docs/CHANGELOG.md` (new `## 2026-07-08` section).

---

### Task 1: `isRouteUnsafe` helper + `unsafe` flag in `RouteValidationSummary` (TDD)

**Files:**
- Modify: `src/lib/routeValidator.ts`
- Modify: `tests/_routeValidator_impl.mjs`
- Modify: `tests/test_routeValidator.mjs`

- [ ] **Step 1: Write the failing test**

Append to `C:\Users\ASUS\Documents\MetroBOT\tests\_routeValidator_impl.mjs` (right after `summarizeRouteValidation`):

```javascript
export const BUS_UNSAFE_THRESHOLD = 0.5;

export function isRouteUnsafe(route, allIntegratedRoutes, allStations, threshold) {
  if (!route || !Array.isArray(route.steps) || route.steps.length === 0) return { unsafe: false };
  const t = typeof threshold === 'number' ? threshold : BUS_UNSAFE_THRESHOLD;
  let busCount = 0;
  for (const s of route.steps) {
    if (s && s.mode === 'bus_articulado') busCount++;
  }
  if (busCount === 0) return { unsafe: false };
  // dominant = more bus steps than non-bus steps
  if (busCount <= route.steps.length - busCount) return { unsafe: false };
  const summary = summarizeRouteValidation([route], allIntegratedRoutes, allStations);
  if (summary.total === 0) return { unsafe: false };
  const ratio = summary.degradedSteps / summary.total;
  if (ratio >= t) {
    return { unsafe: true, reason: 'mostly-invalid-buses', ratio, threshold: t };
  }
  return { unsafe: false, ratio, threshold: t };
}
```

Append to `C:\Users\ASUS\Documents\MetroBOT\tests\test_routeValidator.mjs` right before the final `console.log('\n-----');`:

```javascript
import { isRouteUnsafe, BUS_UNSAFE_THRESHOLD } from './_routeValidator_impl.mjs';

console.log('isRouteUnsafe');
{
  const allInvalidBuses = {
    steps: [
      { mode: 'bus_articulado', line: 'C7-999', station: { nameRef: 'Parada X' } },
      { mode: 'bus_articulado', line: 'FAKE-1', station: { nameRef: 'Parada Y' } },
    ],
  };
  const u1 = isRouteUnsafe(allInvalidBuses, FAKE_ROUTES, FAKE_STATIONS);
  assertEq('unsafe: 100% invalid buses', u1.unsafe, true);
  assertEq('unsafe: reason', u1.reason, 'mostly-invalid-buses');
  assertTrue('unsafe: ratio >= 0.5', u1.ratio >= 0.5, JSON.stringify(u1));
}
{
  const partialBus = {
    steps: [
      { mode: 'bus_articulado', line: 'C7-001', station: { nameRef: 'Niquía', lat: 6.3074, lng: -75.5535 } },
      { mode: 'bus_articulado', line: 'C7-999', station: { nameRef: 'X' } },
      { mode: 'metro', station: { nameRef: 'Poblado' } },
    ],
  };
  const u2 = isRouteUnsafe(partialBus, FAKE_ROUTES, FAKE_STATIONS);
  assertEq('not unsafe: 1/3 invalid (ratio 0.33 < 0.5)', u2.unsafe, false);
}
{
  const metroDominant = {
    steps: [
      { mode: 'metro', station: { nameRef: 'Acevedo' } },
      { mode: 'metro', station: { nameRef: 'Poblado' } },
      { mode: 'bus_articulado', line: 'C7-999', station: { nameRef: 'X' } },
    ],
  };
  const u3 = isRouteUnsafe(metroDominant, FAKE_ROUTES, FAKE_STATIONS);
  assertEq('not unsafe: bus is not dominant (1 of 3)', u3.unsafe, false);
}
{
  const onlyWalk = { steps: [{ mode: 'walk' }] };
  const u4 = isRouteUnsafe(onlyWalk, FAKE_ROUTES, FAKE_STATIONS);
  assertEq('not unsafe: no bus steps', u4.unsafe, false);
}
{
  const allInvalid = {
    steps: [
      { mode: 'bus_articulado', line: 'C7-999', station: { nameRef: 'X' } },
      { mode: 'bus_articulado', line: 'C7-998', station: { nameRef: 'Y' } },
    ],
  };
  const u5 = isRouteUnsafe(allInvalid, FAKE_ROUTES, FAKE_STATIONS, 0.3);
  assertEq('threshold 0.3: still unsafe', u5.unsafe, true);
  const u6 = isRouteUnsafe(allInvalid, FAKE_ROUTES, FAKE_STATIONS, 0.99);
  assertEq('threshold 0.99: still unsafe (100% degraded)', u6.unsafe, true);
}
assertEq('BUS_UNSAFE_THRESHOLD default', BUS_UNSAFE_THRESHOLD, 0.5);
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run: `cd "C:\Users\ASUS\Documents\MetroBOT" ; node tests/test_routeValidator.mjs`
Expected: FAIL (the new function is not exported from the impl yet).

- [ ] **Step 3: Add the impl to the production module**

Open `C:\Users\ASUS\Documents\MetroBOT\src\lib\routeValidator.ts`. Add the new constant and function after `summarizeRouteValidation`:

```typescript
export const BUS_UNSAFE_THRESHOLD = 0.5;

export function isRouteUnsafe(
  route: { steps?: RouteStep[] } | null | undefined,
  allIntegratedRoutes: IntegratedRoute[],
  allStations: OfficialStation[],
  threshold: number = BUS_UNSAFE_THRESHOLD,
): { unsafe: boolean; reason?: string; ratio?: number; threshold?: number } {
  if (!route || !Array.isArray(route.steps) || route.steps.length === 0) {
    return { unsafe: false };
  }
  let busCount = 0;
  for (const s of route.steps) {
    if (s && s.mode === 'bus_articulado') busCount++;
  }
  if (busCount === 0) return { unsafe: false };
  if (busCount <= route.steps.length - busCount) return { unsafe: false };
  const summary = summarizeRouteValidation([route], allIntegratedRoutes, allStations);
  if (summary.total === 0) return { unsafe: false };
  const ratio = summary.degradedSteps / summary.total;
  if (ratio >= threshold) {
    return { unsafe: true, reason: 'mostly-invalid-buses', ratio, threshold };
  }
  return { unsafe: false, ratio, threshold };
}
```

Also extend the `RouteValidationSummary` interface (line 226) to add `unsafe: boolean; unsafeReason?: string;`. Then update the return of `summarizeRouteValidation` (line 304) to set `unsafe: false, unsafeReason: undefined` by default (the caller can re-evaluate via `isRouteUnsafe`).

```typescript
export interface RouteValidationSummary {
  ok: boolean;
  validatedSteps: number;
  degradedSteps: number;
  total: number;
  reasons: string[];
  unsafe: boolean;
  unsafeReason?: string;
}
```

And in the return statement at the end of `summarizeRouteValidation`:

```typescript
  return {
    ok: degradedSteps === 0 && total > 0,
    validatedSteps,
    degradedSteps,
    total,
    reasons,
    unsafe: false,
    unsafeReason: undefined,
  };
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run: `cd "C:\Users\ASUS\Documents\MetroBOT" ; node tests/test_routeValidator.mjs`
Expected: ALL TESTS PASS.

- [ ] **Step 5: Lint**

Run: `cd "C:\Users\ASUS\Documents\MetroBOT" ; npm run lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/routeValidator.ts tests/_routeValidator_impl.mjs tests/test_routeValidator.mjs
git commit -m "feat(validator): add isRouteUnsafe hard-fail for mostly-invalid bus routes"
```

---

### Task 2: `'unsafe'` level in `honesty.ts` (TDD)

**Files:**
- Modify: `src/lib/honesty.ts`
- Modify: `tests/_honesty_impl.mjs`
- Modify: `tests/test_honesty.mjs`

- [ ] **Step 1: Write the failing test**

Append to `C:\Users\ASUS\Documents\MetroBOT\tests\_honesty_impl.mjs`:

```javascript
export const UNSAFE_DEGRADED_THRESHOLD = 0.5;

export function isAnyUnsafe(routes) {
  if (!Array.isArray(routes)) return false;
  for (const r of routes) {
    if (r && r.validation && r.validation.unsafe === true) return true;
  }
  return false;
}
```

Append to `C:\Users\ASUS\Documents\MetroBOT\tests\test_honesty.mjs` before its final `console.log('\n-----');`:

```javascript
import { isAnyUnsafe, UNSAFE_DEGRADED_THRESHOLD } from './_honesty_impl.mjs';

console.log('honesty: isAnyUnsafe');
assertEq('null -> false', isAnyUnsafe(null), false);
assertEq('empty -> false', isAnyUnsafe([]), false);
assertEq('none unsafe -> false', isAnyUnsafe([{ validation: { unsafe: false } }]), false);
assertEq('one unsafe -> true', isAnyUnsafe([{ validation: { unsafe: false } }, { validation: { unsafe: true } }]), true);
assertEq('UNSAFE threshold default', UNSAFE_DEGRADED_THRESHOLD, 0.5);
```

- [ ] **Step 2: Run to verify FAIL**

Run: `cd "C:\Users\ASUS\Documents\MetroBOT" ; node tests/test_honesty.mjs`
Expected: FAIL.

- [ ] **Step 3: Add the impl**

Open `C:\Users\ASUS\Documents\MetroBOT\src\lib\honesty.ts`. Add the new constant, the new union member, and update `computeHonestyAssessment`:

```typescript
export const PARTIAL_THRESHOLD = 0.41;
export const UNSAFE_DEGRADED_THRESHOLD = 0.5;

export type HonestyLevel = 'confiable' | 'parcial' | 'no_verificada' | 'unsafe';

export function isAnyUnsafe(routes: RouteValidationLike[] | null | undefined): boolean {
  if (!Array.isArray(routes)) return false;
  for (const r of routes) {
    if (r && r.validation && r.validation.unsafe === true) return true;
  }
  return false;
}

export function computeHonestyAssessment(routes: RouteValidationLike[] | null | undefined): HonestyAssessment {
  if (!routes || routes.length === 0) {
    return { level: 'confiable', label: 'Sin rutas', worstRatio: 0, totalDegraded: 0 };
  }
  if (isAnyUnsafe(routes)) {
    return {
      level: 'unsafe',
      label: 'No encontre rutas validas para este trayecto',
      worstRatio: 1,
      totalDegraded: 0,
    };
  }
  // ... rest of the function unchanged
}
```

- [ ] **Step 4: Run to verify PASS**

Run: `cd "C:\Users\ASUS\Documents\MetroBOT" ; node tests/test_honesty.mjs ; node tests/test_routeValidator.mjs`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/honesty.ts tests/_honesty_impl.mjs tests/test_honesty.mjs
git commit -m "feat(honesty): add 'unsafe' level for mostly-invalid bus routes"
```

---

### Task 3: Pure `buildSysPrompt` helper (TDD)

**Files:**
- Modify: `src/lib/gemini.ts`
- Create: `tests/_gemini_prompt_impl.mjs`
- Create: `tests/test_gemini_prompt.mjs`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\ASUS\Documents\MetroBOT\tests\_gemini_prompt_impl.mjs` with the pure mirror of the prompt builder:

```javascript
export const BUS_CATALOG_CAP = 30;
export const STATION_CATALOG_CAP = 30;

export function buildSysPrompt(parts) {
  const p = parts || {};
  const grounding = p.grounding || '';
  const integratedSnippet = p.integratedSnippet || '';
  const stationSnippet = p.stationSnippet || '';
  const tarifas = p.tarifas || '';
  const tiempos = p.tiempos || '';
  const encicla = p.encicla || '';
  const news = p.news || '';

  return [
    'Eres MetroBot, el asistente inteligente de movilidad de SITVA (Metro, Metrocable, Tranvia, Metroplus, EnCicla y Buses Articulados) en Medellin Colombia.',
    'Tu objetivo es dar rutas REALISTAS y UTILES sobre la red SITVA del Valle de Aburra.',
    '',
    '=== NOTICIAS Y ESTADO EN TIEMPEAL ===',
    news,
    '',
    'REGLA 0 (BACKBONE SITVA - CRITICO):',
    '1. Si el origen Y el destino estan a menos de 1.5 km de una estacion SITVA (Metro, Metrocable, Tranvia, Metroplus o EnCicla), la ruta DEBE usar SITVA como backbone. Los buses solo se sugieren como (a) alimentador desde zonas SIN cobertura SITVA o (b) cuando el usuario pide explicitamente bus.',
    '2. NO INVENTAR: NUNCA inventes ids de ruta, nombres de paradas ni coordenadas. Para step.station, originStation, destinationStation SOLO puedes usar nameRef (un string EXACTO del catalogo o de la lista de paradas cercanas). El sistema rellena las coordenadas; TU no escribas lat/lng.',
    '3. Para line en un bus_articulado, usa EXACTAMENTE el id que aparece en el catalogo (p. ej. "C7-001", "142I", "C1-001", "T4-027").',
    '4. ESTADO ACTUAL: Si preguntan por el estado del sistema, basate en la seccion "NOTICIAS Y ESTADO EN TIEMPEAL".',
    '',
    'REGLAS ANTI-ALUCINACION (Plan D):',
    '- Si NO conoces la parada exacta o el id de ruta, NO incluyas ese paso. Mejor retorna una ruta con menos pasos.',
    '- PROHIBIDO inventar ids como "C7-999" o "Linea X". Solo usa los ids de CATALOGO DE BUSES INTEGRADOS.',
    '- Para cada step con mode="bus_articulado" incluye _evidence: {sourceRouteId, sourceStopName} citando la fuente del catalogo.',
    '',
    'EJEMPLOS (NO HACER):',
    '- Mal: line:"C7-999", station:{nameRef:"Parada inventada"}.',
    '- Bien: omitir esa ruta o usar unicamente el id real del catalogo.',
    '',
    'DATOS OFICIALES SITVA 2026:',
    '=== TARIFAS ===',
    tarifas,
    '=== TIEMPOS ===',
    tiempos,
    '=== ENCICLA ===',
    encicla,
    '',
    'CATALOGO DE ESTACIONES SITVA (Linea, Sistema):',
    stationSnippet,
    '',
    'INSTRUCCIONES DE RESPUESTA:',
    '1. Identifica paradas de inicio y fin usando las listas CERCANAS.',
    '2. Si recomiendas un Bus Integrado, usa mode: "bus_articulado" con line igual al id exacto del catalogo y station.nameRef igual al nombre exacto de la parada de abordaje.',
    '3. Llama a render_route con 2-3 opciones.',
    '4. Responde brevemente en espanol.',
    '',
    'CATALOGO DE BUSES INTEGRADOS (ids validos, parcial):',
    integratedSnippet,
    '',
    'OTRAS ESTACIONES DEL SISTEMA:',
    grounding,
  ].join('\n');
}
```

Create `C:\Users\ASUS\Documents\MetroBOT\tests\test_gemini_prompt.mjs`:

```javascript
import { buildSysPrompt, BUS_CATALOG_CAP, STATION_CATALOG_CAP } from './_gemini_prompt_impl.mjs';

let passed = 0, failed = 0;
const failures = [];
function assert(name, cond, hint) {
  if (cond) { passed++; console.log('  OK  ', name); }
  else { failed++; failures.push({ name, hint }); console.log('  FAIL', name, hint ? '(' + hint + ')' : ''); }
}
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log('  OK  ', name); }
  else { failed++; failures.push({ name, actual: a, expected: e }); console.log('  FAIL', name, '\n      actual:  ', a, '\n      expected:', e); }
}

const out = buildSysPrompt({
  grounding: 'GROUNDING_OK',
  integratedSnippet: 'BUS_OK',
  stationSnippet: 'STATION_OK',
  tarifas: 'TARIFAS_OK',
  tiempos: 'TIEMPOS_OK',
  encicla: 'ENCICLA_OK',
  news: 'NEWS_OK',
});

console.log('prompt: SITVA-first rule present');
assert('contains "BACKBONE SITVA"', out.includes('BACKBONE SITVA'), 'no SITVA-first rule');
assert('contains "1.5 km" hint', out.includes('1.5 km'), 'no distance threshold');
assert('contains "SITVA como backbone"', out.includes('SITVA como backbone'));

console.log('prompt: legacy bias removed');
assert('does NOT contain "Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses)"',
  !out.includes('Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses)'),
  'legacy line still present');
assert('does NOT contain "Si hay una parada de BUS ARTICULADO cerca del usuario, usala"',
  !out.includes('Si hay una parada de BUS ARTICULADO cerca del usuario, usala'),
  'legacy line still present');

console.log('prompt: catalog placeholders present');
assert('contains "CATALOGO DE ESTACIONES SITVA"', out.includes('CATALOGO DE ESTACIONES SITVA'));
assert('contains "CATALOGO DE BUSES INTEGRADOS"', out.includes('CATALOGO DE BUSES INTEGRADOS'));
assert('contains NEWS_OK marker', out.includes('NEWS_OK'));
assert('contains GROUNDING_OK marker', out.includes('GROUNDING_OK'));
assert('contains STATION_OK marker', out.includes('STATION_OK'));
assert('contains BUS_OK marker', out.includes('BUS_OK'));

console.log('prompt: anti-hallucination rules preserved');
assert('contains "NO INVENTAR"', out.includes('NO INVENTAR'));
assert('contains "C7-999"', out.includes('C7-999'));
assert('contains "REGLA 0"', out.includes('REGLA 0'));

console.log('prompt: catalog caps');
assertEq('BUS_CATALOG_CAP = 30', BUS_CATALOG_CAP, 30);
assertEq('STATION_CATALOG_CAP = 30', STATION_CATALOG_CAP, 30);

console.log('prompt: empty parts produce sane string');
const empty = buildSysPrompt();
assert('empty still has SITVA-first rule', empty.includes('BACKBONE SITVA'));
assert('empty does not crash', typeof empty === 'string' && empty.length > 100);

console.log('\n-----');
if (failed === 0) { console.log('ALL TESTS PASS (' + passed + '/' + (passed + failed) + ')'); process.exit(0); }
else { console.log('FAILED ' + failed + '/' + (passed + failed)); process.exit(1); }
```

- [ ] **Step 2: Run to verify PASS (impl mirror is shipped with the test)**

Run: `cd "C:\Users\ASUS\Documents\MetroBOT" ; node tests/test_gemini_prompt.mjs`
Expected: ALL TESTS PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/_gemini_prompt_impl.mjs tests/test_gemini_prompt.mjs
git commit -m "test: add pure prompt builder mirror for Gemini SITVA-first contract (TDD)"
```

---

### Task 4: Wire `buildSysPrompt` into `gemini.ts` and rebalance catalog

**Files:**
- Modify: `src/lib/gemini.ts`

- [ ] **Step 1: Add the imports and constants**

At the top of `src/lib/gemini.ts` (next to the other type imports), add:

```typescript
import { buildSysPrompt, BUS_CATALOG_CAP, STATION_CATALOG_CAP } from './geminiPrompt';
```

(You will also create `src/lib/geminiPrompt.ts` in step 2 with the TS mirror of the impl.)

- [ ] **Step 2: Create the TS production module**

Create `C:\Users\ASUS\Documents\MetroBOT\src\lib\geminiPrompt.ts` with the TS port of the impl mirror:

```typescript
// src/lib/geminiPrompt.ts
// -----------------------------------------------------------------------------
// Pure builder for the Gemini render_route system prompt. Mirrors
// tests/_gemini_prompt_impl.mjs so the same contract is tested in Node and
// used at runtime in the browser.
// -----------------------------------------------------------------------------

export const BUS_CATALOG_CAP = 30;
export const STATION_CATALOG_CAP = 30;

export interface SysPromptParts {
  grounding?: string;
  integratedSnippet?: string;
  stationSnippet?: string;
  tarifas?: string;
  tiempos?: string;
  encicla?: string;
  news?: string;
}

export function buildSysPrompt(parts: SysPromptParts = {}): string {
  const grounding = parts.grounding ?? '';
  const integratedSnippet = parts.integratedSnippet ?? '';
  const stationSnippet = parts.stationSnippet ?? '';
  const tarifas = parts.tarifas ?? '';
  const tiempos = parts.tiempos ?? '';
  const encicla = parts.encicla ?? '';
  const news = parts.news ?? '';

  return [
    'Eres MetroBot, el asistente inteligente de movilidad de SITVA (Metro, Metrocable, Tranvia, Metroplus, EnCicla y Buses Articulados) en Medellin Colombia.',
    'Tu objetivo es dar rutas REALISTAS y UTILES sobre la red SITVA del Valle de Aburra.',
    '',
    '=== NOTICIAS Y ESTADO EN TIEMPO REAL ===',
    news,
    '',
    'REGLA 0 (BACKBONE SITVA - CRITICO):',
    '1. Si el origen Y el destino estan a menos de 1.5 km de una estacion SITVA (Metro, Metrocable, Tranvia, Metroplus o EnCicla), la ruta DEBE usar SITVA como backbone. Los buses solo se sugieren como (a) alimentador desde zonas SIN cobertura SITVA o (b) cuando el usuario pide explicitamente bus.',
    '2. NO INVENTAR: NUNCA inventes ids de ruta, nombres de paradas ni coordenadas. Para step.station, originStation, destinationStation SOLO puedes usar nameRef (un string EXACTO del catalogo o de la lista de paradas cercanas). El sistema rellena las coordenadas; TU no escribas lat/lng.',
    '3. Para line en un bus_articulado, usa EXACTAMENTE el id que aparece en el catalogo (p. ej. "C7-001", "142I", "C1-001", "T4-027").',
    '4. ESTADO ACTUAL: Si preguntan por el estado del sistema, basate en la seccion "NOTICIAS Y ESTADO EN TIEMPO REAL".',
    '',
    'REGLAS ANTI-ALUCINACION (Plan D):',
    '- Si NO conoces la parada exacta o el id de ruta, NO incluyas ese paso. Mejor retorna una ruta con menos pasos.',
    '- PROHIBIDO inventar ids como "C7-999" o "Linea X". Solo usa los ids de CATALOGO DE BUSES INTEGRADOS.',
    '- Para cada step con mode="bus_articulado" incluye _evidence: {sourceRouteId, sourceStopName} citando la fuente del catalogo.',
    '',
    'EJEMPLOS (NO HACER):',
    '- Mal: line:"C7-999", station:{nameRef:"Parada inventada"}.',
    '- Bien: omitir esa ruta o usar unicamente el id real del catalogo.',
    '',
    'DATOS OFICIALES SITVA 2026:',
    '=== TARIFAS ===',
    tarifas,
    '=== TIEMPOS ===',
    tiempos,
    '=== ENCICLA ===',
    encicla,
    '',
    'CATALOGO DE ESTACIONES SITVA (Linea, Sistema):',
    stationSnippet,
    '',
    'INSTRUCCIONES DE RESPUESTA:',
    '1. Identifica paradas de inicio y fin usando las listas CERCANAS.',
    '2. Si recomiendas un Bus Integrado, usa mode: "bus_articulado" con line igual al id exacto del catalogo y station.nameRef igual al nombre exacto de la parada de abordaje.',
    '3. Llama a render_route con 2-3 opciones.',
    '4. Responde brevemente en espanol.',
    '',
    'CATALOGO DE BUSES INTEGRADOS (ids validos, parcial):',
    integratedSnippet,
    '',
    'OTRAS ESTACIONES DEL SISTEMA:',
    grounding,
  ].join('\n');
}
```

- [ ] **Step 3: Rebalance the catalog section in `gemini.ts`**

In `src/lib/gemini.ts`, locate the `catalogSnippet` block (around line 242). Change:

```javascript
const catalogSnippet = allIntegratedRoutes.slice(0, 80).map(...)
```

to:

```javascript
const catalogSnippet = allIntegratedRoutes.slice(0, BUS_CATALOG_CAP).map(r => r.id + ': ' + r.stops.slice(0, 3).map(s => s.name).join(' | ') + ' ...').join('\n');
```

Add right after the `catalogSnippet` line:

```javascript
const stationSnippet = (await getGroundingData()).split('\n').slice(0, STATION_CATALOG_CAP).join('\n');
```

Replace the `sysPrompt` array (lines 496-534) with a call to the new builder:

```javascript
const sysPrompt = buildSysPrompt({
  grounding: (await getGroundingData()),
  integratedSnippet: catalogSnippet,
  stationSnippet,
  tarifas,
  tiempos,
  encicla,
  news: newsContext,
});
```

Note: we still call `getGroundingData()` once to build `stationSnippet`, then again inside `buildSysPrompt` for `grounding`. That is intentional (cheaper than threading the value) and keeps the call sites local. If you want to dedupe, you can hoist `const allGrounding = await getGroundingData();` and pass it twice; either is fine.

- [ ] **Step 4: Lint + run the prompt test**

Run: `cd "C:\Users\ASUS\Documents\MetroBOT" ; npm run lint ; node tests/test_gemini_prompt.mjs`
Expected: lint exit 0, prompt test ALL TESTS PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gemini.ts src/lib/geminiPrompt.ts
git commit -m "feat(gemini): SITVA-first prompt + rebalance catalog (30 buses, 30 stations)"
```

---

### Task 5: Drop unsafe routes in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update the route callback**

In `src/App.tsx`, locate the route-found callback (around lines 315-334). Replace:

```tsx
(newRoutes) => {
  const assessment = computeHonestyAssessment(newRoutes as any);
  setHonestyAssessment(assessment);
  if (assessment.level === 'no_verificada') {
    setPendingRoutes(newRoutes);
    setRoutes([]);
    const msg = 'No pude verificar ' + assessment.totalDegraded + ' parada(s) de bus en este recorrido. ' + 'Te recomiendo caminar o usar la opcion "Ver de todos modos" para revisar la ruta igual.';
    setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    return;
  }
  setRoutes(newRoutes);
  // ... origin/dest sync ...
}
```

with:

```tsx
(newRoutes) => {
  const assessment = computeHonestyAssessment(newRoutes as any);
  setHonestyAssessment(assessment);
  if (assessment.level === 'unsafe') {
    setRoutes([]);
    setPendingRoutes([]);
    const msg = 'No encontre rutas validas para este trayecto. Intenta con origen y destino dentro de la red SITVA, o verifica los nombres de los lugares.';
    setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    return;
  }
  if (assessment.level === 'no_verificada') {
    setPendingRoutes(newRoutes);
    setRoutes([]);
    const msg = 'No pude verificar ' + assessment.totalDegraded + ' parada(s) de bus en este recorrido. ' + 'Te recomiendo caminar o usar la opcion "Ver de todos modos" para revisar la ruta igual.';
    setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    return;
  }
  setRoutes(newRoutes);
  // ... origin/dest sync ...
}
```

(Leave the rest of the function intact.)

- [ ] **Step 2: Lint + run the full suite**

Run: `cd "C:\Users\ASUS\Documents\MetroBOT" ; npm run lint ; Get-ChildItem tests/test_*.mjs | ForEach-Object { node $_.FullName 2>&1 | Select-String -Pattern 'ALL TESTS PASS|FAILED' } 2>&1 | ForEach-Object { $_.Line }`
Expected: lint exit 0, every test file reports `ALL TESTS PASS`.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix(app): drop unsafe routes from the chat reply"
```

---

### Task 6: CHANGELOG and final verification

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Append a new section to `docs/CHANGELOG.md`**

```markdown

## 2026-07-08 - Bus route honesty: SITVA-first prompt + hard-fail validator

### Why
Gemini was returning routes dominated by `bus_articulado`, many of which
referenced bus lines or stops that did not exist in
`public/rutas_integradas.json`. The current validator only marked such steps
as `degraded` (warned the user); it never hid the route, so a user could be
sent to a non-existent bus stop. Root cause was a prompt bias toward buses and
an over-weighted bus catalog in the grounding section.

### Changed
- `src/lib/gemini.ts`: rewrote the system prompt to be SITVA-first. Buses are
  now feeders, not the backbone. Bus catalog in the prompt is capped at 30
  routes; a 30-station snippet is added to balance the datasets.
- `src/lib/routeValidator.ts`: added `BUS_UNSAFE_THRESHOLD` and
  `isRouteUnsafe()`. A route whose bus steps dominate AND whose degraded
  ratio is >= 0.5 is now flagged `unsafe`.
- `src/lib/honesty.ts`: added the `'unsafe'` level. When any route is
  `unsafe`, the assessment is `unsafe` (most restrictive wins).
- `src/App.tsx`: routes with assessment `unsafe` are dropped silently. A
  clear assistant message is shown instead.

### Added (TDD)
- `src/lib/geminiPrompt.ts`: pure `buildSysPrompt(parts)` helper with
  `BUS_CATALOG_CAP` and `STATION_CATALOG_CAP` constants.
- `tests/_gemini_prompt_impl.mjs` + `tests/test_gemini_prompt.mjs`:
  asserts for the SITVA-first contract.
- `tests/_routeValidator_impl.mjs` + `tests/test_routeValidator.mjs`:
  asserts for `isRouteUnsafe` and the `unsafe` flag in
  `RouteValidationSummary`.
- `tests/_honesty_impl.mjs` + `tests/test_honesty.mjs`: asserts for the
  `'unsafe'` honesty level and `isAnyUnsafe` helper.

### Verification (evidence)
- `node tests/test_gemini_prompt.mjs` -> all asserts green.
- `node tests/test_routeValidator.mjs` -> all asserts green.
- `node tests/test_honesty.mjs` -> all asserts green.
- All other test files still green.
- `npm run lint` exit 0.
- `npm run build` exit 0.
- Manual: query "de Poblado a Niquia" -> Gemini returns SITVA route; no
  fabricated buses. Query to a remote vereda -> unsafe message shown
  instead of fake routes.
```

- [ ] **Step 2: Run the full verification gate**

Run:
```bash
cd "C:\Users\ASUS\Documents\MetroBOT"
Get-ChildItem tests/test_*.mjs | ForEach-Object { node $_.FullName 2>&1 | Select-String -Pattern 'ALL TESTS PASS|FAILED' }
npm run lint
npm run build
```
Expected: every test file says `ALL TESTS PASS`. Lint exit 0. Build exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs: changelog entry for bus route honesty (SITVA-first + hard-fail)"
```

---

## Notes / YAGNI

- Do NOT change the `temperature` / `seed` / `responseMimeType` config in
  `gemini.ts`. The current setup is intentional.
- Do NOT add a "report false route" button. The unsafe gate is the response.
- Do NOT touch the legacy `src/lib/routing.ts` in this plan. It is out of
  scope and can be cleaned up later.
- Do NOT change the existing honesty levels (`confiable`, `parcial`,
  `no_verificada`). The new `unsafe` level is additive.

## Self-review

1. **Spec coverage:** Goal 1 (SITVA-first) -> Tasks 3, 4. Goal 2 (balanced
   catalog) -> Task 4. Goal 3 (hard-fail) -> Tasks 1, 2, 5. Non-goals
   preserved.
2. **Placeholder scan:** every step has explicit code blocks; no TBD.
3. **Type consistency:** `RouteValidationSummary.unsafe` and
   `HonestyLevel = 'confiable' | 'parcial' | 'no_verificada' | 'unsafe'`
   are the source of truth, used consistently in TS and impl mirror.