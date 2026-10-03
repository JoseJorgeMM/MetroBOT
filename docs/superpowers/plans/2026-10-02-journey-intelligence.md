# Journey intelligence implementation plan

**Goal:** Turn natural-language mobility needs into an editable trip brief and a route decision workspace with factual comparisons and counterfactuals.
**Authorization:** User explicitly requested immediate implementation of the proposals. Continue within existing design system; no additional design approval needed.
**Architecture:** Gemini extracts intent server-side, never invents coordinates, prices, itineraries or operating status. Client resolves places with existing catalog/search, user reviews endpoints, then runs the existing Google/local planner. A pure constraint engine evaluates the priced alternatives and explains measurable trade-offs. Interactive what-if controls recalculate locally.
**Stack:** React 19, TypeScript, Vite, Vercel Web Request handlers, existing Gemini API.

- [x] Intent contract and bounded, validated Gemini endpoint; tests for malformed input/output, timeout, missing key and forbidden origins. Add local dev handler and Vercel entrypoint. Use server-only key.
- [x] Pure decision engine: budget, walking, duration, transfer constraints; unknown does not satisfy a constraint; conditional prices are identified; Pareto comparison and excluded-service simulation use only returned alternatives. Test meaningful edge cases.
- [x] Replace primary chat surface with editable brief: prose input, examples, extracted needs, matching place choices, manual completion, real planning action. Preserve routing admission/cancellation semantics.
- [x] Add route decision panel with comparison explanation, plan-B simulation, actionable map selection and projected recurring cost only for known fares. Label rule calculations separately from Gemini interpretation.
- [x] Validate integration, lint, full relevant tests, production build, browser desktop/mobile and real provider availability. Document prerequisites and measurement plan for a Metro pilot. No deployment/push requested.

Primary review scenario: “¿Cuánto vale un recorrido desde La Estrella hasta el Estadio?” becomes origin/destination plus cost priority, then actual route alternatives and tariff results. Ambiguous locations remain selectable, never guessed by the model. Missing model service permits manual planning and exact-pattern parsing explicitly labeled local. Route decisions continue functioning without model calls.

Visual direction: retain the current green/navy map shell; one prominent request field and editable need controls, no conversation bubbles. Results use a clear recommended alternative, compact factual deltas, and an expandable what-if workspace. No simulated live incidents, fabricated confidence scores or invented benefits.

## Verification evidence

- 162 TypeScript/TSX tests passed, including six mounted StrictMode/lifecycle regressions; 18 legacy test files passed, including the production PWA build check.
- TypeScript (`npm run lint`) and production Vite/PWA build passed. Build still warns about the main chunk exceeding 500 kB.
- Real Gemini requests in the browser extracted the original La Estrella–Estadio cost question and a La Estrella–Sabaneta journey with COP 5,000 budget and 10-minute walking limit.
- Desktop and 390×844 mobile checked: explicit station choices, real local planning, budget rejection, fare-profile recalculation, repeat-cost projection, exclusion, and profile/exclusion/repeat persistence after closing/reopening results. Browser error log empty at final check.
- Google Routes and MapsJS keys are absent locally, so live Google routing was not exercised. Existing local fallback used; indeterminate A/B transfer fares remain explicitly unknown.
- Existing tariff JSON SHA256 unchanged. No configured Gemini key found in generated browser JS. No deployment or Git push performed.
