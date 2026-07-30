# Mobile navigation hardening plan

## Goal

Make the existing 2D, turn-by-turn mobile flow reliable for walking legs and
clear at public-transit handoffs. This is not a claim of Google Maps feature
parity: the project has no live vehicle positions, traffic feed, or managed
routing service.

## Findings

- Navigation was wired into the app, with GPS tracking, TTS, haptics and a
  follow-user marker.
- A denied/timed-out initial location fix still allowed route construction.
- Reaching the final destination immediately called `stop`, so the arrived
  state and its confirmation banner could never be shown.
- The GPS watcher was recreated on position updates because of stateful
  callback dependencies, which is fragile on mobile browsers.
- Device-orientation permission required by iOS was never requested.
- There was no focused regression coverage for navigation-state decisions.

## Implementation

1. Extract testable navigation decision helpers and add regression tests for
   permission failure, arrival state, off-route throttling and cue selection.
2. Harden `useNavigation`: retain a stable GPS callback, distinguish a failed
   first fix from a valid location, prevent concurrent starts/recalculations,
   preserve the arrived state, clean up watchers deterministically and request
   iOS compass permission from the user-initiated start action.
3. Improve the mobile overlay for locating/error/arrival feedback and accessible
   controls. Keep the bottom sheet collapsed while guidance is active.
4. Run the complete existing test suite, type-check, production build, and a
   browser smoke test at mobile viewport.

## Out of scope

- Vehicle tracking, traffic-aware ETAs, background navigation, offline map
  tiles, and a commercial routing SLA require backend/providers and data feeds
  not present in this repository.
