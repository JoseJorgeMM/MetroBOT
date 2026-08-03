# Mobile Map-First UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MetroBOT’s chat-first mobile shell with a coherent map-first trip-planning experience that uses one bottom-sheet state model and keeps all existing routing, Gemini, live-status, and navigation capabilities.

**Architecture:** Add a pure semantic surface reducer as the single source of truth for `explore`, `planning`, `loading`, `results`, `assistant`, and `navigation`. Split the mobile shell, planner, and assistant presentation into focused components; move map-point selection into a small Leaflet controller; keep application data and service calls in `App.tsx`.

**Tech Stack:** Vite 6, React 19, TypeScript 5.8, Tailwind CSS 4, react-leaflet 5, lucide-react, Node test runner through `tsx`.

## Global Constraints

- Primary viewport range is 360–430 CSS pixels wide.
- Preserve routing algorithms, public route data, Gemini integration, grounded Metro status, and navigation behavior.
- Do not edit `public/rutas_integradas.json`.
- Do not add a new runtime dependency.
- Every primary mobile control must have a minimum 44 × 44 CSS pixel target.
- Input text must remain at least 16 CSS pixels on mobile.
- User-facing Spanish must use correct accents and punctuation.
- Chat remains reachable in one tap but cannot dominate the initial state.
- Only one bottom-sheet state system may remain in production code.
- Live operational uncertainty must continue to display “No verificado”; never infer normal operation.

---

## File Structure

- Create `src/lib/mobileSurface.ts`: pure semantic state and transition model.
- Create `src/hooks/useMobileSurface.ts`: React wrapper around the pure reducer.
- Create `src/components/MobileBottomSheet.tsx`: accessible sheet frame and drag/tap presentation.
- Create `src/components/MobileExploreActions.tsx`: compact first-run destination and assistant actions.
- Create `src/components/TripPlannerPanel.tsx`: origin/destination, geocoding results, map-selection actions, and advanced bus preference.
- Create `src/components/AssistantPanel.tsx`: chat history, suggestions, support information, and composer.
- Create `src/components/Map/MapSelectionController.tsx`: Leaflet click/reverse-geocode bridge.
- Modify `src/components/Map/MapComponent.tsx`: remove embedded `MapSearch`, host map-selection controller, and expose a focused map-selection interface.
- Modify `src/components/Map/MapSearch.tsx`: retire after its search behavior is transferred; delete only after parity verification.
- Modify `src/components/QuickPicksBar.tsx`: mobile one-row favorites and 44 px actions.
- Modify `src/components/RouteCards/RouteCard.tsx`: compact result hierarchy, real selectable button semantics, corrected copy.
- Modify `src/App.tsx`: use the semantic surface model and compose the new mobile shell.
- Modify `src/index.css`: map/sheet safe-area, mobile keyboard-height, focus, overflow, and reduced-motion refinements.
- Create `tests/mobileSurface.test.ts`: real production reducer tests.
- Create `tests/mobileShell.test.tsx`: server-rendered semantic and accessibility tests for shell components.
- Create `tests/tripPlanner.test.tsx`: server-rendered planner contract tests.
- Create `tests/mobile_copy.test.tsx`: visible Spanish and persistent-control regression tests.

---

### Task 1: Semantic Mobile Surface Model

**Files:**
- Create: `src/lib/mobileSurface.ts`
- Create: `src/hooks/useMobileSurface.ts`
- Test: `tests/mobileSurface.test.ts`

**Interfaces:**
- Produces:
  - `type MobileSurface = 'explore' | 'planning' | 'loading' | 'results' | 'assistant' | 'navigation'`
  - `type SheetPresentation = 'compact' | 'medium' | 'expanded'`
  - `type MobileSurfaceEvent`
  - `transitionMobileSurface(state, event): MobileSurface`
  - `presentationForSurface(surface): SheetPresentation`
  - `useMobileSurface(initial?): { surface, presentation, dispatch }`

- [ ] **Step 1: Write failing reducer tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  presentationForSurface,
  transitionMobileSurface,
} from '../src/lib/mobileSurface';

test('the app opens in explore with a compact sheet', () => {
  assert.equal(presentationForSurface('explore'), 'compact');
});

test('destination action opens planning', () => {
  assert.equal(
    transitionMobileSurface('explore', { type: 'OPEN_PLANNING' }),
    'planning',
  );
});

test('accepted route request enters loading and route success enters results', () => {
  const loading = transitionMobileSurface('planning', { type: 'REQUEST_ROUTES' });
  assert.equal(loading, 'loading');
  assert.equal(transitionMobileSurface(loading, { type: 'ROUTES_READY' }), 'results');
});

test('assistant is secondary and closes back to explore', () => {
  const assistant = transitionMobileSurface('explore', { type: 'OPEN_ASSISTANT' });
  assert.equal(assistant, 'assistant');
  assert.equal(transitionMobileSurface(assistant, { type: 'CLOSE' }), 'explore');
});

test('starting navigation always forces the compact navigation surface', () => {
  assert.equal(
    transitionMobileSurface('results', { type: 'START_NAVIGATION' }),
    'navigation',
  );
  assert.equal(presentationForSurface('navigation'), 'compact');
});

test('route failure returns to planning without discarding endpoints', () => {
  assert.equal(
    transitionMobileSurface('loading', { type: 'ROUTES_FAILED' }),
    'planning',
  );
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
npx tsx --test tests/mobileSurface.test.ts
```

Expected: FAIL because `src/lib/mobileSurface.ts` does not exist.

- [ ] **Step 3: Implement the pure reducer**

```ts
export type MobileSurface =
  | 'explore'
  | 'planning'
  | 'loading'
  | 'results'
  | 'assistant'
  | 'navigation';

export type SheetPresentation = 'compact' | 'medium' | 'expanded';

export type MobileSurfaceEvent =
  | { type: 'OPEN_PLANNING' }
  | { type: 'OPEN_ASSISTANT' }
  | { type: 'REQUEST_ROUTES' }
  | { type: 'ROUTES_READY' }
  | { type: 'ROUTES_FAILED' }
  | { type: 'START_NAVIGATION' }
  | { type: 'END_NAVIGATION' }
  | { type: 'SHOW_RESULTS' }
  | { type: 'CLOSE' };

export function transitionMobileSurface(
  state: MobileSurface,
  event: MobileSurfaceEvent,
): MobileSurface {
  switch (event.type) {
    case 'OPEN_PLANNING': return 'planning';
    case 'OPEN_ASSISTANT': return 'assistant';
    case 'REQUEST_ROUTES': return 'loading';
    case 'ROUTES_READY':
    case 'SHOW_RESULTS': return 'results';
    case 'ROUTES_FAILED': return 'planning';
    case 'START_NAVIGATION': return 'navigation';
    case 'END_NAVIGATION':
    case 'CLOSE': return 'explore';
    default: return state;
  }
}

export function presentationForSurface(surface: MobileSurface): SheetPresentation {
  if (surface === 'explore' || surface === 'navigation') return 'compact';
  if (surface === 'results') return 'medium';
  return 'expanded';
}
```

Implement `useMobileSurface` with `useReducer(transitionMobileSurface, initial)`.

- [ ] **Step 4: Run RED-to-GREEN verification**

Run:

```powershell
npx tsx --test tests/mobileSurface.test.ts
npm run lint
```

Expected: all reducer tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/mobileSurface.ts src/hooks/useMobileSurface.ts tests/mobileSurface.test.ts
git commit -m "feat: add mobile surface state model"
```

---

### Task 2: Accessible Mobile Shell

**Files:**
- Create: `src/components/MobileBottomSheet.tsx`
- Create: `src/components/MobileExploreActions.tsx`
- Test: `tests/mobileShell.test.tsx`

**Interfaces:**
- Consumes `SheetPresentation` from `src/lib/mobileSurface.ts`.
- Produces:
  - `MobileBottomSheet({ presentation, title, onPresentationChange, children })`
  - `MobileExploreActions({ onPlanTrip, onAskMetroBot })`

- [ ] **Step 1: Write failing server-render tests**

```tsx
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MobileBottomSheet } from '../src/components/MobileBottomSheet';
import { MobileExploreActions } from '../src/components/MobileExploreActions';

test('explore actions expose one primary trip action and a secondary assistant action', () => {
  const html = renderToStaticMarkup(
    <MobileExploreActions onPlanTrip={() => {}} onAskMetroBot={() => {}} />,
  );
  assert.match(html, />Planear un viaje</);
  assert.match(html, />Pregúntale a MetroBot</);
  assert.match(html, /aria-label="Planear un viaje"/);
});

test('bottom sheet exposes its title and expansion state', () => {
  const html = renderToStaticMarkup(
    <MobileBottomSheet
      presentation="compact"
      title="Planifica tu viaje"
      onPresentationChange={() => {}}
    >
      <p>Contenido</p>
    </MobileBottomSheet>,
  );
  assert.match(html, /aria-labelledby="mobile-sheet-title"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />Planifica tu viaje</);
});
```

- [ ] **Step 2: Run and confirm RED**

```powershell
npx tsx --test tests/mobileShell.test.tsx
```

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement the shell**

Implement a fixed mobile sheet with:

- `role="region"` and `aria-labelledby="mobile-sheet-title"`;
- compact `112px`, medium `min(68dvh, 640px)`, expanded `calc(100dvh - env(safe-area-inset-top) - 12px)`;
- rounded top corners, restrained elevation, safe-bottom padding;
- one 48 px handle button with `aria-expanded`;
- no independent semantic state inside the component;
- desktop side-panel classes behind `lg:`.

Implement `MobileExploreActions` with the exact two labels from the test and a 48 px primary destination button.

- [ ] **Step 4: Run GREEN checks**

```powershell
npx tsx --test tests/mobileShell.test.tsx
npm run lint
```

Expected: both tests and TypeScript pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/MobileBottomSheet.tsx src/components/MobileExploreActions.tsx tests/mobileShell.test.tsx
git commit -m "feat: add accessible mobile map shell"
```

---

### Task 3: Focused Trip Planner and Map Selection Bridge

**Files:**
- Create: `src/components/TripPlannerPanel.tsx`
- Create: `src/components/Map/MapSelectionController.tsx`
- Modify: `src/components/Map/MapComponent.tsx`
- Test: `tests/tripPlanner.test.tsx`

**Interfaces:**
- Produces:
  - `type PlaceValue = { lat: number; lng: number; name: string }`
  - `TripPlannerPanel({ origin, destination, busesEnabled, isLoading, onOriginChange, onDestinationChange, onBusesEnabledChange, onRequestMapSelection, onSubmit, onClose })`
  - `MapSelectionController({ mode, onSelect })`
- `MapComponent` consumes `mapSelectionMode: 'origin' | 'destination' | null` and `onMapPlaceSelected`.

- [ ] **Step 1: Write failing planner contract tests**

```tsx
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TripPlannerPanel } from '../src/components/TripPlannerPanel';

const baseProps = {
  origin: null,
  destination: null,
  busesEnabled: true,
  isLoading: false,
  onOriginChange: () => {},
  onDestinationChange: () => {},
  onBusesEnabledChange: () => {},
  onRequestMapSelection: () => {},
  onSubmit: () => {},
  onClose: () => {},
};

test('planner labels origin and destination and offers current location', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} />);
  assert.match(html, /Origen/);
  assert.match(html, /Destino/);
  assert.match(html, /Usar mi ubicación/);
  assert.match(html, /Seleccionar en el mapa/);
});

test('route action is disabled until both endpoints are valid', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} />);
  assert.match(html, /<button[^>]*disabled[^>]*>[^<]*Ver rutas/);
});

test('articulated buses are disclosed under advanced options', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} />);
  assert.match(html, /Opciones de viaje/);
  assert.match(html, /Incluir buses articulados/);
  assert.doesNotMatch(html, />ON</);
  assert.doesNotMatch(html, />OFF</);
});
```

- [ ] **Step 2: Run and confirm RED**

```powershell
npx tsx --test tests/tripPlanner.test.tsx
```

Expected: FAIL because `TripPlannerPanel` does not exist.

- [ ] **Step 3: Transfer search behavior**

Move the geocoding, debounce, result selection, current-location, swap, and favorite logic from `MapSearch.tsx` into `TripPlannerPanel.tsx`. Keep external calls unchanged:

- Google Places when available;
- Nominatim fallback constrained to Colombia/Medellín;
- reverse geocoding for current location and map selection.

Use explicit labels, `role="listbox"`/`role="option"` for search results, a polite loading region, and 44 px controls.

- [ ] **Step 4: Add the map selection controller**

`MapSelectionController` uses `useMapEvents` and reverse geocoding. When active, one map tap calls:

```ts
onSelect(mode, { lat, lng, name });
```

Then it returns to inactive mode. Location errors preserve the selected coordinates with the fallback name “Punto seleccionado”.

- [ ] **Step 5: Wire the controller into `MapComponent`**

Remove the embedded `MapSearch` render from the map. Add `MapSelectionController` and new props. Preserve markers, polylines, navigation following, station layers, and tile behavior.

- [ ] **Step 6: Run GREEN and regression checks**

```powershell
npx tsx --test tests/tripPlanner.test.tsx
npm run lint
npm run build
```

Expected: planner tests, TypeScript, and production build pass.

- [ ] **Step 7: Commit**

```powershell
git add src/components/TripPlannerPanel.tsx src/components/Map/MapSelectionController.tsx src/components/Map/MapComponent.tsx tests/tripPlanner.test.tsx
git commit -m "feat: add focused mobile trip planner"
```

---

### Task 4: Assistant as a Secondary Surface

**Files:**
- Create: `src/components/AssistantPanel.tsx`
- Test: `tests/mobile_copy.test.tsx`

**Interfaces:**
- Produces `AssistantPanel({ messages, query, isLoading, showSupport, onQueryChange, onSubmit, onToggleSupport, onClose })`.
- Uses existing `SupportChannels`, `TariffInfo`, and `SystemStatus`.

- [ ] **Step 1: Write failing copy and hierarchy tests**

```tsx
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantPanel } from '../src/components/AssistantPanel';

test('assistant uses professional Spanish and a contextual welcome', () => {
  const html = renderToStaticMarkup(
    <AssistantPanel
      messages={[]}
      query=""
      isLoading={false}
      showSupport={false}
      onQueryChange={() => {}}
      onSubmit={() => {}}
      onToggleSupport={() => {}}
      onClose={() => {}}
    />,
  );
  assert.match(html, /¡Hola! Soy MetroBot/);
  assert.match(html, /Pregúntale a MetroBot/);
  assert.doesNotMatch(html, /Que mas!/);
  assert.doesNotMatch(html, /Buses articulados ON/);
});
```

- [ ] **Step 2: Run and confirm RED**

```powershell
npx tsx --test tests/mobile_copy.test.tsx
```

Expected: FAIL because `AssistantPanel` does not exist.

- [ ] **Step 3: Implement assistant presentation**

Include:

- compact header with close and “Información del sistema” actions;
- contextual empty-state welcome and three short suggested prompts;
- existing message log with `role="log"`;
- 16 px composer and 48 px send action;
- safe-area/keyboard padding;
- no persistent articulated-bus toggle;
- support/status content disclosed only after explicit action.

- [ ] **Step 4: Run GREEN**

```powershell
npx tsx --test tests/mobile_copy.test.tsx
npm run lint
```

Expected: test and TypeScript pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/AssistantPanel.tsx tests/mobile_copy.test.tsx
git commit -m "feat: make MetroBot a secondary mobile surface"
```

---

### Task 5: Integrate the Map-First App Flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/QuickPicksBar.tsx`
- Modify: `src/index.css`
- Modify: `tests/mobileSurface.test.ts`

**Interfaces:**
- Consumes all components and reducer APIs from Tasks 1–4.
- `App.tsx` remains owner of route data, message data, Gemini calls, navigation state, theme, weather, and persisted preferences.

- [ ] **Step 1: Extend failing transition tests for real app events**

Add:

```ts
test('closing results returns to explore and keeps route availability external', () => {
  assert.equal(
    transitionMobileSurface('results', { type: 'CLOSE' }),
    'explore',
  );
});

test('ending navigation returns to explore', () => {
  assert.equal(
    transitionMobileSurface('navigation', { type: 'END_NAVIGATION' }),
    'explore',
  );
});
```

Run and confirm any missing event behavior fails before modifying production state handling.

- [ ] **Step 2: Replace duplicate sheet state in `App.tsx`**

Remove:

- `sheetHeight`;
- `heightClasses`;
- `SNAP_POINTS`;
- `draggingFrac`;
- `sheetDragRef`;
- touch handlers;
- `sheetHeightClass`;
- the second `useSheetDrag` state source.

Add one `useMobileSurface()` instance. Route request dispatches `REQUEST_ROUTES`; successful route callback dispatches `ROUTES_READY`; failures dispatch `ROUTES_FAILED`; navigation start dispatches `START_NAVIGATION`; stop/arrival dispatches `END_NAVIGATION`.

- [ ] **Step 3: Compose semantic surfaces**

Render:

- `MobileExploreActions` for `explore`;
- `TripPlannerPanel` for `planning` and `loading`;
- route cards for `results`;
- `AssistantPanel` for `assistant`;
- compact navigation information for `navigation`.

The map stays mounted across all states.

- [ ] **Step 4: Preserve both route entry paths**

Map planner route requests continue through `handleSearchRoute`. Assistant route responses continue through `processUserQuery`, but both finish in the same Results State and use the same route card list.

- [ ] **Step 5: Refine mobile favorites**

Make `QuickPicksBar` a single horizontally scrollable row below the destination control, with 44 px buttons and no multi-row overlay. Hide it in planning, assistant, results-expanded, and navigation states.

- [ ] **Step 6: Add layout CSS**

Add:

```css
.mobile-app-shell {
  min-height: 100dvh;
  height: 100dvh;
  overflow: clip;
}

.mobile-sheet-scroll {
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

@supports (height: 100svh) {
  .mobile-app-shell {
    min-height: 100svh;
    height: 100svh;
  }
}
```

Preserve 16 px inputs, safe-area helpers, reduced motion, and high-contrast rules.

- [ ] **Step 7: Run integration checks**

```powershell
npx tsx --test tests/mobileSurface.test.ts tests/mobileShell.test.tsx tests/tripPlanner.test.tsx tests/mobile_copy.test.tsx
npm run lint
npm run build
```

Expected: all new tests, TypeScript, and build pass.

- [ ] **Step 8: Commit**

```powershell
git add src/App.tsx src/components/QuickPicksBar.tsx src/index.css tests/mobileSurface.test.ts
git commit -m "feat: integrate map-first mobile UX"
```

---

### Task 6: Route Result Hierarchy and Map Control Accessibility

**Files:**
- Modify: `src/components/RouteCards/RouteCard.tsx`
- Modify: `src/components/Map/MapComponent.tsx`
- Modify: `src/components/Map/LocateControl.tsx`
- Modify: `src/components/Map/NavigationOverlay.tsx`
- Modify: `tests/mobileShell.test.tsx`

**Interfaces:**
- Route card exposes a real selection action and a separate start-navigation action.
- Map controls expose unique accessible names and use state-aware placement.

- [ ] **Step 1: Add failing semantic assertions**

Add a server-render test using a minimal literal `RouteOption` fixture:

```tsx
test('a route result exposes selection and navigation as separate controls', () => {
  const html = renderToStaticMarkup(
    <RouteCard
      route={routeFixture}
      isSelected={false}
      onSelect={() => {}}
      onStartNav={() => {}}
    />,
  );
  assert.match(html, /aria-label="Seleccionar ruta/);
  assert.match(html, />Iniciar navegación</);
});
```

Expected RED: `RouteCardProps` lacks `onSelect` and copy lacks the accent.

- [ ] **Step 2: Compact the route card**

- Replace the decorative 96 px vehicle banner with a compact mode icon row.
- Keep duration, modes/transfers, cost, walking, and validation above detailed steps.
- Add `onSelect` to a real button; do not use a clickable wrapper `div`.
- Keep “Iniciar navegación” as the strongest card action.
- Correct “navegación”, “catálogo”, “Medellín”, and “más”.

- [ ] **Step 3: Audit map controls**

- Add unique `aria-label`/`title` values to custom controls.
- Hide nonessential controls during navigation.
- Ensure locate, layer/theme, close, overview, and WhatsApp controls do not overlap the compact sheet or destination action.
- Use at least 44 px targets.
- Interactive station markers must use station names as labels where Leaflet supports them.

- [ ] **Step 4: Run GREEN and regression checks**

```powershell
npx tsx --test tests/mobileShell.test.tsx
npm run lint
npm run build
```

Expected: semantic test, TypeScript, and build pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/RouteCards/RouteCard.tsx src/components/Map/MapComponent.tsx src/components/Map/LocateControl.tsx src/components/Map/NavigationOverlay.tsx tests/mobileShell.test.tsx
git commit -m "feat: refine mobile routes and map controls"
```

---

### Task 7: Retire Legacy UI and Verify the Complete Experience

**Files:**
- Delete: `src/components/Map/MapSearch.tsx` after behavior parity is verified
- Modify: `docs/CHANGELOG.md`
- Modify: plan checkboxes in this document as tasks complete

**Interfaces:**
- No production file imports test helpers.
- No production file retains the legacy chat-first or duplicate-sheet implementation.

- [x] **Step 1: Confirm the legacy component is unused**

```powershell
rg -n "MapSearch|sheetHeight|draggingFrac|SNAP_POINTS|Buses articulados.*ON|Que mas!" src
```

Expected before deletion: only the legacy file may contain `MapSearch`; no live import or duplicate-sheet tokens remain.

- [x] **Step 2: Delete the unused legacy component**

Delete `src/components/Map/MapSearch.tsx` only after `rg` proves no imports remain.

- [x] **Step 3: Run the complete automated suite**

```powershell
$tests = Get-ChildItem tests -Filter 'test_*.mjs' | Sort-Object Name
foreach ($test in $tests) {
  node $test.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
node tests/test_enrichment.cjs
npx tsx --test tests/mobileSurface.test.ts tests/mobileShell.test.tsx tests/tripPlanner.test.tsx tests/mobile_copy.test.tsx
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0.

- [x] **Step 4: Validate mobile viewports in the browser**

At 360 × 800, 390 × 844, and 430 × 932:

- capture Explore, Planning, Results, Assistant, and Navigation states where fixture data allows;
- confirm no horizontal overflow via `document.documentElement.scrollWidth <= window.innerWidth`;
- measure every visible primary button and verify width and height are at least 44 px;
- confirm “¿A dónde vas?” is not truncated;
- confirm the initial map owns the majority of usable height;
- confirm route cards and navigation cues do not overlap;
- repeat Explore and Planning in dark mode;
- inspect console errors.

- [x] **Step 5: Correct any visual defect through TDD**

For behavioral defects, add a failing test before editing production code. For pure CSS/layout defects, record the failing viewport and screenshot, apply the minimal CSS change, then recapture the same state and viewport.

- [x] **Step 6: Update changelog and commit**

Document:

- map-first initial state;
- unified mobile surface model;
- focused planner;
- secondary assistant;
- compact route results;
- accessibility and mobile viewport validation.

```powershell
git add src docs tests
git commit -m "feat: complete professional mobile map-first UX"
```

---

## Plan Self-Review

- Every requirement in the approved specification maps to Tasks 1–7.
- Routing, Gemini, status, public data, and navigation logic remain out of refactor scope.
- The state/type names are consistent across reducer, hook, shell, and integration tasks.
- Component tests render real production components; they do not assert against mocks.
- New behavioral production code has a failing test before implementation.
- CSS-only corrections use repeatable viewport evidence because they have no meaningful unit-test boundary.
- The plan contains no unresolved placeholders or deferred implementation decisions.
