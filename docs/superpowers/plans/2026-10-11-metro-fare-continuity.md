# Metro fare continuity implementation plan

**Goal:** Fix the approved Metro A/B continuity issue without inventing bus fares or changing tariff category/group mappings.
**Architecture:** Explicit Metro continuation evidence (verified or planned) on fare segments. Only an uninterrupted Metro chain with evidence on every continuation uses the existing single-mode category. Planned continuity is conditional, never a claim of actual paid-area validation. The adapter recognizes only structured A/B handoffs at San Antonio, optionally separated by short walking steps. Unknown buses retain abstention.
**Stack:** TypeScript, pure fare engine, node:test.

- [x] Write failing engine and adapter tests: verified/planned continuity, bank profile, no evidence, explicit new journey, conflicting stops and walking interruption.
- [x] Implement evidence type, explicit connection configuration and strict adapter recognition; preserve explicit fareInput overrides.
- [x] Price continuous Metro as one mode through existing category/group/profile lookup, charge subsequent segments $0 adicional, avoid artificial savings.
- [x] Inspect bus catalog evidence and retain unknown classifications where tariff class is absent.
- [x] Run fare regressions, full tests, typecheck and build. No push or deploy.

## Evidence and boundaries

Verified 2026-10-11: 251 TypeScript/React tests pass, `npm run lint` passes, production build passes (existing main-chunk size warning). Five new regression cases reproduce the missing-fare issue and cover the fix. No live Google itinerary or browser validation was performed in this change.

Network reference: [official Línea B page](https://www.metrodemedellin.gov.co/usuarios/sistema-integrado/linea-b). This supplies transfer context, not proof that a passenger stayed inside the paid area. Planned continuity therefore remains conditional. The three-minute walk cutoff is a conservative recognition limit, not an official walking-time assertion.

Bus inspection: 125 records, 41 C3/C6 IDs; available fields are id, name, stops, folder, sourceFile, geocodedOk, geocodedFail. No explicit tariff-class/zone fields exist in that catalog. Existing exact C3/C6 classification is retained; no broad bus-price inference added.

Scope: continuous Metro-only chains with explicit evidence. Local paths without structured handoff stops and mixed multi-mode chains not covered by existing explicit rules can still be NO_DETERMINADA. No category-group mapping, tariff values or generated route data changed. No commit, push or deployment.
