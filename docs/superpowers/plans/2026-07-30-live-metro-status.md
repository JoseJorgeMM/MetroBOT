# Live Metro Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a safe, cited Metro operational-status lookup using Gemini Google Search Grounding.

**Architecture:** Keep route calculation unchanged. Add pure parsing/source-policy helpers in `src/lib/liveMetroStatus.ts`; call Gemini Search from `gemini.ts`; make `SystemStatus` render `normal`, `alerta`, or `no_verificado` with timestamp and citations.

**Tech Stack:** React 19, TypeScript, `@google/genai`, dependency-free Node tests.

## Global Constraints

- Use `tools: [{ googleSearch: {} }]` with the existing `@google/genai` client.
- Treat public social posts as secondary evidence, never as sole official confirmation.
- Never render “Operación Normal” when the lookup errors, is ambiguous, or has no usable sources.
- Keep the five-minute in-memory cache and avoid exposing API keys to new endpoints.

### Task 1: Pure status parser and source policy

**Files:** Create `src/lib/liveMetroStatus.ts`; create `tests/_liveMetroStatus_impl.mjs`; create `tests/test_liveMetroStatus.mjs`.

- [ ] Write tests for normal, alert, ambiguous, stale, empty, and citation extraction cases.
- [ ] Run the new test and verify it fails because the parser is missing.
- [ ] Implement `parseLiveMetroStatus(text, groundingMetadata, now)` and `isTrustedStatusSource(url)` with explicit `unknown` fallback.
- [ ] Run the test again and verify all assertions pass.

### Task 2: Grounded Gemini lookup

**Files:** Modify `src/lib/gemini.ts`.

- [ ] Add `getLiveMetroStatus()` that calls `gemini-2.5-flash` with `tools: [{ googleSearch: {} }]`.
- [ ] Require a recent search, official Metro sources first, exact affected lines/stations, and uncertainty when evidence conflicts.
- [ ] Parse response text and `groundingMetadata`; cache successful and failed results for five minutes to avoid request storms.
- [ ] Return a typed `LiveMetroStatus` without throwing to the UI.

### Task 3: SystemStatus UI

**Files:** Modify `src/components/SystemStatus.tsx`.

- [ ] Replace the Google News-only fetch with `getLiveMetroStatus()`.
- [ ] Initialize all lines as `unknown` and show “No verificado” until a grounded result arrives.
- [ ] Display summary, query time, affected station names, and up to three cited sources.
- [ ] Keep loading/error states accessible and ensure a failed lookup cannot display normal operation.

### Task 4: Verification

- [ ] Run `node tests/test_liveMetroStatus.mjs`.
- [ ] Run all existing Node tests and `node tests/test_enrichment.cjs`.
- [ ] Run `npm run lint` and `npm run build`.
- [ ] Review `git diff --check` and verify no secrets or raw API responses are persisted.
