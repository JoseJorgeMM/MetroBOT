# Task 6 Fix Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct Task 6 route-summary semantics and make the existing mobile location control usable from the map.

**Architecture:** `RouteCard` will normalize incomplete route data before deriving metadata, render transport modes as a semantic list with Spanish names, and receive a zero-based route index from `App.tsx`. A focused `MapLocationControl` adapter will mount `LocateControl` from `MapComponent` and delegate browser geolocation and Leaflet pan behavior to a testable helper.

**Tech Stack:** React 19, TypeScript, react-leaflet/Leaflet, node:test, react-dom/server.

## Global Constraints

- Do not modify route calculation, navigation callbacks, public route data, or dependencies.
- Preserve route steps, validation, real stops, sharing, and navigation start behavior.
- Do not change the recorded desktop WhatsApp Minor.
- Verify each reported failure with a focused red-green test.

---

### Task 1: Route-card accessibility and incomplete-data semantics

**Files:**
- Modify: `src/components/RouteCards/RouteCard.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/mobileShell.test.tsx`

**Interfaces:**
- Produces: `RouteCardProps.routeIndex?: number`, passed as the zero-based index by `App.tsx`.
- Produces: safe route-step normalization for runtime-incomplete route data.

- [ ] **Step 1: Add failing semantic tests**

Render a card with incomplete `steps` and one with `steps: []` plus `modes: ['walk']`; assert rendering does not throw, walking is declared, and `Iniciar navegación` remains present. Render two same-duration cards with indices 0 and 1; assert distinct selection labels. Assert the mode summary is a `ul` with Spanish text for each icon.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npx tsx --test tests/mobileShell.test.tsx`

Expected: missing-step render throws and/or selection and mode semantic assertions fail.

- [ ] **Step 3: Implement the smallest route-card change**

Normalize `route.steps` to `steps`, derive walking from steps or modes, use `Incluye tramo a pie` where no walking duration is known, map modes to human Spanish labels, render a semantic list, and add the ordinal plus duration/mode details to the selection label.

- [ ] **Step 4: Run the route-card test to verify GREEN**

Run: `npx tsx --test tests/mobileShell.test.tsx`

Expected: all assertions pass.

### Task 2: Mounted mobile location-control contract

**Files:**
- Create: `src/components/Map/MapLocationControl.tsx`
- Modify: `src/components/Map/LocateControl.tsx`
- Modify: `src/components/Map/MapComponent.tsx`
- Create: `tests/mapLocationControl.test.tsx`

**Interfaces:**
- Produces: `requestMapLocation(map, onFirstFix, onError?, geolocation?)` that flies the current Leaflet map to the first GPS fix before notifying the control.
- Consumes: `LocateControl.onRequestLocation(onFirstFix, onError?)` and remains unmounted while navigation hides the mobile control stack.

- [ ] **Step 1: Add failing location-control tests**

Server-render the adapter and assert the `Ubicarme en el mapa` accessible label. Invoke the production helper with a fake geolocation source and fake Leaflet map; assert the map flies to the fix and the callback receives its coordinates. Invoke its error branch and assert the supplied error callback is called.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npx tsx --test tests/mapLocationControl.test.tsx`

Expected: module/import failure because the adapter and helper do not exist.

- [ ] **Step 3: Implement the mounted adapter and error path**

Create `MapLocationControl`, extend `LocateControl` with an optional error callback, and render the adapter inside `MapComponent`’s existing non-navigation mobile controls. Use the existing Leaflet map reference to call `flyTo` and leave planner geolocation untouched.

- [ ] **Step 4: Run the location-control test to verify GREEN**

Run: `npx tsx --test tests/mapLocationControl.test.tsx`

Expected: all assertions pass.

### Task 3: Verify, report, and commit

**Files:**
- Modify: `.superpowers/sdd/2026-07-30-mobile-map-first-ux/task-6-report.md`
- Modify: files changed in Tasks 1 and 2

- [ ] **Step 1: Run final verification**

Run: `npx tsx --test tests/mobileShell.test.tsx tests/mapLocationControl.test.tsx`, `npm run lint`, `npm run build`, and `git diff --check`.

- [ ] **Step 2: Append exact red/green evidence**

Append a `Fix Round 1/5` section listing the failed and passing commands, findings fixed, changed files, final checks, and unchanged Minor.

- [ ] **Step 3: Commit task code and tests**

Run: `git add src/App.tsx src/components/RouteCards/RouteCard.tsx src/components/Map/LocateControl.tsx src/components/Map/MapLocationControl.tsx src/components/Map/MapComponent.tsx tests/mobileShell.test.tsx tests/mapLocationControl.test.tsx docs/superpowers/plans/2026-07-31-task-6-fix-round-1.md` then `git commit -m "fix: harden route summaries and location control"`.
