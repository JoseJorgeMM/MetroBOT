# LLM Hallucination Defenses (A+B+C+D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stack 4 independent defenses so MetroBOT never shows a user a bus stop that does not exist, never silently invents route ids, and never hides low-confidence routes behind a confident-looking card.

**Architecture:**
- **A Passive:** Extend `routeValidator` to validate all modes (metro/metrocable/tranvia/metroplus/encicla) plus userOrigin/userDest; make `summarizeRouteValidation` actually count steps; persist per-session telemetry in localStorage.
- **B Generator-side:** Pin Gemini config (temperature 0.2, topP 0.8, seed 42, responseMimeType application/json); reinforce prompt with explicit "if unsure return empty routes" + few-shot negatives.
- **C Evidence layer:** Add optional `_evidence: { sourceRouteId, sourceStopName }` to each step schema. After validation, compute `evidenceScore` (0-1) per route.
- **D Honest UX:** New `computeHonestyAssessment(routes)` returning `confiable | parcial | no_verificada`. If `no_verificada`, gate the route display behind an explicit "Ver de todos modos" button + prepend a "no pude verificar..." assistant message.

**Tech Stack:** Vite + React 19 + TypeScript, `@google/genai` (existing), localStorage. No new runtime deps.

---

## File Structure

- Modify: `src/lib/routeValidator.ts` (add `validateMetroStation`, `validateUserCoords`, fix `summarizeRouteValidation`, export `BBOX`).
- Modify: `src/lib/gemini.ts` (pin config, expand prompt, add `_evidence` schema, compute `evidenceScore`).
- Modify: `src/App.tsx` (gate routes behind honesty assessment + render HonestyBadge).
- Modify: `src/components/RouteCards/RouteCard.tsx` (show evidence badge if present).
- New: `src/lib/honesty.ts` (`computeHonestyAssessment`, `HonestyLevel`).
- New: `src/lib/validatorTelemetry.ts` (localStorage-backed telemetry, cap 50 sessions).
- New: `src/lib/evidence.ts` (`computeEvidenceScore`, `missingEvidence`).
- New: `src/components/HonestyBadge.tsx` (color-coded chip + tooltip).
- Modify: `tests/_routeValidator_impl.mjs` (mirror new validators + `summarizeRouteValidation`).
- Modify: `tests/test_routeValidator.mjs` (extend with 8+ new asserts).
- New: `tests/_honesty_impl.mjs`, `tests/test_honesty.mjs` (14+ asserts).
- New: `tests/_validatorTelemetry_impl.mjs`, `tests/test_validatorTelemetry.mjs` (10+ asserts).
- New: `tests/_evidence_impl.mjs`, `tests/test_evidence.mjs` (6+ asserts).
- Modify: `docs/CHANGELOG.md`.

---

## Tasks

### Task 1: Mirror new validators into `_routeValidator_impl.mjs`

**Files:**
- tests/_routeValidator_impl.mjs

- [x] **Step 1:** Add exports `BBOX_VALLE_ABURRA` (if not present), `validateMetroStation(step, stations)`, `validateUserCoords(point, stations)`, `summarizeRouteValidation(routes, allIntegratedRoutes, allStations)`.
- [x] **Step 2:** Implement using the existing `normalize`, `clampBbox`, `distanceMeters` helpers.
- [x] **Step 3:** `validateMetroStation`: METRO_MODES = {metro,metrocable,tranvia,metroplus,encicla}; not in set => `{ok:true,reason:"not-applicable"}`; lookup `step.station?.nameRef || step.station?.name` against `stations[i].nombre` (normalize + includes); no match => `{ok:false,reason:"unknown-station"}`.
- [x] **Step 4:** `validateUserCoords`: `!clampBbox(point)` => `{ok:false,reason:"out-of-bbox"}`; min distance to any station > 25000 => `{ok:false,reason:"far-from-network"}`; else `{ok:true, nearest, distanceMeters}`.
- [x] **Step 5:** `summarizeRouteValidation`: iterate `r.steps`; bus_articulado => `validateBusStep`; else => `validateMetroStation`. Accumulate `validatedSteps`, `degradedSteps`, `total`, `reasons[]`. Return `{ok: degraded===0 && total>0, validatedSteps, degradedSteps, total, reasons}`.
- [x] **Step 6:** Commit (the impl stays in sync with TS by hand).

### Task 2: Extend `tests/test_routeValidator.mjs` (RED)

**Files:**
- tests/test_routeValidator.mjs

- [x] **Step 1:** Import `validateMetroStation`, `validateUserCoords`, `summarizeRouteValidation` from the impl.
- [x] **Step 2:** Add `FAKE_STATIONS = [{nombre:"Acevedo",lat:6.2999,lng:-75.5586,sistema:"metro"}, {nombre:"San Javier",lat:6.2520,lng:-75.6128,sistema:"metro"}]`.
- [x] **Step 3:** Append sections with at least 8 new asserts:
- [x]   - `validateMetroStation`: metro step known `nameRef:"Acevedo"` => ok true.
- [x]   - metro step invented `nameRef:"Parada X"` => ok false reason "unknown-station".
- [x]   - walk step => ok true reason "not-applicable".
- [x]   - bus_articulado step => ok true reason "not-applicable".
- [x]   - `validateUserCoords`: point `6.30,-75.56` => ok true nearest Acevedo.
- [x]   - point `4.0,-75.0` => ok false reason "out-of-bbox".
- [x]   - empty station list + point in bbox => ok false reason "far-from-network".
- [x]   - `summarizeRouteValidation`: 1 valid bus + 1 invalid bus + 1 metro => validatedSteps=2, degradedSteps=1, total=3, ok=false.
- [x] **Step 4:** Run `node tests/test_routeValidator.mjs`. Expect RED (functions not yet in mirror).
- [x] **Step 5:** Commit RED.

### Task 3: Implement in mirror (GREEN)

**Files:**
- tests/_routeValidator_impl.mjs

- [x] **Step 1:** Add the three new functions per Task 1 specs.
- [x] **Step 2:** Run `node tests/test_routeValidator.mjs`. Expect GREEN (>=32 asserts).
- [x] **Step 3:** Commit GREEN.

### Task 4: Mirror the new validators into `src/lib/routeValidator.ts`

**Files:**
- src/lib/routeValidator.ts

- [x] **Step 1:** Add types: `OfficialStation {nombre: string; lat: number; lng: number; sistema?: string}`.
- [x] **Step 2:** Add exports `validateMetroStation`, `validateUserCoords`, fix `summarizeRouteValidation` to match the mirror.
- [x] **Step 3:** Replace the stub `summarizeRouteValidation` body with the real implementation.
- [x] **Step 4:** `npm run lint` -> exit 0. Commit.

### Task 5: Honesty module -- test (RED -> GREEN in same step)

**Files:**
- tests/_honesty_impl.mjs (new)
- tests/test_honesty.mjs (new)

- [x] **Step 1:** Mirror `computeHonestyAssessment(routes)`, `ratioFor(route)`, `PARTIAL_THRESHOLD=0.40`. Levels: `confiable` (worst===0), `parcial` (0 < worst < 0.40), `no_verificada` (worst >= 0.40). Empty routes => confiable. Return `{level, label, worstRatio, totalDegraded}`.
- [x] **Step 2:** Tests with at least 14 asserts: empty routes; all valid; one bus degraded 1/5 (parcial); boundary 2/5 (parcial); 3/5 (no_verificada); mixed three routes worst is 60% (no_verificada); aggregate `totalDegraded`; ratio numeric; missing validation field treated as 0; `total:0` treated as ratio 0; mixed multiple routes worst-wins; non-empty Spanish label per level; `PARTIAL_THRESHOLD` exported; `ratioFor` returns 0 for route with no validation.
- [x] **Step 3:** Run, expect GREEN. Commit.

### Task 6: Implement `src/lib/honesty.ts`

**Files:**
- src/lib/honesty.ts (new)

- [x] **Step 1:** Mirror impl with TS types. Export `HonestyLevel`, `HonestyAssessment`, `computeHonestyAssessment`, `ratioFor`, `PARTIAL_THRESHOLD`. Add JSDoc.
- [x] **Step 2:** `npm run lint` -> exit 0. Commit.

### Task 7: Validator telemetry -- test (RED -> GREEN)

**Files:**
- tests/_validatorTelemetry_impl.mjs (new)
- tests/test_validatorTelemetry.mjs (new)

- [x] **Step 1:** Mirror `KEY="metrobot.validation.telemetry.v1"`, `CAP=50`, `loadTelemetry(storage)`, `saveTelemetry(storage,sessions)`, `recordSession(storage, validated, degraded, now)`, `summarizeTelemetry(storage)`. Pure JS; tolerate null storage and corrupt JSON.
- [x] **Step 2:** Tests with at least 10 asserts: empty storage returns []; corrupt JSON returns []; roundtrip record+load; null storage record returns false; cap behavior (record 60, load returns 50 most recent); summarizeTelemetry with 0 sessions; summarizeTelemetry mixed; ratio calc; schema validation drops entries without ts; cap rollover across calls.
- [x] **Step 3:** Run, expect GREEN. Commit.

### Task 8: Implement `src/lib/validatorTelemetry.ts`

**Files:**
- src/lib/validatorTelemetry.ts (new)

- [x] **Step 1:** Mirror impl with TS types. All SSR-safe via `getStorage()`. Export `KEY`, `CAP`, `loadTelemetry`, `saveTelemetry`, `recordSession`, `summarizeTelemetry`.
- [x] **Step 2:** Lint -> exit 0. Commit.

### Task 9: Evidence score helper -- test (RED -> GREEN)

**Files:**
- tests/_evidence_impl.mjs (new)
- tests/test_evidence.mjs (new)

- [x] **Step 1:** Mirror `computeEvidenceScore(route)`: counts `bus_articulado` steps with valid `_evidence: {sourceRouteId, sourceStopName}`; returns scored/total; if total===0 returns 1. Plus `missingEvidence(route)` returning array of instruction strings.
- [x] **Step 2:** Tests with at least 6 asserts: no bus steps => 1; 2 bus both with evidence => 1; 2 bus one with evidence => 0.5; 2 bus no evidence => 0; missingEvidence returns instruction strings; empty route => score 0, missingEvidence [].
- [x] **Step 3:** Run, expect GREEN. Commit.

### Task 10: Implement `src/lib/evidence.ts`

**Files:**
- src/lib/evidence.ts (new)

- [x] **Step 1:** Mirror impl with TS types.
- [x] **Step 2:** Lint. Commit.

### Task 11: Extend `gemini.ts` -- Defense B + C

**Files:**
- src/lib/gemini.ts

- [x] **Step 1:** Import `computeHonestyAssessment`, `computeEvidenceScore`, `summarizeRouteValidation`, `validateUserCoords`.
- [x] **Step 2:** In the `generateWithRotation` call, change the `config` object to: `{ systemInstruction, temperature: 0.2, topP: 0.8, seed: 42, responseMimeType: "application/json", tools: [...] }`. If TS complains about `seed` not being on the SDK type, use `...( { seed: 42 } as any)`.
- [x] **Step 3:** Wrap the call in try/catch. If the error message includes any of: `unsupported mime type`, `json mime type`, `tools with json mime`, retry once WITHOUT `responseMimeType` (use a `hasRetriedJsonMime` flag).
- [x] **Step 4:** In `renderRouteDeclaration.parameters.properties.steps.items.properties`, add a new property `_evidence: { type: Type.OBJECT, description: "Citation: from which catalog entry this step was derived.", properties: { sourceRouteId: { type: Type.STRING }, sourceStopName: { type: Type.STRING } } }`.
- [x] **Step 5:** Append to the systemInstruction string just before the `grounding` data block:
- [x]     ```
- [x]     REGLAS ANTI-ALUCINACION (NUEVO):
- [x]     - Si NO conoces la parada exacta o el id de ruta, NO incluyas ese paso. Mejor retorna una ruta con menos pasos.
- [x]     - PROHIBIDO inventar ids como "C7-999" o "Linea X". Solo usa los ids de CATALOGO DE BUSES INTEGRADOS.
- [x]     - Para cada step con mode="bus_articulado" incluye _evidence: {sourceRouteId, sourceStopName} citando la fuente del catalogo.
- [x]     EJEMPLOS (NO HACER):
- [x]     - Mal: line:"C7-999", station:{nameRef:"Parada inventada"}.
- [x]     - Bien: omitir esa ruta o usar unicamente el id real del catalogo.
- [x]     ```
- [x] **Step 6:** After the `reconstructBusStep` loop in the `render_route` branch, add:
- [x]     ```ts
- [x]     const officialStations = await loadStations();
- [x]     const summary = summarizeRouteValidation([route], allRoutes, officialStations);
- [x]     route.validation.summary = summary;
- [x]     route.validation.evidenceScore = computeEvidenceScore(route);
- [x]     if (route.userOrigin && route.userOrigin.lat && route.userOrigin.lng) {
- [x]       const v = validateUserCoords({lat:route.userOrigin.lat,lng:route.userOrigin.lng}, officialStations);
- [x]       route.validation.userOriginValid = v.ok;
- [x]     }
- [x]     if (route.userDest && route.userDest.lat && route.userDest.lng) {
- [x]       const v = validateUserCoords({lat:route.userDest.lat,lng:route.userDest.lng}, officialStations);
- [x]       route.validation.userDestValid = v.ok;
- [x]     }
- [x]     ```
- [x] **Step 7:** Lint + build. Commit.

### Task 12: HonestyBadge component

**Files:**
- src/components/HonestyBadge.tsx (new)

- [x] **Step 1:** Component takes `level: HonestyLevel`, `worstRatio: number`, `label: string`. Renders an inline chip with icon (ShieldCheck / ShieldAlert / ShieldAlert) + text.
- [x] **Step 2:** Use Tailwind classes:
- [x]   - confiable: `bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200`
- [x]   - parcial: `bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200`
- [x]   - no_verificada: `bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200`
- [x] **Step 3:** `role="status" aria-live="polite"` and `data-testid="honesty-badge"`.
- [x] **Step 4:** Lint. Commit.

### Task 13: Wire honesty gate in `App.tsx`

**Files:**
- src/App.tsx

- [x] **Step 1:** Import `computeHonestyAssessment`, `HonestyBadge`, `recordSession`, `getStorage`.
- [x] **Step 2:** Add state `pendingRoutes` (routes awaiting user bypass), `honestyMessage` (assistant text to prepend), `showHonestyBypass` (bool).
- [x] **Step 3:** In the `processUserQuery` success path, after `setRoutes(newRoutes)`, compute the assessment. If `level === "no_verificada"`:
- [x]   - do NOT call `setRoutes(newRoutes)` directly; instead `setPendingRoutes(newRoutes)` and `setHonestyMessage("No pude verificar X paradas en este recorrido...")` and `setShowHonestyBypass(true)`.
- [x]   - the message goes via `setMessages`.
- [x]   - render a `<button>"Ver de todos modos"</button>` somewhere visible (inside the message bubble).
- [x] **Step 4:** On click of the bypass button, call `setRoutes(pendingRoutes)`, `setShowHonestyBypass(false)`.
- [x] **Step 5:** After successful route processing (regardless of level), call `recordSession(storage, sumValidated, sumDegraded, Date.now())`.
- [x] **Step 6:** Render `<HonestyBadge level={assessment.level} worstRatio={assessment.worstRatio} label={assessment.label} />` next to the "Rutas Sugeridas" heading whenever `routes.length > 0`.
- [x] **Step 7:** Lint + build. Commit.

### Task 14: Full verification

**Files:**

- [x] **Step 1:** `node tests/test_routeValidator.mjs` -> >=32/32 GREEN.
- [x] **Step 2:** `node tests/test_stationResolver.mjs` -> 7/7 GREEN.
- [x] **Step 3:** `node tests/test_honesty.mjs` -> 14+/14+ GREEN.
- [x] **Step 4:** `node tests/test_validatorTelemetry.mjs` -> 10+/10+ GREEN.
- [x] **Step 5:** `node tests/test_evidence.mjs` -> 6+/6+ GREEN.
- [x] **Step 6:** Other 5 test files (test_share, test_favorites, test_recents, test_pwa_strategies, test_pwa_hooks, test_enrichment.cjs) GREEN.
- [x] **Step 7:** `npm run lint` exit 0.
- [x] **Step 8:** `npm run build` exit 0.
- [x] **Step 9:** Update `docs/CHANGELOG.md` with section `## 2026-06-26 -- Plan D: LLM hallucination defenses`.
- [x] **Step 10:** Commit.

---

## Notes / YAGNI

- Do NOT add a Zustand store. Honesty state lives in `App.tsx` useState.
- Do NOT change the existing `validateBusStep` signature. New functions are additive.
- The `seed: 42` config may break if Gemini SDK rejects it. If TS complains, narrow with `(config as any).seed = 42` or omit the property if `@google/genai` v1.29 does not support it.
- `responseMimeType: "application/json"` may break tool use in some Gemini versions. The retry-without-mime fallback in Task 11 Step 3 handles this.
- HonestyBadge must be readable in dark mode -- use Tailwind dark variants as specified.
- Telemetry is best-effort; never throw.
