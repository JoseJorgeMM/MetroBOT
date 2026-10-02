# Explicit chain-based fare engine

**Goal:** Price each complete transport chain from the user-owned JSON without inferred fares or per-vehicle double charging.
**Approved design:** Identify real modes, match an internal combination/transfer rule, look up its explicitly associated tariff group, then select the user profile. Internal categories remain distinct even when sharing a price group.
**Architecture:** `src/lib/fares/config.ts` owns mapping/default profile; `engine.ts` is pure; `routeAdapter.ts` classifies structured route data; `FareBreakdown.tsx` renders auditable results. `src/costosintegraciones.json` remains byte-for-byte unchanged. It stays at the user's requested location, imported as configuration (not route geometry).

- [x] Save source hash; add failing tests for exact chain/group/profile mapping, no unknown-group inference and independent group updates.
- [x] Implement chain pricing, strict time boundaries, unknown conditions, EnCicla, Arví, collective portions and distinct-basin double integration. All COP values are integers; unknown totals are null.
- [x] Add route adapter tests: a generic BUS stays unknown; classified structured metadata may specify service/basin/zone; scheduled times are conditional, never validation evidence.
- [x] Replace local hardcoded cost logic, preserve Google quote separately, compute per-alternative fares before display/ranking. Profiles are selectable without re-requesting routes.
- [x] Add total/breakdown/savings only when mathematically supported. Unknown journeys never display partial sums as totals. Preserve routing/maps/navigation and existing prioritization.
- [x] Run all tests/lint/build and browser checks; verify JSON hash unchanged and document limits. Do not publish in this task.

## Verification results

103 TypeScript/TSX tests and 18 legacy test files passed; `npm run lint` and `npm run build` passed. Build retains large-chunk and mixed import warnings. Source SHA256 unchanged: `B81F4D2B7EB7AC5F5279DD4B6C0CD19AF339A569CFEB76C5C0A2D234449A690B`.

Browser: Universidad → Poblado local fallback, profile changed to estudiantil, expanded breakdown correctly kept total unknown and explained missing validation times. Live Google verification unavailable: local service not configured. The existing local itinerary also labels lines 1/2 as Metro; no routing topology or inferred service correction was introduced in this fare-only change. Further catalog normalization is needed before those ambiguous itineraries can be priced reliably.

## Conditions and traceability

Integration time is measured from the first paid validation, not consecutive gaps or route duration. Planned departure times may produce explicitly conditional prices. Missing integration timing, paid-area continuity, bus type, basin, payment eligibility or Arví category produces NO_DETERMINADA where required. Walking/EnCicla do not reset the payment clock. Unknown chains are returned in diagnostics, not guessed. Production logging is off by default and logs no precise locations.

## Verification commands

`node node_modules/tsx/dist/cli.mjs --test tests/fare*.test.ts tests/fare*.test.tsx`

`node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts tests/*.test.tsx`

`npm run lint` and `npm run build`
