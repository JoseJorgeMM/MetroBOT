# PWA + Offline-First Implementation Plan

> REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make MetroBOT installable as a PWA on Android/iOS and keep working (read-only) when the user has no internet — routes, stations, fares, and previously-shown chat responses load from cache.

**Architecture:** `vite-plugin-pwa` with Workbox v7 generates a service worker at build time. The SW intercepts `fetch()` and applies different strategies per resource family. Install UX is added via a `beforeinstallprompt` listener that surfaces a dismissable banner.

**Tech Stack:** Vite 6.4 + `vite-plugin-pwa@1.3.0` (Workbox 7) + `workbox-window@7.4.1` for the runtime API. No React state library; we use plain `useState` + a small pubsub for SW update events.

---

## File Structure

- Modify: `vite.config.ts` (register `VitePWA` plugin with strategies).
- New: `public/offline.html` (offline fallback page).
- Modify: `public/manifest.json` (proper maskable icon, categories, lang).
- New: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` (icons generated from `public/logo_chat.png` via sharp).
- New: `src/hooks/usePwaInstall.ts` (hook for the install prompt).
- New: `src/hooks/useServiceWorkerUpdate.ts` (hook for the update toast).
- New: `src/components/InstallBanner.tsx` (dismissable bottom banner).
- New: `src/components/UpdateToast.tsx` (toast with Reload button).
- Modify: `src/App.tsx` (mount both components).
- Modify: `index.html` (add `<link rel="apple-touch-startup-image">` and tweak meta).
- Modify: `src/lib/utils.ts` (add a tiny event bus for SW events; or just put it inline in hooks).
- New: `tests/test_pwa_strategies.mjs` (validates the vite.config.ts strategy config + manifest structure).
- New: `tests/test_pwa_hooks.mjs` (validates hook contract: install + update flow without DOM).
- Modify: `docs/CHANGELOG.md` (new section).
- Modify: `docs/PWA.md` (architecture + how-to-test + how-to-update-strategies).

---

### Task 1: Persist plan + confirm design (already done)

- [x] Plan written to `docs/superpowers/plans/2026-06-26-pwa-and-offline.md`.

---

### Task 2: Install deps

- [ ] **Step 1:** `npm install vite-plugin-pwa@^1.3.0 workbox-window@^7.4.1 --save`.
- [ ] **Step 2:** Confirm `vite.config.ts` typecheck still passes.
- [ ] **Step 3:** `npm ls vite-plugin-pwa workbox-window` (verify install).

---

### Task 3: Icons + manifest + offline fallback

- [ ] **Step 1:** Generate `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` from `public/logo_chat.png` using a tiny Node + sharp script (`scripts/generate-icons.cjs`). Outputs: solid square 192/512 and a 512 with safe area padding for maskable.
- [ ] **Step 2:** Update `public/manifest.json` to reference the new icons (and mark `logo_chat.png` as legacy for backward compat).
- [ ] **Step 3:** Create `public/offline.html` with: large "Estás sin conexión" message, retry button (`location.reload()`), theme color matching manifest.
- [ ] **Step 4:** Verify `curl http://127.0.0.1:3000/manifest.json` returns the updated manifest and `curl /offline.html` returns 200 (will be 200 after `npm run build` since dev serves SPA, but the file should be in `public/`).

---

### Task 4: Configure vite-plugin-pwa (TDD: strategy config)

**Files:** `vite.config.ts`, `tests/test_pwa_strategies.mjs`.

- [ ] **Step 1:** Write the test FIRST. `tests/test_pwa_strategies.mjs` reads `vite.config.ts` (regex over the source), asserts:
  - `VitePWA` plugin is registered.
  - `registerType: 'autoUpdate'`.
  - `injectRegister: 'auto'` (auto-injects the SW registration on app load).
  - `workbox.runtimeCaching` has rules for:
    - `rutas_integradas\.json$` with handler `StaleWhileRevalidate`.
    - `Estaciones_.*\.csv$` with handler `StaleWhileRevalidate`.
    - `tarifas_.*\.csv$` with handler `StaleWhileRevalidate`.
    - `tiempos_.*\.csv$` with handler `StaleWhileRevalidate`.
    - `/assets/.*\.(js|css|woff2?)$` with handler `CacheFirst`.
    - `navigation` (HTML) with handler `NetworkFirst`.
  - `manifest` block matches the new icons + theme color.
  - `navigateFallback: '/offline.html'`.

- [ ] **Step 2:** Run test, expect RED (config not updated yet).

- [ ] **Step 3:** Modify `vite.config.ts` to add the `VitePWA({...})` plugin. Build the runtimeCaching array. Pin Workbox version explicitly: `workbox: { cleanupOutdatedCaches: true, navigateFallback: '/offline.html', globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'] }`.

- [ ] **Step 4:** Re-run test, expect GREEN.

---

### Task 5: Implement install prompt hook + banner

**Files:** `src/hooks/usePwaInstall.ts`, `src/components/InstallBanner.tsx`, `src/App.tsx`.

- [ ] **Step 1:** `usePwaInstall()` exposes `{ canInstall: boolean, promptInstall: () => Promise<boolean>, dismissed: boolean, dismiss: () => void }`. Listens to `window.beforeinstallprompt`, stores the event in a ref, and on `promptInstall()` calls `event.prompt()` then reads `event.userChoice.outcome`. Persists `metrobot.install.dismissed.v1` to localStorage.

- [ ] **Step 2:** `<InstallBanner>` renders a fixed-bottom card (above the bottom-sheet) when `canInstall && !dismissed && !isStandalone` with the MetroBot icon, copy "Instala MetroBot para usarla sin conexion", a primary button "Instalar", and an X to dismiss.

- [ ] **Step 3:** Detect standalone mode via `window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true`.

- [ ] **Step 4:** Mount in `App.tsx` after the chat sheet so it floats above the map. Banner position: `fixed bottom-3 left-3 right-3 lg:right-[29rem] z-[1200]`.

---

### Task 6: Implement SW update toast

**Files:** `src/hooks/useServiceWorkerUpdate.ts`, `src/components/UpdateToast.tsx`, `src/App.tsx`.

- [ ] **Step 1:** `useServiceWorkerUpdate()` subscribes to `workbox-window` `waiting` and `controlling` events. Exposes `{ hasUpdate: boolean, applyUpdate: () => void }`. `applyUpdate` calls `wb.messageSkipWaiting()` then `location.reload()`.

- [ ] **Step 2:** Initialize `Workbox` from `workbox-window` only when `import.meta.env.PROD` is true (no SW in dev). In dev, expose `{ hasUpdate: false }` so the UI does nothing.

- [ ] **Step 3:** `<UpdateToast>` shows a top-center toast "Nueva version disponible" with a Reload button. Dismissable (but auto-applies on next app launch).

- [ ] **Step 4:** Mount in `App.tsx`.

---

### Task 7: Tests for hooks (TDD: hook contract)

**Files:** `tests/test_pwa_hooks.mjs`, `tests/_pwa_hooks_impl.mjs`.

- [ ] **Step 1:** Mirror the pure logic in `_pwa_hooks_impl.mjs`: `shouldOfferInstall(event) -> boolean`, `dismissedValue(storage) -> boolean`, `markDismissed(storage)`. Hooks are thin React wrappers.

- [ ] **Step 2:** Tests for install hook (5+ asserts):
  - No event captured -> `canInstall: false`.
  - Event captured -> `canInstall: true`.
  - `promptInstall()` returns true if `userChoice.outcome === 'accepted'`.
  - `promptInstall()` returns false on `dismissed`.
  - `dismissed: true` after `dismiss()` is called.
  - `dismissed: true` if localStorage had `metrobot.install.dismissed.v1 = '1'`.
  - `dismissed: true` if standalone mode is true.

- [ ] **Step 3:** Tests for update hook (3+ asserts):
  - No SW available -> `hasUpdate: false`.
  - `waiting` event sets `hasUpdate: true`.
  - `applyUpdate()` calls messageSkipWaiting then `location.reload()`.

- [ ] **Step 4:** All tests green.

---

### Task 8: index.html tweaks for iOS PWA

- [ ] **Step 1:** Add `<meta name="theme-color" content="#00994C">` (no media query) so iOS Safari uses the right status-bar color.
- [ ] **Step 2:** Add `<link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png">` and `<link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png">`.
- [ ] **Step 3:** Add `<link rel="apple-touch-startup-image" href="/logo_chat.png">` so the splash screen uses our logo (instead of the default white screen).
- [ ] **Step 4:** Confirm with `view-source` that the dev server serves these tags.

---

### Task 9: Verification

- [ ] **Step 1:** `node tests/test_pwa_strategies.mjs` exit 0.
- [ ] **Step 2:** `node tests/test_pwa_hooks.mjs` exit 0.
- [ ] **Step 3:** `node tests/test_routeValidator.mjs` still 24/24.
- [ ] **Step 4:** `node tests/test_stationResolver.mjs` still 7/7.
- [ ] **Step 5:** `node tests/test_enrichment.mjs` still 5/5.
- [ ] **Step 6:** `node tests/test_share.mjs` still 14/14.
- [ ] **Step 7:** `node tests/test_favorites.mjs` still 14/14.
- [ ] **Step 8:** `node tests/test_recents.mjs` still 14/14.
- [ ] **Step 9:** `npm run lint` exit 0.
- [ ] **Step 10:** `npm run build` exit 0. The dist folder contains `dist/sw.js` (Workbox-built service worker) and `dist/manifest.webmanifest`.
- [ ] **Step 11:** Bundle markers: `navigator.serviceWorker`, `workbox-window`, `beforeinstallprompt`, `Installemos MetroBot`, `Nueva version disponible`. Each must appear in the bundle.
- [ ] **Step 12:** Manual: serve `dist/` with `vite preview`, open in Chrome DevTools > Application > Manifest, verify no warnings. Open DevTools > Application > Service Workers, verify SW registers.

---

## Notes / YAGNI

- Do NOT cache map tiles (OSM/Carto) — they're large and have licensing implications; NetworkOnly is correct.
- Do NOT cache `/api/gemini` responses — those need to be live.
- Do NOT add a Zustand or Redux store; the SW events go through a tiny in-house pubsub (`utils.ts`).
- Do NOT change the disclaimer or navigation code from the previous plan.
- The PWA install banner appears at most once per week per user (rate-limited via localStorage timestamp, not just a boolean).
- All hooks must be SSR-safe (guard `typeof window`).
