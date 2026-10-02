# Station map experience implementation plan

**Goal:** Fixed-pixel origin/flag markers and useful, honest station details on transit routes.
**Architecture:** Google OverlayView buttons anchored to coordinates, independent of route geometry. Preserve Google boarding/alighting coordinates and match local station metadata by normalized name, compatible mode and proximity. No new paid API or inferred timetables. React station details reused in the local map.
**Stack:** React, TypeScript, Google Maps JS, Leaflet, node:test.

- [x] Add regression coverage for Google stop coordinates, invalid coordinates and station matching (same names across modes, distant duplicates, bus/Metroplús distinction).
- [x] Preserve coordinates in googleTransit.ts and routing.ts; add routeStations.ts for matching and nearby connections. Keep ambiguous matches unverified.
- [x] Replace meter-radius circles with fixed 44px DOM overlays; add keyboard-accessible station buttons and clean up on route changes/unmount.
- [x] Add StationDetails.tsx: local system/line, route-specific boarding/alighting, scheduled time/headsign when supplied, nearby stations explicitly labeled, external location link. EnCicla capacity is not live availability.
- [x] Retain useful EnCicla CSV address/type/capacity metadata and reuse details in both maps through a native modal dialog, avoiding map-pane/mobile-sheet overlap.
- [x] Run regression tests, full TypeScript tests, lint and build; report unverified states explicitly. Do not publish without a new publication request.
- [ ] Verify real Google route markers/zoom with configured Google Maps and Routes credentials (not present in the local environment).

## Verification evidence

- `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.tsx`: 79 passed.
- `node --test tests/test_*.mjs`: 18 test files passed.
- `npm run lint` and `npm run build`: passed; existing bundle-size/mixed-import/Browserslist warnings remain.
- Browser at http://127.0.0.1:4175/: desktop 1280×720 and mobile 390×844, EnCicla Ruta N details, nearby Metroplús details and Escape dismissal verified; no captured console errors. Viewport reset afterwards.
- Port 4174 had an old service-worker-cached build, so a clean local port was used without deleting browser data.
- Screen-space marker projection/constant dimensions/removal verified with an SDK-adapter unit test, not a live Google map.
- Station markers identify boarding/alighting points returned by Google, not every intermediate station of the network. Nearby local points are explicitly not confirmed route stops.
- Parallel reviewer unavailable due to revoked authentication; reviewed implementation directly.
