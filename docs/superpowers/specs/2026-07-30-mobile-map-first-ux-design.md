# Mobile Map-First UX Design

**Date:** 2026-07-30  
**Status:** Approved direction, specification review pending  
**Primary platform:** Mobile web, 360–430 CSS pixels wide  
**Secondary platform:** Tablet and desktop, without regressions

## Purpose

Make MetroBOT feel like a focused, trustworthy mobile navigation product. The map and trip-planning action must be immediately understandable, while the conversational assistant remains available as a secondary, contextual capability.

The redesign preserves the existing route calculation, Gemini integration, live Metro status, favorites, navigation hook, map data, and route cards. It changes information hierarchy, panel behavior, copy, and mobile presentation.

## Product Principles

1. **Map first:** the map is the primary surface whenever the user is not reading route details.
2. **One obvious next action:** the first screen asks “¿A dónde vas?” and does not require understanding the chat interface.
3. **Progressive disclosure:** advanced filters, support information, system status, and MetroBot chat appear only when requested or contextually relevant.
4. **Navigation over conversation:** route planning and turn guidance receive visual priority over general assistant messages.
5. **Honest status:** loading, unverified information, degraded route evidence, location errors, and live-service uncertainty remain explicit.
6. **Thumb-friendly mobile UI:** primary controls stay reachable, respect safe areas, and provide at least a 44 × 44 CSS pixel target.

## Scope

### Included

- Redesign the initial mobile screen around the map and destination action.
- Consolidate the bottom sheet into one state system with deterministic compact, planning, results, and expanded states.
- Move chat from the default dominant surface into a secondary assistant surface.
- Present origin and destination planning as a dedicated, focused flow.
- Improve route-results hierarchy and navigation entry.
- Simplify map controls and prevent collisions with the bottom sheet.
- Move the articulated-bus experiment toggle out of the persistent composer area.
- Correct Spanish copy, punctuation, accents, and labels.
- Improve responsive layout, safe-area handling, touch targets, focus behavior, and screen-reader labels.
- Add automated regression coverage for the new UI state model.
- Validate the final interface at representative mobile viewport sizes.

### Excluded

- Changes to routing algorithms, route datasets, station data, or integrated-bus compilation.
- Replacement of Leaflet, OpenStreetMap, Gemini, OSRM, or the navigation engine.
- Real-time vehicle tracking.
- A new account system or cloud-synced preferences.
- Desktop-only redesign work beyond preserving a coherent responsive layout.

## Recommended Approach

Use a map-first adaptive bottom sheet backed by a single explicit UI state model.

This approach reuses the current map, search, chat, route cards, and navigation capabilities while removing the duplicate panel state currently present in `App.tsx`. It avoids a permanent Map/Chat tab bar and avoids rebuilding the product as a chat-first assistant.

Alternatives considered:

- **Refined chat-first layout:** lowest implementation cost, but continues to hide the map and makes trip planning feel indirect.
- **Permanent Map/Chat tabs:** provides explicit modes, but adds navigation overhead and fragments a journey that should flow naturally from search to route to guidance.

## Mobile Information Architecture

### 1. Explore State

This is the initial state.

- The map occupies the available viewport.
- A top destination control displays “¿A dónde vas?” without truncation.
- Only essential map controls remain visible: locate, theme/layers entry, and map zoom when appropriate.
- A compact bottom sheet displays:
  - MetroBot identity and online/availability language without claiming live transit certainty.
  - Primary action: “Planear un viaje”.
  - Secondary action: “Pregúntale a MetroBot”.
- The initial conversational greeting bubble is not shown as a large chat message.
- Favorites or recent destinations may appear as compact chips only when data exists and does not cover critical map controls.

### 2. Planning State

Opened by tapping the destination control, “Planear un viaje”, a map point, or a favorite.

- The sheet expands to a focused planner.
- Origin and destination fields are clearly labeled.
- The origin supports current location, map selection, favorites, and typed search.
- The destination supports map selection, favorites, and typed search.
- A swap control is available only when both fields have usable coordinates.
- Search results are keyboard accessible and visually associated with the active field.
- A single primary action requests routes once both endpoints are valid.
- Advanced options contain the articulated-bus preference; it is not permanently visible in the main UI.

### 3. Loading State

- The sheet remains expanded enough to preserve context.
- A concise progress message states that routes are being calculated.
- Existing route results are cleared only when a new route request is accepted.
- The user can cancel or revise origin and destination without losing map visibility.
- Loading animation respects `prefers-reduced-motion`.

### 4. Results State

- The sheet opens high enough to read route summaries while leaving meaningful map context.
- The selected route is visually tied to the highlighted map polyline.
- Each route summary prioritizes:
  1. total travel time,
  2. arrival or duration context,
  3. modes and transfers,
  4. walking burden,
  5. validation status.
- “Iniciar navegación” is the dominant action on the selected route.
- Validation and uncertainty language remains visible but concise; detailed explanations are progressively disclosed.
- Switching route cards updates the map without accidentally starting navigation.
- The user can collapse the sheet to compare route geometry on the map.

### 5. Assistant State

- MetroBot opens as an explicit secondary surface from “Pregúntale a MetroBot”.
- The assistant retains message history during the current session.
- Suggested prompts help users ask useful mobility questions.
- The composer remains above the keyboard and safe-area inset.
- Route results produced through chat transition into the same Results State rather than creating a parallel route-results experience.
- Support, fares, and live Metro status are grouped under a clearly labeled information entry, not mixed into the primary trip flow.

### 6. Navigation State

- The bottom sheet collapses automatically to a compact navigation-safe height.
- The navigation cue is the strongest visual element.
- The map follows the user according to the existing navigation logic.
- Controls include recenter, overview, mute when available, and “Finalizar”.
- Location acquisition, recalculation, arrival, and errors use explicit language.
- Assistant and nonessential map controls do not obscure the maneuver cue.

## Bottom-Sheet State Model

The interface uses one source of truth instead of separate `sheet.currentSnap`, `sheetHeight`, touch state, and fractional drag state.

Required semantic states:

- `explore`
- `planning`
- `loading`
- `results`
- `assistant`
- `navigation`

Each semantic state maps to an allowed mobile sheet presentation:

| State | Default presentation | User adjustment |
| --- | --- | --- |
| Explore | compact | open planning or assistant |
| Planning | expanded | collapse to map or return |
| Loading | expanded | revise/cancel request |
| Results | medium-high | compact, medium-high, expanded |
| Assistant | expanded | compact or close |
| Navigation | compact | temporary route overview |

Dragging and tapping the handle update the same model. Programmatic transitions, such as receiving routes or starting navigation, use the same transition API. Desktop renders the content in a side panel without changing the semantic state.

## Component Boundaries

### `App.tsx`

Coordinates application data and transitions only. It must not implement low-level pointer math or duplicate sheet state.

### Mobile shell

A focused component owns the responsive map/sheet composition, safe areas, and semantic surface selection.

### Trip planner

Owns origin/destination presentation, active-field state, swap behavior, and the route-request action. It consumes the existing search and map-selection callbacks.

### Assistant panel

Owns chat history presentation, suggested prompts, support-information entry, and composer layout. It does not own route computation.

### Sheet state helper/hook

Defines valid semantic transitions and maps them to visual presentations. Pure transition logic is independently testable.

### Existing map and route components

Remain responsible for map rendering, markers, polylines, route details, and navigation overlay. Their mobile positioning and accessible labels may be refined.

## Visual System

- Retain SITVA green as the primary action color and existing transit-mode colors.
- Use neutral white/slate surfaces with restrained elevation.
- Reserve strong color for current location, active route, primary action, and real alerts.
- Avoid simultaneous floating circles with equal visual weight.
- Use a consistent 8-point spacing rhythm.
- Use 16 px minimum input text on mobile to prevent iOS zoom.
- Use concise labels rather than uppercase instructional text.
- Maintain light and dark themes with WCAG AA contrast for normal text.
- Avoid decorative animation during navigation and honor reduced-motion preferences everywhere.

## Copy

Required primary labels:

- “¿A dónde vas?”
- “Planear un viaje”
- “Pregúntale a MetroBot”
- “Usar mi ubicación”
- “Seleccionar en el mapa”
- “Ver rutas”
- “Iniciar navegación”
- “Finalizar navegación”
- “Información del sistema”

The welcome copy, when the assistant opens, is:

> ¡Hola! Soy MetroBot. Puedo ayudarte a planear tu viaje por Medellín o responder preguntas sobre el SITVA.

All user-facing Spanish must include correct accents and punctuation. Experimental or internal language such as “ON”, “OFF”, “probando” or implementation terminology must not appear in the default experience.

## Accessibility and Mobile Ergonomics

- Interactive targets are at least 44 × 44 CSS pixels.
- Every icon-only control has a unique accessible name.
- Map markers that are interactive expose a meaningful station or mode label.
- The bottom sheet exposes its title, state, and expansion status.
- Focus moves into planning or assistant content when opened and returns to the triggering control when closed.
- New assistant messages and navigation cues use appropriate noninterruptive live regions.
- Route selection is available without relying on a wrapper `div` click.
- Focus indicators remain visible in light, dark, and increased-contrast modes.
- The layout supports 360 × 640 through 430 × 932 CSS pixel viewports without clipped primary actions.
- Safe-area insets protect controls on devices with notches and home indicators.
- The software keyboard must not hide the active field, search results, or chat composer.

## Error and Empty States

- Location denied: explain how to continue by selecting a point on the map.
- Location timeout: offer retry and manual selection.
- Search empty: show useful recent/favorite actions rather than an empty large panel.
- Search with no result: preserve the typed query and invite refinement.
- Route calculation failure: keep origin and destination and offer retry.
- Route evidence degraded: show concise uncertainty on the affected route.
- Gemini unavailable: retain manual route planning and state that the assistant is temporarily unavailable.
- Live Metro status unavailable: display “No verificado” and never infer normal operation.

## Testing Strategy

### Automated

- Pure transition tests cover every valid semantic surface transition and prevent impossible combinations.
- Regression tests cover initial explore state, route loading/results transitions, assistant opening/closing, and navigation collapse.
- Existing route, navigation, live-status, PWA, and data tests remain unchanged and passing.
- TypeScript lint and production build must pass.

### Browser validation

Validate at:

- 360 × 800
- 390 × 844
- 430 × 932

For each viewport verify:

- destination action is fully readable,
- map remains usable,
- compact sheet does not obscure essential controls,
- planning and assistant inputs remain visible with the software-keyboard-sized viewport,
- no horizontal overflow,
- primary controls meet touch-target requirements,
- route results and navigation overlay do not collide,
- light and dark modes retain readable contrast.

## Acceptance Criteria

1. A first-time mobile user can identify how to plan a trip within five seconds without reading a chat message.
2. The initial view dedicates the majority of usable height to the map.
3. Chat is available in one tap but does not dominate the initial state.
4. Only one bottom-sheet state system exists in production code.
5. The articulated-bus preference is available under planning options and absent from the persistent main composer.
6. Starting navigation collapses the sheet and leaves maneuver guidance unobstructed.
7. All primary mobile controls are at least 44 × 44 CSS pixels.
8. User-facing Spanish in the redesigned surfaces uses correct accents and punctuation.
9. The layout passes the three defined mobile viewport checks without clipped primary controls or horizontal overflow.
10. Existing routing, Gemini, status, map, and navigation behavior remains functionally available.
