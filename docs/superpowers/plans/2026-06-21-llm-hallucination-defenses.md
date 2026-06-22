# LLM Hallucination Defenses for MetroBOT Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Gemini from showing the user a bus stop that does not exist on the route. Validate and reconstruct every `bus_articulado` step against the real `rutas_integradas.json` data, surface a disclaimer banner, and label each suggested route as "validated" or "unvalidated".

**Architecture:** New `src/lib/routeValidator.ts` is the single source of truth for "is this step real?". After Gemini calls `render_route`, the Gemini wrapper iterates each route's steps, runs any `bus_articulado` step through `reconstructBusStep`, and replaces the LLM-supplied station/coords with the ones from the JSON. The Gemini schema for `steps[].station` is tightened to require a `nameRef` from a closed enum, removing the ability to invent lat/lng. UI gains a fixed disclaimer banner, a per-route validation badge, and a collapsible panel listing the real route stops.

**Tech Stack:** Vite + React 19 + TypeScript (existing), `@google/genai` (existing), no new runtime deps. Tests use a self-contained Node script (`tests/test_routeValidator.mjs`) so we do not pull in Vitest/Jest.

---

## File Structure

- `src/lib/routeValidator.ts` (NEW): `BBOX_VALLE_ABURRA`, `clampBbox`, `validateBusStep`, `reconstructBusStep`, `buildStopLookup`.
- `src/lib/integratedRoutes.ts` (MODIFY): export `getStopLookup()` so `routeValidator` and `gemini.ts` share the same cached lookup.
- `src/lib/gemini.ts` (MODIFY): tighten `steps[].station` schema to `{ nameRef: string }`; run `reconstructBusStep` over every step before calling `onRouteFound`; emit `validation` flags per route.
- `src/components/RouteCards/RouteCard.tsx` (MODIFY): accept `validation` flag, render badge ("validated" / "unvalidated"), add collapsible panel with real stops for `bus_articulado` routes.
- `src/App.tsx` (MODIFY): render a persistent disclaimer banner when routes are shown.
- `tests/test_routeValidator.mjs` (NEW): self-contained Node test runner (no Vitest).

---

### Task 1: Write failing tests for `routeValidator`

**Files:**
- Create: `tests/test_routeValidator.mjs`

- [ ] **Step 1: Write the test runner skeleton**

Create `tests/test_routeValidator.mjs` with a tiny `assertEq` helper and 4 tests:
- `clampBbox` returns `true` for a point inside the Valle de Aburrá bbox and `false` for one outside.
- `validateBusStep` returns `ok: true` when the step references a real route id and a `nameRef` that matches a stop within 400m of the supplied coords.
- `validateBusStep` returns `ok: false` with `reason: 'route-not-found'` when the route id is unknown.
- `validateBusStep` returns `ok: false` with `reason: 'stop-too-far'` when the nearest matching stop is more than 400m away.
- `reconstructBusStep` rewrites a valid step into one whose `instruction` mentions the real route id and whose `station` carries the JSON stop's coords (not whatever the LLM sent).
- `reconstructBusStep` degrades an invalid step to a `walk` step with an honest `instruction` and `cost: 0`, never `bus_articulado`.

- [ ] **Step 2: Run tests to confirm RED**

`node tests/test_routeValidator.mjs` should exit non-zero because `src/lib/routeValidator.ts` does not exist yet.

---

### Task 2: Implement `routeValidator.ts` (GREEN)

**Files:**
- Create: `src/lib/routeValidator.ts`

- [ ] **Step 1: Implement the bbox constant and clamp**

```ts
export const BBOX_VALLE_ABURRA = { latMin: 5.95, latMax: 6.45, lngMin: -75.85, lngMax: -75.30 } as const;
export function clampBbox(p: { lat: number; lng: number } | null | undefined): boolean { ... }
```

- [ ] **Step 2: Implement `buildStopLookup`**

Cache a `Map<string, IntegratedRoute>` keyed by route id (case-insensitive). Also cache `Map<routeId, IntegratedStop[]>` so `validateBusStep` is O(N) only on the candidate route.

- [ ] **Step 3: Implement `validateBusStep`**

Signature:
```ts
export interface BusStepCandidate {
  mode: 'bus_articulado';
  line?: string;          // candidate route id (matches manifest id or name)
  station?: { nameRef: string; lat: number; lng: number };
}
export type ValidationReason = 'route-not-found' | 'stop-too-far' | 'invalid-step';
export interface ValidationResult {
  ok: boolean;
  reason?: ValidationReason;
  validatedRoute?: IntegratedRoute;
  boardingStop?: IntegratedStop;
  distanceMeters?: number;
}
```

Logic: lookup route by id (or by `name` if id miss). If not found ? `{ ok: false, reason: 'route-not-found' }`. Else find stop by normalized name match within 400m of the candidate coords. If no stop within 400m ? `{ ok: false, reason: 'stop-too-far' }`. Else ? `{ ok: true, validatedRoute, boardingStop, distanceMeters }`.

- [ ] **Step 4: Implement `reconstructBusStep`**

```ts
export interface RouteStep { instruction: string; mode: ...; duration: number; cost?: number; line?: string; station?: { nameRef: string; lat: number; lng: number }; }
export function reconstructBusStep(step: RouteStep, ctx: { routes: IntegratedRoute[] }): { step: RouteStep; validation: ValidationResult };
```

Behavior:
- If `step.mode !== 'bus_articulado'`, return `{ step, validation: { ok: true } }` (no-op for other modes).
- Else call `validateBusStep`. On `ok: true` return a new step whose `instruction` reads `"Toma el Bus Integrado {id} ({stops.length} paradas) en '{boardingStop.name}'"`, `station` is the real `boardingStop` with its real coords, `cost` stays whatever Gemini sent (defaults to 0), `line` is the route's real `name`.
- On any `ok: false`, degrade to `{ mode: 'walk', instruction: "Camina hacia tu destino (el bus integrado indicado no estaba en nuestro cat\u00e1logo)", cost: 0 }` and return the validation result.

- [ ] **Step 5: Re-run tests until GREEN**

`node tests/test_routeValidator.mjs` must exit 0 and print "ALL TESTS PASS".

---

### Task 3: Tighten the Gemini schema (REFACTOR)

**Files:**
- Modify: `src/lib/gemini.ts`

- [ ] **Step 1: Replace free `station` with `nameRef`**

Change the `steps[].station` schema from `{ name: string, lat: number, lng: number }` to `{ nameRef: string }`. Add an explanation in the schema that `nameRef` must match an exact id from the catalog (or empty for `walk`).

- [ ] **Step 2: Run `reconstructBusStep` over every step before `onRouteFound`**

Import `reconstructBusStep` and `loadIntegratedRoutes` (already exported). After `args.routes.forEach(...)`, loop again and replace `route.steps[i]` with `reconstructed.step`. Collect per-route validation results and attach them to `route.validation: { ok: boolean, degradedSteps: number, validatedStops: number }`.

- [ ] **Step 3: Drop `lat/lng` reconstruction cost**

The post-processing in gemini.ts currently sets `step.cost` per mode. Make sure `reconstructBusStep` does NOT clobber that. Specifically: if `step.mode === 'bus_articulado'` and validation ok, keep the LLM-suggested `cost` if any, otherwise default to 0.

---

### Task 4: UI disclaimer banner

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Render persistent banner when routes are present**

Below the chat header (or above the routes list), add a `<div>` that reads: "Las rutas mostradas son candidatas calculadas con base en tus coordenadas y los datos oficiales del SITVA. Verifica el paradero en el mapa antes de abordar." Style with the existing `bg-amber-50` / `dark:bg-amber-950/30` palette to match the weather banner. Only renders when `routes.length > 0`.

---

### Task 5: Validation badge + real-stops panel in `RouteCard`

**Files:**
- Modify: `src/components/RouteCards/RouteCard.tsx`

- [ ] **Step 1: Extend the props type**

Add optional `validation?: { ok: boolean; validatedStops: number; degradedSteps: number; realStops?: IntegratedStop[] }` to `RouteCardProps`. When `validation` is present and `ok`, show a green badge "? validado" beside the duration. When present and `!ok`, show an amber badge "? sin validar" with a tooltip counting degraded steps.

- [ ] **Step 2: Collapsible real-stops panel**

For any step that is a `bus_articulado` and was validated, render a small `<details>` block beneath the step's instructions containing the first 6 real stops from `validation.realStops` plus "Ver todas (N)". Style muted (`text-slate-500`).

---

### Task 6: Verification before completion

- [ ] **Step 1: Run `node tests/test_routeValidator.mjs`** — must print `ALL TESTS PASS` and exit 0.
- [ ] **Step 2: Run `npm run lint`** — must exit 0 with no errors.
- [ ] **Step 3: Run `npm run build`** — must exit 0 and produce `dist/assets/index-*.js`.
- [ ] **Step 4: Runtime smoke check** — `node -e "const j=require('./public/rutas_integradas.json'); console.log(j.length)"` must print `125`.
- [ ] **Step 5: No stale references** — `grep -r "station.lat" src` (manual equivalent: `Select-String -Path src -Pattern "station.lat"`) must return 0 hits.

---

## Notes

- All new code must follow existing file/comment conventions: 2-space indent, ES modules, no inline comments unless requested.
- The `nameRef` schema change means Gemini may emit a step with an empty `nameRef` for `walk` steps. Handle that gracefully (`station === undefined` is OK for `walk`).
- If `reconstructBusStep` finds a match but the candidate coords are wildly off (e.g. > 5km from any real stop), prefer the JSON boarding stop's coords and ignore the candidate's lat/lng entirely.
- We do NOT touch `public/rutas_integradas.json` in this plan — the data side is unchanged.
