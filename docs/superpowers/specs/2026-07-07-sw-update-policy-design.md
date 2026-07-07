# SW Update Policy — Silent Apply (no mid-session reload)

> **Status:** design approved (A3 + B3 + C2)
> **Date:** 2026-07-07
> **Bug:** Safari iOS (and other mobile browsers that re-register the SW per
> tab session) reloads MetroBot in the middle of an active navigation
> because `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`.
> The reload is triggered by the plugin's internal `skipWaiting + reload`
> handler when the SW detects a `waiting` worker and the document crosses
> certain lifecycle boundaries (geolocation prompt, focus/blur cycles during
> speech synthesis). The PWA installed on the home screen does not exhibit
> the bug because its SW lifecycle is decoupled from the tab session.

## Goals

1. The app **must never** reload itself in the middle of a session. The user
   is the only one who can trigger a reload, and only by tapping a visible
   control (or by closing and reopening the app).
2. When a new SW is available, the new code applies **silently on the next
   cold start** (next page load). The user does not need to do anything.
3. The user is **informed** that an update is pending, but the notification
   must not block input, must not cover navigation UI, and must not be
   reloadable by accident.
4. The behavior is identical whether the user opens MetroBot from a regular
   browser tab or from the home screen (PWA installed).

## Non-goals

- Forcing an immediate reload on tap. The toast is informational only.
- Background download UX. We trust the SW to precache on its own.
- Patching `vite-plugin-pwa` internals. We work through its public config.

## Decisions (from brainstorming)

- **A3.** The `UpdateToast` shows at most once per detected version. After
  the user dismisses it (or it auto-hides), the same version does not show
  again. A new version (new `sw.js` revision) gets its own toast.
- **B3.** The toast is moved from top-center to a discreet bottom strip with
  no "Recargar" button. It says, in Spanish: "Hay una version nueva. Se
  aplicara al reiniciar." The toast is dismissable with a single tap on
  the X icon.
- **C2.** Same behavior for both modes (browser tab and PWA installed). No
  branching on `display-mode: standalone`.

## Architecture

### A. `vite-plugin-pwa` config (`vite.config.ts`)

Change `registerType` from `'autoUpdate'` to `'prompt'`. With `'prompt'`:

- The plugin **no longer** injects the internal `skipWaiting + reload`
  handler. New SW workers are detected but left in the `waiting` state
  until the app explicitly activates them.
- `injectRegister: 'auto'` is kept so the SW is still auto-registered on
  first load.
- The `workbox.clientsClaim` default is unchanged. The new SW claims open
  clients only after it is activated via `skipWaiting()`.

### B. Update policy module (new, pure, fully testable)

Create `src/lib/swUpdatePolicy.ts` with the following pure functions,
backed by `localStorage`:

```ts
// localStorage keys (constants exported for tests)
export const SW_UPDATE_SEEN_KEY = 'metrobot.sw.update.seen.v1';
export const SW_UPDATE_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Returns the revision string of the last update the user has been
// notified about, or null if none.
export function getSeenUpdateRevision(storage): string | null;

// Marks `revision` as the last seen update. Idempotent. Returns true on
// success.
export function markUpdateSeen(storage, revision, now): boolean;

// Returns true if the user has been notified about `revision` within the
// last 7 days. The "seen" record is cleared after 7 days so that a
// repeated failure of the SW to install correctly still surfaces a fresh
// toast eventually.
export function shouldShowUpdateToast(storage, revision, now): boolean;
```

The "revision" is a string we attach to each `sw.js` deployment. We use
`import.meta.env.VITE_BUILD_ID` (Vite's built-in env), with a sensible
fallback (`'dev'`) when not set. This way, every build that the server
publishes has a unique revision, and a stale `seen` record automatically
becomes irrelevant when a new build is published.

### C. `useServiceWorkerUpdate` hook (modified)

The hook keeps its public API (`hasUpdate`, `applyUpdate`, `enabled`,
`controlling`) but the implementation changes:

1. On `wb.waiting` event, capture the current revision
   (`import.meta.env.VITE_BUILD_ID`) and call `shouldShowUpdateToast`. If
   the policy says "no" (already seen within 7 days), do not set
   `hasUpdate = true`. The toast is suppressed.
2. On `applyUpdate()`: call `wb.messageSkipWaiting()` and set
   `controlling = true`. **Do not** call `window.location.reload()`.
   The page is allowed to keep running. New SW takes control on next
   navigation. Mark the current revision as seen so the toast is not
   shown again for this build.
3. Expose a new helper, `consumeUpdate()`, that the toast can call when
   the user dismisses it. It persists the seen record and clears
   `hasUpdate` locally. The user is not asked again until the next
   build.

### D. `UpdateToast` component (rewritten)

The toast moves from `top-[safe-area+12px]` to a discreet
`bottom-[calc(env(safe-area-inset-bottom)+12px)]` position, with
`z-[1100]` (same as the install banner). The visual style is a thin
informational bar, not a rounded floating chip. The "Recargar" button
is removed entirely. The text is:

> "Hay una version nueva. Se aplicara al reiniciar."

A single small X icon on the right dismisses the toast for the current
build. The user does not need to do anything else.

If the user wants to apply the update immediately, they can manually
reload via the browser's own controls (or close and reopen the tab).
The toast never offers a "reload" button again.

### E. Tests (TDD, all written before any production code change)

1. `tests/test_sw_update_policy.mjs` + `tests/_sw_update_policy_impl.mjs`:
   - `getSeenUpdateRevision` returns `null` for empty storage.
   - `markUpdateSeen` persists a revision and returns `true`.
   - `shouldShowUpdateToast` returns `true` for a never-seen revision.
   - `shouldShowUpdateToast` returns `false` for a revision seen within
     the last 7 days.
   - `shouldShowUpdateToast` returns `true` again after 7 days.
   - `shouldShowUpdateToast` returns `true` for a different revision,
     even if a previous revision was just seen (each build is
     independent).
   - All functions tolerate blocked storage, corrupt values, and
     `null` storage.

2. `tests/test_pwa_strategies.mjs` (modified):
   - Replace the existing `registerType autoUpdate` assertion with
     `registerType prompt`.

3. `tests/test_pwa_hooks.mjs` (extended):
   - `applyUpdate` calls `wb.messageSkipWaiting()` and does **not** call
     `window.location.reload()`.
   - When a `waiting` event fires for a revision already in `seen`, the
     `hasUpdate` state stays `false`.

### F. Verification

- `node tests/test_sw_update_policy.mjs` -> green.
- `node tests/test_pwa_strategies.mjs` -> green (with the updated
  assertion).
- `node tests/test_pwa_hooks.mjs` -> green (with the new assertions).
- `node tests/test_pwa_hooks.mjs` together with the rest of the suite
  -> all green.
- `npm run lint` exit 0.
- `npm run build` exit 0. The generated `dist/sw.js` must NOT contain
  the `skipWaiting + reload` inline handler from `autoUpdate` (we verify
  by grepping for a known marker, e.g. the `RegisterSW` self.skipWaiting
  pattern from `vite-plugin-pwa`).
- Manual smoke: open MetroBot in Safari iOS, trigger an update by
  changing the bundle, navigate, start a route, confirm there is no
  reload in the middle of the session.

## Risks

- **R1.** `registerType: 'prompt'` means the new SW does not activate
  until the user navigates or reloads. This is fine for our use case
  (the user closes the app between trips anyway) but if a critical
  security fix needs to land immediately, a manual reload is required.
  We accept this trade-off; the toast informs the user.

- **R2.** Safari iOS has had documented issues with `vite-plugin-pwa`
  in the past. We mitigate by keeping the strategy config minimal and
  verified by `test_pwa_strategies.mjs`. If Safari still misbehaves, the
  fallback is to disable the SW entirely in Safari (UA sniff), but that
  is out of scope for this spec.

- **R3.** The build revision (`VITE_BUILD_ID`) must be set on every
  production build. We add a default in `vite.config.ts` so dev builds
  still work.

## File-by-file change list

| File | Action |
|---|---|
| `vite.config.ts` | `registerType: 'autoUpdate'` -> `'prompt'`. Define `VITE_BUILD_ID` default. |
| `src/lib/swUpdatePolicy.ts` | **New.** Pure functions for seen-revision policy. |
| `src/hooks/useServiceWorkerUpdate.ts` | Use the policy, drop `reload()` from `applyUpdate`, add `consumeUpdate()`. |
| `src/components/UpdateToast.tsx` | Move to bottom strip, remove "Recargar" button, use `consumeUpdate()`. |
| `tests/_sw_update_policy_impl.mjs` | **New.** Pure mirror of `swUpdatePolicy.ts`. |
| `tests/test_sw_update_policy.mjs` | **New.** Policy asserts. |
| `tests/test_pwa_strategies.mjs` | Update `registerType` assertion. |
| `tests/test_pwa_hooks.mjs` | Add new asserts for the no-reload contract. |
| `docs/CHANGELOG.md` | New `## 2026-07-07 - SW update policy: silent apply` section. |
| `docs/superpowers/plans/2026-06-26-pwa-and-offline.md` | Mark affected steps as superseded by the 2026-07-07 plan. |

## Out of scope

- Re-adding an explicit "Recargar" button (the toast is informational
  only).
- Per-route SW precache tuning.
- UA-sniffing to disable the SW on certain browsers.