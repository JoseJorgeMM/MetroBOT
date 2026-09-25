# Google Transit implementation plan

**Goal:** Google Routes TRANSIT is the primary trip planner; local data is an explicitly labelled fallback. Design approved by the user on 2026-09-25.

**Architecture:** Same-origin Vercel Node endpoint holds the Routes secret. A typed adapter preserves Google geometry and transit details. The browser renders these routes exclusively on Google Maps. Local fallback retains Leaflet and the existing local router. No route response persistence, no AI-generated Google routes, no automatic billable retries.

**Stack:** Vite, React 19, TypeScript, Google Routes REST, Google Maps JavaScript, Vercel Node.

- [x] Add failing tests in `tests/googleTransit.test.ts` for coordinate validation, Google mapping, fares, missing results, fallback, upstream errors and request security. Run `npx tsx --test tests/googleTransit.test.ts`.
- [x] Implement `src/lib/googleTransit.ts`, `server/transit.ts`, `api/transit-routes.ts`, `src/lib/transitPlanner.ts`. Limit body size, validate coordinates, abort requests, no-store, mask upstream failures. Test Google success never invokes local router.
- [x] Add Google map loader and renderer. Keep Google route geometry out of Leaflet/OSRM. Replace hardcoded Google script with a restricted public environment key. Exclude Google resources from service-worker caching.
- [x] Connect App request ownership to the provider, preserve endpoints, show source/fallback reason, transit instructions, missing fare and external navigation. Do not send Google's data to Gemini.
- [x] Add Vite development middleware using the same handler, Vercel function config, blank environment template and setup guide with separate keys, API activation, quota limits and live acceptance checks.
- [x] Run new tests, existing regression tests, `npm run lint`, `npm run build`, and browser checks where available. Report that authenticated Google end-to-end verification requires the user's keys.

## Acceptance

Tests exercise a walking + transit fixture with genuine response field shapes and encoded geometry. Absent fares stay unknown, no-route/quota/timeout cases switch to labelled local routes, and invalid inputs never call Google. No key appears in endpoint responses. Browser map errors never result in Google geometry on a non-Google basemap. Production activation is a user action; this task does not enable billing or deploy.

## Verification result

- TypeScript check and production build passed. Build still reports the existing large-bundle/Browserslist warnings and a local-router mixed-import warning.
- 70 TypeScript/React tests passed; PWA strategy tests passed (26 checks). Additional existing share, honesty, route-validator and navigation regressions passed.
- Real localhost HTTP endpoint returned 503 NOT_CONFIGURED with no-store when no server key was present.
- Browser: public-place origin/destination search → Ver rutas → labelled local fallback succeeded. No console errors captured. Mobile viewport 390×844 had no horizontal overflow; desktop 1440×900 rendered correctly.
- Google authenticated requests and map rendering against an activated account remain unverified until the user supplies both keys. No billing services were enabled, and no push/deployment was performed.
