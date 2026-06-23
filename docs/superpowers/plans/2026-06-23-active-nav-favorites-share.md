# Active Navigation + Favorites/Recent/Share Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing-but-unused `useNavigation` + `NavigationOverlay` so users can hit "Iniciar navegación" on any RouteCard and get turn-by-turn guidance (TTS in Spanish, vibration, follow-user). Add favorites, recent searches, and a share button that work offline via localStorage.

**Architecture:**

- A. Pull `useNavigation` into `App.tsx`. When the user taps "Iniciar navegación" on the selected `RouteCard`, call `nav.start(route)`. Mount `<NavigationOverlay nav={nav} />` above the map. Pipe `nav.pos` and `nav.heading` into `MapComponent` props so the user marker and `followUser` flag activate. Add `navigator.vibrate` on cue changes. TTS is enabled by default; user can mute.
- B. Two localStorage-backed hooks: `useFavorites` (max 50) and `useRecentSearches` (max 10). A `<ShareButton>` uses `navigator.share` with a clipboard fallback. Mount a new `RecentsPanel` inside `MapSearch` that renders both lists.

**Tech Stack:** Vite + React 19 + TypeScript, `@google/genai` (existing), Web Speech API for TTS, Web Share API for share. No new runtime deps.

---

## File Structure

- Modify: `src/App.tsx` (use nav hook, mount NavigationOverlay, pass user position to map).
- Modify: `src/components/RouteCards/RouteCard.tsx` (add Start Nav button + Share button + validation badge tooltip stays).
- Modify: `src/components/Map/MapComponent.tsx` (no schema change; userPosition/userHeading/followUser already supported).
- Modify: `src/components/Map/MapSearch.tsx` (mount RecentsPanel + add "Save as favorite" on the picked result).
- New: `src/hooks/useFavorites.ts` (localStorage-backed list, add/remove/has).
- New: `src/hooks/useRecentSearches.ts` (localStorage-backed MRU dedup, cap 10).
- New: `src/components/RecentsPanel.tsx` (chips for favorites + recent searches).
- New: `src/components/ShareButton.tsx` (uses navigator.share + clipboard fallback).
- New: `tests/test_favorites.mjs` + `tests/test_recents.mjs` + `tests/test_share.mjs` (Node, no framework).
- New: `src/lib/share.ts` (pure helper: buildShareText + tryShare, easily testable in Node).

---

### Task 1: Write failing tests for hooks + share helper (TDD red)

**Files:**
- Create: `tests/_favorites_impl.mjs` (mirror of `useFavorites` logic), `tests/test_favorites.mjs`.
- Create: `tests/_recents_impl.mjs`, `tests/test_recents.mjs`.
- Create: `tests/_share_impl.mjs`, `tests/test_share.mjs`.

- [ ] **Step 1: Mirror `useFavorites` core logic in `_favorites_impl.mjs`** (pure functions over localStorage: `loadFavorites()`, `saveFavorites()`, `addFavorite(item)`, `removeFavorite(id)`, `isFavorite(id)`). The React hook is a thin wrapper.

- [ ] **Step 2: Tests for favorites (8+ asserts):** empty state, add new, add duplicate no-ops, remove by id, cap at 50 (try to add 60, expect 50 most recent), isFavorite, localStorage failure fallback (mock `localStorage.setItem` to throw, expect the function to return without crashing), corrupt JSON returns empty array.

- [ ] **Step 3: Mirror `useRecentSearches` logic in `_recents_impl.mjs`** (`loadRecents`, `pushRecent(query)`, max 10, dedup by query string, MRU order).

- [ ] **Step 4: Tests for recents (6+ asserts):** empty, push adds, push of same query moves to top, push beyond cap evicts oldest, localStorage failure fallback, corrupt JSON empty.

- [ ] **Step 5: Mirror `share` helper in `_share_impl.mjs`** (`buildShareText(route, originName, destName)` returns a single-line WhatsApp-friendly text with the route summary, fallback when station names missing; `tryShare` uses an injectable share API so tests can stub navigator.share).

- [ ] **Step 6: Tests for share (5+ asserts):** buildShareText includes origin/dest names + duration + cost + transfers, buildShareText handles missing station names gracefully, tryShare returns 'shared' when navigator.share succeeds, returns 'copied' when navigator.share throws and clipboard succeeds, returns 'failed' when both fail.

- [ ] **Step 7: Run all three test files; expect each to fail with `Cannot find module` or similar** (RED).

---

### Task 2: Implement share helper (GREEN)

**Files:** `src/lib/share.ts`, `tests/_share_impl.mjs`.

- [ ] **Step 1: Implement `buildShareText(route, originName, destName)`** as a pure function that returns a single-line summary like: `"Ruta MetroBOT: <origin> -> <dest> (~<duration> min, $<cost>, <transfers> transbordos)"`. Fallback to `?` for missing fields.

- [ ] **Step 2: Implement `tryShare(text, title)`** that:
  - Checks `typeof navigator.share === 'function'`. If yes, calls it; on success returns `'shared'`.
  - On `navigator.share` rejection OR if not available, falls back to `navigator.clipboard.writeText(text)`. On success returns `'copied'`.
  - If clipboard also unavailable OR throws, returns `'failed'`.
  - The function must NEVER throw; it must always return one of `'shared' | 'copied' | 'failed'`.

- [ ] **Step 3: Run `node tests/test_share.mjs`; must print `ALL TESTS PASS`.**

---

### Task 3: Implement favorites hook (GREEN)

**Files:** `src/hooks/useFavorites.ts`, `tests/_favorites_impl.mjs`.

- [ ] **Step 1: Mirror in `_favorites_impl.mjs`**: same functions as the hook but operating on a `storage` object passed in (defaults to `globalThis.localStorage`). This makes the tests deterministic.

- [ ] **Step 2: Implement `useFavorites`** as a thin React hook that returns `{ favorites, add, remove, has }`. Persist to `localStorage` under key `metrobot.favorites.v1`. Cap at 50. Tolerate quota errors and corrupt JSON.

- [ ] **Step 3: Run `node tests/test_favorites.mjs`; must pass all asserts.**

---

### Task 4: Implement recents hook (GREEN)

**Files:** `src/hooks/useRecentSearches.ts`, `tests/_recents_impl.mjs`.

- [ ] **Step 1: Mirror in `_recents_impl.mjs`**.

- [ ] **Step 2: Implement `useRecentSearches`** that returns `{ recents, push }`. Persist to `metrobot.history.v1`. Cap at 10. Dedup by query string. Most recent first.

- [ ] **Step 3: Run `node tests/test_recents.mjs`; must pass.**

---

### Task 5: Wire active navigation into App.tsx

**Files:** `src/App.tsx`, `src/components/RouteCards/RouteCard.tsx`.

- [ ] **Step 1: Add the hook + state** in App.tsx:
  ```ts
  import { useNavigation } from './hooks/useNavigation';
  import { NavigationOverlay } from './components/Map/NavigationOverlay';
  const nav = useNavigation();
  ```
  No state changes needed; the hook owns its state.

- [ ] **Step 2: Pass `userPosition={nav.pos}`, `userHeading={nav.heading}`, `followUser={nav.state === 'navigating' || nav.state === 'at_station'}`** to `<MapComponent>`.

- [ ] **Step 3: Mount `<NavigationOverlay nav={nav} />`** above `<MapComponent>`. Position absolute so it overlays the top of the map.

- [ ] **Step 4: Add a `hapticOnCueChange` `useEffect`**:
  ```ts
  const lastCueRef = useRef<NavigationContext['cue']>(null);
  useEffect(() => {
    if (nav.cue && nav.cue !== lastCueRef.current && 'vibrate' in navigator) {
      try { navigator.vibrate([120, 60, 120]); } catch (e) {}
    }
    lastCueRef.current = nav.cue;
  }, [nav.cue]);
  ```

- [ ] **Step 5: Extend `RouteOption` with optional `onStartNav?: () => void` prop on `RouteCard`** so the card can call `nav.start(route)` with the right argument. Render an "Iniciar navegación" button at the bottom of the card when `nav.state === 'idle'` AND `onStartNav` is provided AND the route has at least one walk segment.

- [ ] **Step 6: Update the `NavigationOverlay` to read `nav.state === 'arrived'` and auto-close after 6 seconds** (set a timeout that calls `nav.stop()`).

- [ ] **Step 7: Lint + build must pass.**

---

### Task 6: Wire favorites + recents + share UI

**Files:** `src/components/Map/MapSearch.tsx`, `src/components/RecentsPanel.tsx`, `src/components/ShareButton.tsx`, `src/components/RouteCards/RouteCard.tsx`.

- [ ] **Step 1: Build `<ShareButton route>`**:
  - Calls `buildShareText` with the route + (if known) origin/dest names from App state.
  - Calls `tryShare`; on `'copied'` shows a toast "Copiado al portapapeles"; on `'failed'` shows "No se pudo compartir".
  - Use a transient state in the button itself; no global toast system needed for v1.

- [ ] **Step 2: Build `<RecentsPanel>`**:
  - Reads `useFavorites` + `useRecentSearches`.
  - Renders two sections: "Favoritos" (chips with star icon, tap = set as origin or dest) and "Recientes" (chips with clock icon, tap = re-run query).
  - Empty state: "Sin favoritos a\u00fan. Busca un lugar y toca la estrella para guardarlo."

- [ ] **Step 3: Mount `<RecentsPanel>` at the top of the MapSearch overlay** when no search results are showing (so it appears by default; when user types, results take over).

- [ ] **Step 4: Wire "Save as favorite"** in `MapSearch.tsx`: each result row gets a small star button. Tap toggles favorite (uses `useFavorites().has` + `add` / `remove`).

- [ ] **Step 5: Add a "Compartir" button to `RouteCard.tsx`**, between the duration/cost row and the steps list. Uses `<ShareButton>`.

- [ ] **Step 6: When a search is performed (user submits query), `useRecentSearches().push(query)`** is called from `App.tsx` handleSubmit.

- [ ] **Step 7: Lint + build must pass.**

---

### Task 7: Verification

- [ ] **Step 1: `node tests/test_favorites.mjs`** exits 0 with `ALL TESTS PASS`.
- [ ] **Step 2: `node tests/test_recents.mjs`** exits 0.
- [ ] **Step 3: `node tests/test_share.mjs`** exits 0.
- [ ] **Step 4: `node tests/test_routeValidator.mjs`** still passes (24/24).
- [ ] **Step 5: `node tests/test_stationResolver.mjs`** still passes.
- [ ] **Step 6: `node tests/test_enrichment.cjs`** still passes.
- [ ] **Step 7: `npm run lint`** exits 0.
- [ ] **Step 8: `npm run build`** exits 0 and `dist/assets/index-*.js` exists.
- [ ] **Step 9: Grep the built bundle** for `Iniciar navegaci` and `Compartir` and `Favoritos` (each must appear at least once).
- [ ] **Step 10: Document in `Pendientes.md`** (or new `CHANGELOG.md`) what shipped.

---

## Notes / YAGNI

- Do NOT add a global toast system; the ShareButton manages its own transient state.
- Do NOT add map offline tile caching in this plan; that is a separate PWA initiative.
- Do NOT touch the routing logic, validation pipeline, or anything that already works.
- Do NOT change `useNavigation` itself; it is already production-quality. Only wire it.
- Keep all UI changes inside `App.tsx`, `RouteCard.tsx`, `MapSearch.tsx`. New components are isolated.
- All localStorage reads/writes MUST be guarded against quota errors and corrupt JSON.
- All browser-only APIs (navigator.share, clipboard, vibrate, localStorage) MUST be guarded with `typeof window !== "undefined"` checks.
