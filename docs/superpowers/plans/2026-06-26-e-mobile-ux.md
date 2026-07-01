# Mobile UX Pro Implementation Plan (Plan E)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make MetroBOT feel native-grade on a 360-414 px mobile viewport: no rogue zoom, no clipped buttons, sheet that drags smoothly, full keyboard/screen-reader parity, and respects the OS reduced-motion preference.

**Architecture:**
- **A Viewport + zoom:** strip the `maximum-scale=5.0` that was triggering the rogue zoom on iOS. Replace with `maximum-scale=1.0` (pinch-zoom preserved via not setting `user-scalable=no`).
- **B Sheet with drag:** replace the boolean `sheetHeight` with a `useSheetDrag(snapPoints, currentSnap, setSnap)` hook that listens to pointer events on the handle and snaps to min/mid/max with velocity. Pure logic in `_sheet_drag_impl.mjs` is unit-tested.
- **C Reduced-motion gate:** `usePrefersReducedMotion()` hook + `motion/react` config that disables transitions when the user prefers reduced motion; CSS media query as a hard fallback.
- **D Accessibility (a11y):** ARIA roles/aria-labels/aria-live across chat, sheet handle, RouteCards, QuickPicksBar; skip-link to map; focus return after closing the sheet; color-independent validation badges (icon + text); `prefers-contrast: more` stylesheet override.

**Tech Stack:** Vite + React 19 + TypeScript, `motion/react` (existing). No new runtime deps. ~250 LoC of new code; ~80 LoC of CSS.

---

## File Structure

- Modify: `index.html` (viewport meta).
- Modify: `src/index.css` (reduced-motion + high-contrast media queries).
- Modify: `src/App.tsx` (sheet drag, focus management, skip link target).
- Modify: `src/components/QuickPicksBar.tsx` (a11y).
- Modify: `src/components/Map/MapSearch.tsx` (haptic on favorite toggle).
- Modify: `src/components/RouteCards/RouteCard.tsx` (a11y: role/aria-label, evidence badge).
- Modify: `src/components/Map/NavigationOverlay.tsx` (aria-live on cues).
- New: `src/hooks/useSheetDrag.ts` (pointer-events hook around `snapPoints`).
- New: `src/hooks/usePrefersReducedMotion.ts`.
- New: `src/components/SkipLink.tsx`.
- New: `tests/_sheet_drag_impl.mjs`, `tests/test_sheet_drag.mjs` (12+ asserts).
- New: `tests/_reduced_motion_impl.mjs`, `tests/test_reduced_motion.mjs` (6+ asserts).
- Modify: `docs/CHANGELOG.md`.

---

## Tasks

### Task 1: Sheet drag -- pure logic (RED -> GREEN)

**Files:**
- tests/_sheet_drag_impl.mjs (new)
- tests/test_sheet_drag.mjs (new)

- [ ] **Step 1:** Mirror the pure logic in `_sheet_drag_impl.mjs`. Expose `snapPoints` (e.g. `[72, 320, 720]`), `nextSnap(currentSnap, snapPoints, deltaY, velocityY)`.
- [ ]   - If `|deltaY| < 4` AND `|velocityY| < 0.3`, return `currentSnap` (no snap).
- [ ]   - Snap UP (next-higher index) if `deltaY < -8` OR `velocityY < -0.3`.
- [ ]   - Snap DOWN (next-lower index) if `deltaY > 8` OR `velocityY > 0.3`.
- [ ]   - Clamp the index to `[0, snapPoints.length-1]`.
- [ ] **Step 2:** Tests with at least 12 asserts:
- [ ]   - drag UP 200px from `mid` -> `max`.
- [ ]   - drag DOWN 200px from `max` -> `mid`.
- [ ]   - drag DOWN 600px from `mid` -> `min`.
- [ ]   - small drag (<4px) -> same snap.
- [ ]   - fast flick DOWN (velocity 0.8) from `mid` -> `min`.
- [ ]   - fast flick UP (velocity -0.8) from `min` -> `max`.
- [ ]   - at `min`, drag DOWN -> stays at `min`.
- [ ]   - at `max`, drag UP -> stays at `max`.
- [ ]   - clamp applied at boundaries.
- [ ]   - no-skip rule: going up from min with big delta -> still ends at mid (one step at a time).
- [ ]   - mixed velocity+delta both negative -> snaps up.
- [ ]   - empty snapPoints -> returns 0.
- [ ] **Step 3:** Run, expect GREEN. Commit.

### Task 2: `useSheetDrag` hook

**Files:**
- src/hooks/useSheetDrag.ts (new)

- [ ] **Step 1:** React hook: `useSheetDrag(handleRef, snapPoints, initial) -> { currentSnap, setSnap, onPointerDown, onPointerMove, onPointerUp }`.
- [ ] **Step 2:** Listens to pointer events on `handleRef`, tracks `startY`, `currentY`, `startMs`. On pointer-up calls `nextSnap(...)` from the impl.
- [ ] **Step 3:** Uses `setPointerCapture` so dragging off the handle still works. Removes capture on pointerup/cancel.
- [ ] **Step 4:** Triggers `navigator.vibrate?.(10)` on snap change (best-effort).
- [ ] **Step 5:** SSR-safe (`typeof window === "undefined"` early return).
- [ ] **Step 6:** Lint. Commit.

### Task 3: Wire `useSheetDrag` into App.tsx

**Files:**
- src/App.tsx

- [ ] **Step 1:** Remove `const [sheetHeight, setSheetHeight] = useState<"min"|"mid"|"max">("mid")` and any consumer.
- [ ] **Step 2:** Add `const sheetHandleRef = useRef<HTMLButtonElement>(null)` and `const { currentSnap, setSnap } = useSheetDrag(sheetHandleRef, [72, 320, 720], 1)`.
- [ ] **Step 3:** Snap -> CSS classes: snap 0 -> `h-[72px]`; snap 1 -> `h-[min(58dvh,560px)]`; snap 2 -> `h-[92dvh]`.
- [ ] **Step 4:** Replace the inner drag-handle `<div>` with a `<button ref={sheetHandleRef}>` for accessibility (will get pointer events from the hook).
- [ ] **Step 5:** Lint. Commit.

### Task 4: Reduced-motion -- test + impl

**Files:**
- tests/_reduced_motion_impl.mjs (new)
- tests/test_reduced_motion.mjs (new)
- src/hooks/usePrefersReducedMotion.ts (new)

- [ ] **Step 1:** Mirror `_reduced_motion_impl.mjs`: exports `matchesReducedMotion(mediaQueryList | null | undefined) -> boolean`. Returns false if input is null/undefined or `.matches === false`.
- [ ] **Step 2:** Tests with at least 6 asserts: null -> false; undefined -> false; `{matches:true}` -> true; `{matches:false}` -> false; truthy non-object -> false; object that throws on `.matches` access -> false.
- [ ] **Step 3:** Implement the hook in TS: uses `window.matchMedia("(prefers-reduced-motion: reduce)")`; subscribes to changes via `addEventListener("change", ...)`; SSR-safe (`typeof window === "undefined"` guard); returns boolean state.
- [ ] **Step 4:** Lint. Commit.

### Task 5: Apply reduced-motion in App.tsx + index.css

**Files:**
- src/App.tsx
- src/index.css

- [ ] **Step 1:** In `index.css`, append at the end:
- [ ]     ```css
- [ ]     @media (prefers-reduced-motion: reduce) {
- [ ]       *, *::before, *::after {
- [ ]         animation-duration: 0.001ms !important;
- [ ]         animation-iteration-count: 1 !important;
- [ ]         transition-duration: 0.001ms !important;
- [ ]         scroll-behavior: auto !important;
- [ ]       }
- [ ]     }
- [ ]     @media (prefers-contrast: more) {
- [ ]       .border-border\/30 { border-width: 2px !important; }
- [ ]       button:focus-visible { outline: 3px solid currentColor !important; outline-offset: 2px !important; }
- [ ]     }
- [ ]     ```
- [ ] **Step 2:** In `App.tsx`, wrap `motion.div`/`AnimatePresence` with `usePrefersReducedMotion()` -- when true, swap `motion.div` for plain `div` with the same className. Use a tiny helper `const M = reduced ? "div" : motion.div`.
- [ ] **Step 3:** Lint. Commit.

### Task 6: SkipLink component

**Files:**
- src/components/SkipLink.tsx (new)
- src/App.tsx

- [ ] **Step 1:** Component: anchor with `href="#map-region"`, `sr-only` class until focused. Renders "Saltar al mapa".
- [ ] **Step 2:** In `App.tsx`, add `id="map-region"` to the map wrapper and `<SkipLink />` as the first child of the root.
- [ ] **Step 3:** Lint. Commit.

### Task 7: a11y across components

**Files:**
- src/components/RouteCards/RouteCard.tsx
- src/components/QuickPicksBar.tsx
- src/components/Map/MapSearch.tsx
- src/components/Map/NavigationOverlay.tsx
- src/App.tsx

- [ ] **Step 1:** `RouteCard`: wrap root in `<section role="region" aria-label={`Ruta ${index+1}: ${summary}`}>`.
- [ ] **Step 2:** `QuickPicksBar`: root `<nav aria-label="Favoritos y busquedas recientes">`. Each chip `<button aria-label={`Ir a ${name}`}>`.
- [ ] **Step 3:** `MapSearch`: the favorite star `<button aria-label={isFavorite ? `Quitar ${name} de favoritos` : `Guardar ${name} en favoritos`}>`. On click, call `navigator.vibrate?.(15)` if available.
- [ ] **Step 4:** `NavigationOverlay`: outer `<div role="status" aria-live="polite" aria-atomic="true">` so screen readers announce each cue change.
- [ ] **Step 5:** `App.tsx`: chat list `<div role="log" aria-live="polite" aria-relevant="additions">`. Sheet handle `<button aria-expanded={currentSnap > 0} aria-controls="chat-sheet" aria-label="Expandir panel">`.
- [ ] **Step 6:** Focus management: when sheet opens to `max`, capture `document.activeElement` before snap, then after snap call `firstRouteCardRef.current?.focus()`. When sheet collapses to `min`, call `previousActiveElement?.focus()`.
- [ ] **Step 7:** Lint. Commit.

### Task 8: index.html viewport fix

**Files:**
- index.html

- [ ] **Step 1:** Replace `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0">` with `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0">`.
- [ ] **Step 2:** Justification: the previous `maximum-scale=5.0` was the source of the rogue zoom the user reported. Pinch-zoom is preserved (we are not setting `user-scalable=no`).
- [ ] **Step 3:** Lint + build to ensure nothing breaks. Commit.

### Task 9: Full verification

**Files:**

- [ ] **Step 1:** `node tests/test_sheet_drag.mjs` -> 12+/12+ GREEN.
- [ ] **Step 2:** `node tests/test_reduced_motion.mjs` -> 6+/6+ GREEN.
- [ ] **Step 3:** All 12 prior test files still GREEN.
- [ ] **Step 4:** `npm run lint` exit 0.
- [ ] **Step 5:** `npm run build` exit 0.
- [ ] **Step 6:** Bundle markers: verify bundle contains `useSheetDrag`, `prefers-reduced-motion`, `role="log"`, `aria-live`, `Saltar al mapa`.
- [ ] **Step 7:** Update CHANGELOG with section `## 2026-06-26 -- Plan E: Mobile UX pro`.
- [ ] **Step 8:** Commit.

---

## Notes / YAGNI

- Do NOT add framer-motion or react-spring. The drag hook is ~80 LoC with pointer events.
- Do NOT cache the reduced-motion state in localStorage. The OS preference is live.
- Do NOT change colors of badges -- only add icons + text so they remain readable in dark mode AND when CSS is stripped.
- Skip link MUST be the first focusable element on the page (no exceptions).
- Sheet drag uses `setPointerCapture` so dragging off the handle still works -- this is why we cannot use plain `onTouchMove`.
- `prefers-contrast: more` overrides are intentionally minimal -- extending them per-component is future work.
