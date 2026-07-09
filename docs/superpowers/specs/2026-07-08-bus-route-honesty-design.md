# Bus Route Honesty — Prompt + Catalog + Hard-Fail Validation

> **Status:** design approved (Option A — 3 layers)
> **Date:** 2026-07-08
> **Bug:** Every Gemini query returns routes dominated by `bus_articulado`, many of which reference bus lines or stops that do not exist in `public/rutas_integradas.json`. The current validator only marks such steps as `degraded` (warns the user); it never hides the route, so a user can be sent to a non-existent bus stop.

## Why

1. **Gemini prompt bias** (`src/lib/gemini.ts:498, 504`): the system prompt explicitly says *"Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses)"* and *"Si hay una parada de BUS ARTICULADO cerca del usuario, usala"*. The model is trained to prefer buses.
2. **Catalog weight in the prompt** (`src/lib/gemini.ts:242`): the prompt feeds 80 of 125 integrated routes to Gemini, dwarfing the 30-ish SITVA stations passed via `getGroundingData()`. The model sees buses as the dominant network.
3. **Validator has no hard-fail** (`src/lib/routeValidator.ts:summarizeRouteValidation`): a route with 100% invalid bus steps is still rendered. The honesty layer in `App.tsx:163` shows it as `no_verificada` and lets the user click "Ver de todos modos".

## Goals

1. Gemini must default to **SITVA (Metro/Metrocable/Tranvía/Metroplús/EnCicla)** when origin and destination are within the Valle de Aburrá network coverage. Buses are treated as feeders, not as the backbone.
2. The catalog passed to Gemini must **balance** stations and bus routes. Stations are mentioned first; the bus catalog is capped at 30 entries.
3. The validator must **hard-fail** any route whose ratio of `degradedSteps / total >= 0.5` AND whose dominant mode is `bus_articulado`. Such a route is tagged `unsafe` and the UI must not render it (not even behind a "Ver de todos modos" gate).

## Non-goals

- Refactoring the validator's per-step logic (it is already correct; we add a new derived flag).
- Forcing Gemini to never suggest buses (some users explicitly need them for peripheral zones).
- Adding a separate user-facing "report false route" button.
- Rewriting the legacy `src/lib/routing.ts` (out of scope; tracked separately).

## Decisions

- **Threshold**: `0.5` (50%). If half or more of a route's steps fail validation AND the dominant mode is `bus_articulado`, the route is `unsafe`.
- **Catalog cap**: `30` integrated routes passed to Gemini (was 80). The selection prefers routes that touch the origin or destination zones; the rest are picked round-robin from the 125.
- **Prompt rewrite**: three rules in order. SITVA is the backbone. Buses are feeders. Hallucination is forbidden. Negative example preserved.
- **Hard-fail is additive**, not a replacement. Existing `degraded`/`parcial`/`no_verificada` logic keeps working; `unsafe` is a new top-level signal.
- **The UI (`App.tsx`) drops unsafe routes** silently. No "Ver de todos modos" for unsafe. The user sees a clear assistant message: *"No encontre rutas validas para este trayecto. Intenta con origen y destino dentro de la red SITVA."*

## Architecture

### A. `src/lib/gemini.ts` (prompt)

Replace the current `sysPrompt` block (lines 497-534) with a SITVA-first version. Key changes:

- Remove the line *"Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses)"*.
- Add an explicit SITVA-first rule with a hard threshold: *"Si el origen Y el destino estan a menos de 1.5 km de una estacion SITVA, la ruta DEBE usar SITVA como backbone. Los buses solo se sugieren como (a) alimentador desde zonas SIN cobertura SITVA o (b) cuando el usuario pide explicitamente bus."*
- Move the existing anti-hallucination rules under a new "REGLA 0: BACKBONE SITVA" header.
- Keep the "EJEMPLOS (NO HACER)" block.

Also adjust the catalog section (line 242): `allIntegratedRoutes.slice(0, 30)` instead of 80, and add a 30-station slice to the grounding string so Gemini sees both datasets with similar weight.

### B. `src/lib/gemini.ts` (catalog balance)

In the section that builds `grounding` (lines 199-244), add a 30-station block right after the `nearbyContext` / `integratedContext` / `passingThrough` block. Use `getGroundingData()` to pull the official station catalog and slice the first 30.

### C. `src/lib/routeValidator.ts` (unsafe flag)

Add a new helper `isRouteUnsafe(route, allIntegratedRoutes, allStations, threshold = 0.5)`:

```
1. Count bus steps and metro steps.
2. If bus_steps / total > 0 AND bus_steps > metro_steps:
     ratio = degradedSteps / total
     if ratio >= threshold:
       return true
3. Else: return false
```

The function reuses `summarizeRouteValidation` internally. Export the threshold as `BUS_UNSAFE_THRESHOLD = 0.5`.

Add the flag to the per-route validation summary:

```
export interface RouteValidationSummary {
  ok: boolean;
  validatedSteps: number;
  degradedSteps: number;
  total: number;
  reasons: string[];
  unsafe: boolean;          // NEW
  unsafeReason?: string;     // NEW
}
```

`summarizeRouteValidation` is updated to populate `unsafe` and `unsafeReason`.

### D. `src/lib/honesty.ts`

Add a new level `'unsafe'` to the `HonestyLevel` union. Update `computeHonestyAssessment` to detect `unsafe` routes first (before `confiable`/`parcial`/`no_verificada`). When any route is `unsafe`, the assessment is `unsafe` regardless of other ratios.

`PARTIAL_THRESHOLD` stays at `0.41`. New `UNSAFE_DEGRADED_THRESHOLD = 0.5`.

### E. `src/App.tsx`

In the `(newRoutes) => { ... }` callback (lines 315-334):

1. Compute the honesty assessment as today.
2. If `assessment.level === 'unsafe'`, do **not** call `setPendingRoutes` or `setRoutes`. Render a clear assistant message: *"No encontre rutas validas para este trayecto. Intenta con origen y destino dentro de la red SITVA, o verifica los nombres de los lugares."* Then return.
3. Existing `no_verificada` flow keeps working for routes that are partially valid.

The render block (lines 459-477) already filters by `routes.length > 0`, so dropping unsafe routes is a no-op for the UI (no extra change needed).

### F. Tests (TDD, written before any production change)

1. `tests/test_routeValidator.mjs` + `_routeValidator_impl.mjs` — extend with:
   - `isRouteUnsafe` pure helper: 6+ asserts.
   - `summarizeRouteValidation` returns `unsafe: true` for a route with 2/2 invalid bus steps.
   - `summarizeRouteValidation` returns `unsafe: false` for a route with 1/3 invalid bus step (ratio 0.33, under threshold).
   - `summarizeRouteValidation` returns `unsafe: false` for a route with metro + 1 invalid bus (bus is not dominant).
   - Threshold parameter is honored: passing `0.3` makes a 1/3 route `unsafe`.

2. `tests/test_honesty.mjs` + `_honesty_impl.mjs` — extend with:
   - `computeHonestyAssessment` returns `level: 'unsafe'` when at least one route has `validation.unsafe === true`.
   - Mixed input: one `confiable` + one `unsafe` -> `level: 'unsafe'` (the most restrictive wins).

3. `tests/test_gemini_prompt.mjs` + `_gemini_prompt_impl.mjs` — pure string check:
   - `buildSysPrompt({ grounding, integratedSnippet, stationSnippet, tarifas, tiempos, encicla, news })` returns a string that:
     - Does NOT contain the legacy phrase *"Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses)"*.
     - DOES contain the new SITVA-first rule (substring match).
     - Mentions "CATALOGO DE BUSES" somewhere.
     - Does NOT contain the literal `integratedRoutes.slice(0, 80)` (we cap at 30).
   - The pure function takes a `grounding` arg and inserts it into the template; this lets us assert the contract without calling Gemini.

4. (No new UI test; the App.tsx branch is covered by the existing manual smoke.)

### G. Verification

- `node tests/test_routeValidator.mjs` -> all asserts green.
- `node tests/test_honesty.mjs` -> all asserts green.
- `node tests/test_gemini_prompt.mjs` -> all asserts green.
- Other 11 test files still green.
- `npm run lint` exit 0.
- `npm run build` exit 0.
- Manual: query "de Poblado a Niquia" -> Gemini returns SITVA route (Metro Linea A); no fabricated buses.

## Risks

- **R1.** Changing the prompt may shift Gemini's output for non-bus queries too. We mitigate by leaving the anti-hallucination rules intact and only changing the bias line.
- **R2.** With `temperature: 0.2, seed: 42` the output is mostly deterministic, but not perfectly. Two consecutive identical queries may still differ. The hard-fail guard catches the worst case.
- **R3.** If the user is in a zone with no SITVA coverage (e.g. remote Vereda), every route will be `unsafe` because all options are buses. The UI message must be honest about this. Mitigation: the message says *"Intenta con origen y destino dentro de la red SITVA"*, which is true guidance, not a dead end.

## File-by-file change list

| File | Action |
|---|---|
| `src/lib/gemini.ts` | Rewrite `sysPrompt`; add `buildSysPrompt(parts)` pure helper; cap `integratedRoutes` at 30; add 30-station snippet. |
| `src/lib/routeValidator.ts` | Add `BUS_UNSAFE_THRESHOLD`; add `isRouteUnsafe`; add `unsafe` / `unsafeReason` to `RouteValidationSummary`; update `summarizeRouteValidation`. |
| `src/lib/honesty.ts` | Add `'unsafe'` to `HonestyLevel`; add `UNSAFE_DEGRADED_THRESHOLD`; update `computeHonestyAssessment`. |
| `src/App.tsx` | Drop unsafe routes in the route callback; new assistant message. |
| `tests/_gemini_prompt_impl.mjs` | **New.** Pure mirror of `buildSysPrompt`. |
| `tests/test_gemini_prompt.mjs` | **New.** Prompt contract asserts. |
| `tests/test_routeValidator.mjs` + `_routeValidator_impl.mjs` | Extend with `isRouteUnsafe` and `unsafe` flag. |
| `tests/test_honesty.mjs` + `_honesty_impl.mjs` | Extend with `unsafe` level. |
| `docs/CHANGELOG.md` | New `## 2026-07-08 - Bus route honesty` section. |

## Out of scope

- Removing `src/lib/routing.ts` (legacy). Tracked separately.
- Refactoring the `useNavigation` hook to detect unsafe routes during navigation start.
- Adding a user-facing "this route was wrong" feedback button.

## Self-review

1. **Spec coverage:** Goal 1 (SITVA-first) -> A, B. Goal 2 (balanced catalog) -> A, B. Goal 3 (hard-fail) -> C, D, E. Non-goals: validator per-step logic untouched; no bus-banning; no new UI button; legacy routing.ts untouched.
2. **Placeholder scan:** every step in the plan has explicit code blocks for new functions.
3. **Type consistency:** `RouteValidationSummary` gains `unsafe: boolean; unsafeReason?: string;`. `HonestyLevel` gains `'unsafe'`. The new `isRouteUnsafe` function reuses `summarizeRouteValidation` (no parallel logic).