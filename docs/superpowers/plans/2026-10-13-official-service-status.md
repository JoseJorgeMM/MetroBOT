# Official service status implementation plan

**Goal:** Connect MetroBOT to the line-status feed used by the Metro's official website, without keys, invented station closures, or generative interpretation.

**Architecture:** A GET Vercel function validates the fixed upstream endpoint and returns twelve explicit line states. CDN caching lasts at most five minutes; the client deduplicates requests and expires evidence using the original fetch time. Vite development and preview use the same handler. The home panel and route cards share the client, while legacy assistant consumers stop interpreting news absence as normal operation.

**Tech Stack:** Existing TypeScript, Web Request/Response, Vite, React, node:test + tsx; no new dependency.

## Approved design and boundaries

- Source: https://www.metrodemedellin.gov.co/_hcms/api/semaforos, discovered in official homepage markup and verified against its JavaScript.
- Only line-level evidence. No station closures inferred. Source supplies no publication time; expose `sourceUpdatedAt: null`, `checkedAt`, `expiresAt` separately.
- Public website endpoint, not a contracted API; review reuse permission with Metro before institutional rollout. No guaranteed availability or permanently free hosting.
- Preserve official status wording. Unknown IDs, missing lines, duplicates, malformed payloads, HTTP failures and expired evidence never become normal.
- No route exclusion or ranking changes. A matching line warning is advisory, not proof that the scheduled trip cannot run.
- External buses and ambiguous lines are explicitly outside coverage.

## Tasks

- [x] Add `tests/serviceStatus.test.ts` for payload validation, expiry, GET-only handler, network failures, timeout, cache headers and conservative route identity. Run `node --import tsx --test tests/serviceStatus.test.ts` and observe missing implementation.
- [x] Implement `src/lib/serviceStatus.ts`, `server/serviceStatus.ts`, `api/metro-status.ts`, `server/serviceStatusDevPlugin.ts`; wire Vite and function duration. Success: `Cache-Control: no-store` for browsers, `Vercel-CDN-Cache-Control: public, s-maxage=300, must-revalidate`; errors not cached.
- [x] Add shared client and hook with request deduplication, timeout and absolute expiry. Test concurrent requests and stale/malformed responses.
- [x] Add home/system panel and route-specific notice. Render labels as text, identify source and consultation time, provide official/Instagram links, preserve unknown coverage. Rendering tests written first; happy-dom confirms expansion, deduplication and expiry on reconnect.
- [x] Replace legacy news-based normal fallback and Gemini status search with the official adapter; test no evidence -> unknown.
- [x] Run full tests, `npm run lint`, `npm run build`, and local API smoke check. Document exact limits, setup (no key), caching and deployment requirements. Do not push/deploy.

## Verification limitation

Browser visual inspection could not proceed: the existing in-app browser tab was rejected by browser URL policy (non-HTTP protocol). No browser-policy workaround attempted. Live local API returned HTTP 200, twelve lines and the intended cache headers. Rendering/interaction coverage is automated via React/happy-dom, not a screenshot. Production CDN behavior still needs verification after authorized deployment.
