# Places request correction

Approved scope: remove incompatible locationBias while retaining Valle de Aburrá locationRestriction; expose search failures instead of silently showing an empty list.

- [x] Tighten the existing Places integration test to reject simultaneous bias/restriction, and add UI coverage for errors and empty results. Three regression tests failed before implementation and passed afterwards.
- [x] Correct request, allow library reload after failure, and attach feedback to the existing generation-checked planner state. Do not render provider exception text (may include credentials).
- [x] Validate fallback HTTP/schema, expose selection failure, clear notices on edits and ignore stale notices.
- [x] Run targeted/full tests, TypeScript and build. No credential changes or deployment. Browser verification remains unavailable under the previously reported browser policy block; live Google authorization is not asserted from mocked tests.

Validation: 320 tests passed. Existing main-bundle size warning remains unrelated. Places contract reference: https://developers.google.com/maps/documentation/javascript/reference/autocomplete-data (only one of locationBias/locationRestriction).
