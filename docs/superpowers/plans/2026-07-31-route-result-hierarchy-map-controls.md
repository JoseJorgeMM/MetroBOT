# Route Result Hierarchy and Map Control Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make route result selection and navigation separate, touch-safe actions while making map controls accessible and non-colliding on mobile.

**Architecture:** Keep the existing routing, Leaflet map, and navigation state. `RouteCard` owns its explicit selection and navigation controls; `App.tsx` supplies the selected-route callback. Map components retain their existing behavior while exposing unique names, 44 px controls, state-aware placement, and meaningful marker labels.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, react-leaflet, node:test, react-dom/server.

## Global Constraints

- Do not change routing algorithms, public route data, Leaflet map logic, or navigation logic.
- Preserve route details, validation, sharing, and every existing navigation path.
- Use correct user-facing Spanish accents and punctuation.
- Maintain at least 44 x 44 CSS pixel targets for interactive icon controls.

---

### Task 1: Route card semantics and compact hierarchy

**Files:**
- Modify: `tests/mobileShell.test.tsx`
- Modify: `src/components/RouteCards/RouteCard.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `RouteCardProps.onSelect?: (route: RouteOption) => void`.
- Consumes: `App.tsx` route index to select the corresponding card.

- [ ] **Step 1: Write the failing semantic test**

Add a literal `RouteOption` fixture and render `RouteCard` with `onSelect` and `onStartNav`; assert for `aria-label="Seleccionar ruta"` and `Iniciar navegación`.

- [ ] **Step 2: Verify the test is red**

Run: `npx tsx --test tests/mobileShell.test.tsx`

Expected: TypeScript compilation fails because `RouteCardProps` has no `onSelect` prop and the navigation copy is unaccented.

- [ ] **Step 3: Implement the minimal semantic hierarchy**

Replace the vehicle banner with a compact row of mode icons, retain time/modes/transfers/cost/walking/validation before steps, and add a real 44 px selection button. Keep start navigation as the primary action. Pass `onSelect={() => setActiveRouteIndex(index)}` from `App.tsx` and remove the wrapper click handler.

- [ ] **Step 4: Verify green**

Run: `npx tsx --test tests/mobileShell.test.tsx`

Expected: all assertions pass.

### Task 2: Map and navigation control accessibility

**Files:**
- Modify: `src/components/Map/MapComponent.tsx`
- Modify: `src/components/Map/LocateControl.tsx`
- Modify: `src/components/Map/NavigationOverlay.tsx`

**Interfaces:**
- Consumes: existing navigation state from `MapComponent` and `NavigationOverlay`.
- Produces: uniquely named, touch-safe controls and station labels that describe interactive Leaflet markers.

- [ ] **Step 1: Audit each interactive control in the existing components**

Identify locate, layer/theme, close, overview, WhatsApp, mute, stop, and station-marker controls; retain their existing callbacks and state conditions.

- [ ] **Step 2: Implement accessible controls without changing behavior**

Give icon-only controls unique `aria-label` and `title` values, use minimum `w-11 h-11` sizing, hide nonessential controls during navigation, and position remaining controls clear of the mobile sheet and navigation cue. Bind interactive station markers with their station name as the accessible label when Leaflet supports it.

- [ ] **Step 3: Run focused semantic regression coverage**

Run: `npx tsx --test tests/mobileShell.test.tsx`

Expected: all tests pass.

### Task 3: Verify, review, report, and commit

**Files:**
- Create: `.superpowers/sdd/2026-07-30-mobile-map-first-ux/task-6-report.md`
- Modify: files changed in Tasks 1 and 2

- [ ] **Step 1: Run required verification**

Run: `npx tsx --test tests/mobileShell.test.tsx`, `npm run lint`, and `npm run build`.

- [ ] **Step 2: Perform a diff-based self-review**

Inspect `git diff --check` and the staged diff against the task brief; fix any regression or requirement gap.

- [ ] **Step 3: Write the task report**

Record the behavior changes, commands and outcomes, commit SHA, and any remaining manual browser-validation concern.

- [ ] **Step 4: Commit the task files**

Run: `git add src/App.tsx src/components/RouteCards/RouteCard.tsx src/components/Map/MapComponent.tsx src/components/Map/LocateControl.tsx src/components/Map/NavigationOverlay.tsx tests/mobileShell.test.tsx docs/superpowers/plans/2026-07-31-route-result-hierarchy-map-controls.md .superpowers/sdd/2026-07-30-mobile-map-first-ux/task-6-report.md` then `git commit -m "feat: refine mobile routes and map controls"`.
