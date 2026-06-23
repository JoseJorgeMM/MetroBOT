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
