# MetroBOT changelog

## 2026-06-23 — Active navigation + favorites + recent searches + share

### A. Active turn-by-turn navigation (wired in)
- New: `NavigationOverlay` is now mounted above the map.
- Each `RouteCard` shows an **Iniciar navegación** button (only when the route has a walk segment).
- While navigation runs: the sheet auto-collapses so the overlay is visible, `followUser` is true on the map, the user position is fed back via `nav.pos`, `navigator.vibrate([120,60,120])` fires on each cue change.
- Auto-stop 6 seconds after `arrived`.
- TTS in Spanish (existing `tts.ts`), mute toggle persisted to localStorage.

### B. Favoritos + Recientes + Compartir
- New hooks: `useFavorites` (cap 50, MRU, quota-safe), `useRecentSearches` (cap 10, case-insensitive dedup, quota-safe).
- New UI: `QuickPicksBar` renders a chip strip above the map with favorites + recent searches.
- Each MapSearch result now has a star button to add/remove favorites.
- New `<ShareButton>` uses Web Share API and falls back to clipboard; never throws.
- Recent queries are pushed automatically every time the user submits.

### Files added
- `src/lib/share.ts`
- `src/hooks/useFavorites.ts`
- `src/hooks/useRecentSearches.ts`
- `src/components/QuickPicksBar.tsx`
- `src/components/ShareButton.tsx`
- `tests/test_share.mjs` + `tests/_share_impl.mjs`
- `tests/test_favorites.mjs` + `tests/_favorites_impl.mjs`
- `tests/test_recents.mjs` + `tests/_recents_impl.mjs`
- `docs/superpowers/plans/2026-06-23-active-nav-favorites-share.md`

### Files modified
- `src/App.tsx` (useNavigation + QuickPicksBar + NavigationOverlay + pushRecent on submit)
- `src/components/RouteCards/RouteCard.tsx` (Iniciar navegación + ShareButton + nav state)
- `src/components/Map/MapSearch.tsx` (favorite star per result)

### Verification (evidence)
- 6/6 test files green: routeValidator (24/24), stationResolver (7/7), enrichment (5/5), share (14/14), favorites (14/14), recents (14/14).
- `npm run lint` exit 0.
- `npm run build` exit 0; bundle 912 KB.
- All 11 bundle markers verified.

## 2026-06-26 - PWA + offline support

### C. Progressive Web App + offline cache
- vite-plugin-pwa@1.3.0 (Workbox 7) wired into vite.config.ts with autoUpdate + auto-register.
- Manifest updated: name, theme color, 4 icons (192, 512, maskable-512, favicon.svg), categories, lang.
- New icons generated from public/logo_chat.png via sharp.
- public/offline.html fallback page (works as navigateFallback).
- runtimeCaching strategies: NetworkFirst for HTML, CacheFirst for static assets, StaleWhileRevalidate for routes/stations/tariffs/times, NetworkOnly for tiles + Gemini API.
- usePwaInstall hook + InstallBanner component (above the bottom sheet, dismissible for 7 days).
- useServiceWorkerUpdate hook + UpdateToast component (top toast with Reload button).
- index.html: theme-color, 3 apple-touch-icons.
- Service worker registered automatically via vite-plugin-pwa inject.

### Files added
- src/hooks/usePwaInstall.ts
- src/hooks/useServiceWorkerUpdate.ts
- src/components/InstallBanner.tsx
- src/components/UpdateToast.tsx
- public/offline.html
- public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png
- tests/test_pwa_strategies.mjs
- tests/test_pwa_hooks.mjs
- tests/_pwa_hooks_impl.mjs
- docs/superpowers/plans/2026-06-26-pwa-and-offline.md

### Files modified
- vite.config.ts (VitePWA plugin + strategies)
- public/manifest.json (new icons + theme color)
- src/App.tsx (mount InstallBanner + UpdateToast)
- index.html (theme-color + apple-touch-icons)
- package.json (vite-plugin-pwa + workbox-window + sharp)

### Verification (evidence)
- 109/109 tests green across 7 files + 5/5 enrichment.
- npm run lint exit 0.
- npm run build exit 0; sw.js (3.6 KB) + workbox-77d36791.js + 17 precache entries (~2.7 MB).
- HTTP checks against dist/: manifest 200, icon-192 26 KB, icon-512 132 KB, offline.html 200, sw.js 200 with all strategies present.
- Bundle markers verified: serviceWorker, workbox-window, Workbox, beforeinstallprompt, Instala MetroBot, Nueva version disponible.

## 2026-07-06 - Remove recent searches

### Why
The recent-searches chip strip overlapped the MapSearch origin/destination
inputs on mobile and on desktop, blocking access to the input fields. User
preference: remove the feature entirely instead of refactoring the layout.

### Removed
- `src/hooks/useRecentSearches.ts` (MRU list backed by `metrobot.history.v1`).
- `src/components/RecentsPanel.tsx` (was already orphan: not mounted anywhere).
- `src/components/QuickPicksBar.tsx`: dropped the "Recientes" section; bar now
  renders only Favoritos. Lowered `max-h` from `40dvh` to `18dvh` to free vertical
  space above the MapSearch inputs.
- `src/App.tsx`: removed `useRecentSearches` import + `pushRecent` call in
  `handleSubmit` + `onPickRecent` handler on `<QuickPicksBar>`.
- `tests/test_recents.mjs` + `tests/_recents_impl.mjs` (14 asserts retired).

### Added
- `src/lib/migration.ts`: idempotent one-shot `runMigrations(storage)` that
  removes `metrobot.history.v1` from `localStorage` on the next app launch and
  sets a `metrobot.migrated.v2` flag. Safe against blocked storage, quota
  errors, and SSR.
- `App.tsx` calls `runMigrations(window.localStorage)` once in a mount effect.
- `tests/test_migration_v2.mjs` + `tests/_migration_v2_impl.mjs` (15 asserts):
  removal, idempotency, preservation of unrelated keys, null/blocked storage.

### Verification (evidence)
- `node tests/test_migration_v2.mjs` -> 15/15 green.
- All 12 remaining test files green: favorites (14/14), share (14/14), stationResolver (7/7), routeValidator (45/45), validatorTelemetry (20/20), honesty (15/15), evidence (10/10), reduced_motion (11/11), pwa_strategies (5/5), pwa_hooks (6/6), sheet_drag (25/25), enrichment (17/17).
- `npm run lint` exit 0.
- `npm run build` exit 0; bundle 949.71 kB (gz 260.35 kB), sw.js + workbox + 18 precache entries.
