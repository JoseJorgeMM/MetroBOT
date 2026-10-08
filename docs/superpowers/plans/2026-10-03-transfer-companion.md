# Transfer companion implementation plan

**Goal:** Deliver a sourced San Antonio A-to-B pilot with real sign OCR, conservative comparison and local voluntary observation export.
**Authorization:** User approved the concept and explicitly requests autonomous research and implementation; do not require user field documentation to begin.
**Architecture:** Runtime public JSON contains sourced network facts and explicitly unknown indoor geometry. Gemini extracts visible text only through a private, bounded server endpoint; deterministic code compares exact line/destination labels. Never generate turn directions, location, safety or accessibility claims. OCR cannot confirm platform or physical location. Existing route planner remains authoritative for journey selection.
**Stack:** React/TypeScript, Vite, Vercel Request handler, Gemini REST, node:test.

- [x] Research official line map and works notice; store paraphrased facts, links, publication/consultation dates and unknowns in public transfer catalog and research note.
- [x] TDD server OCR: POST image base64 JPEG/PNG/WebP, max 2 MiB decoded, strict output visibleText/string <=2000, no arbitrary URLs, server-only Gemini key, timeout/cancellation, origin and rate controls. Wire Vite and Vercel.
- [x] TDD comparison: explicit B + San Javier is compatible signage, conflicting line/direction or insufficient evidence abstains; compatibility never means position confirmed. Test misleading/injected text.
- [x] Add accessible companion to JourneyStudio as explicit pilot and RouteComparison only for matching structured San Antonio A→B steps. Runtime catalog failure disables feature safely. Upload explicit opt-in, cancellable stale responses, preview memory-only; manual text path clearly distinguished.
- [x] Add opt-in structured observations in memory only, aggregation/export (no images, location, free text or automatic transmission); label local pilot not Metro official reporting.
- [x] Verify focused/full tests, typecheck, build and browser actual flow. Document dataset limitations and pilot setup, no push/deploy. See verification limitations in docs/transfer-pilot.md.

Research constraint: official July 22, 2026 works announcement is historical evidence, not a live closure feed. No claim that closures are ongoing today. No reliable current indoor path located yet; detailed navigation remains disabled.
