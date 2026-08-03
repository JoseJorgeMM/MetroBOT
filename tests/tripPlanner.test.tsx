import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TripPlannerPanel, type PlaceValue } from '../src/components/TripPlannerPanel';
import { createPlannerState, transitionPlanner } from '../src/components/plannerState';
import {
  acceptMapSelectionTap,
  beginMapSelection,
  canDeliverMapSelection,
  createMapSelectionState,
  placeFromReverseGeocode,
} from '../src/components/Map/mapSelectionLogic';

const origin: PlaceValue = { lat: 6.25, lng: -75.57, name: 'Casa' };
const destination: PlaceValue = { lat: 6.27, lng: -75.55, name: 'Trabajo' };

const baseProps = {
  origin: null,
  destination: null,
  busesEnabled: true,
  isLoading: false,
  onOriginChange: () => {},
  onDestinationChange: () => {},
  onBusesEnabledChange: () => {},
  onRequestMapSelection: () => {},
  onSubmit: () => {},
  onClose: () => {},
};

test('planner labels origin and destination and offers current location', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} />);
  assert.match(html, /Origen/);
  assert.match(html, /Destino/);
  assert.match(html, /Usar mi ubicación/);
  assert.match(html, /Seleccionar en el mapa/);
});

test('route action is disabled until both endpoints are valid', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} />);
  assert.match(html, /<button[^>]*disabled[^>]*>[^<]*Ver rutas/);
});

test('articulated buses are disclosed under advanced options', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} />);
  assert.match(html, /Opciones de viaje/);
  assert.match(html, /Incluir buses articulados/);
  assert.doesNotMatch(html, />ON</);
  assert.doesNotMatch(html, />OFF</);
});

test('planner renders an enabled route action for valid endpoints', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} origin={origin} destination={destination} />);
  assert.match(html, /<button type="button"[^>]*>Ver rutas<\/button>/);
  assert.doesNotMatch(html, /<button[^>]*\sdisabled(?:=""|(?=\s|>))[^>]*>Ver rutas/);
});

test('planner uses 16px mobile inputs, 44px clear controls, and a 44px advanced-options summary', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} origin={origin} destination={destination} />);
  assert.match(html, /<input[^>]*class="[^"]*text-base/);
  assert.match(html, /aria-label="Limpiar origen"[^>]*h-11 w-11/);
  assert.match(html, /<summary[^>]*min-h-11[^>]*>Opciones de viaje/);
});

test('planner avoids a duplicate visible title and keeps the location action legible in dark mode', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} />);
  assert.match(html, /<h2 class="sr-only">Planificar viaje<\/h2>/);
  assert.match(html, /<button[^>]*class="[^"]*dark:text-blue-300[^"]*"[^>]*>[\s\S]*Usar mi ubicación/);
});

test('planner controller invalidates an edit, schedules debounce, preserves text, and emits callbacks', () => {
  const initial = createPlannerState({ origin, destination: null, busesEnabled: true });
  const edited = transitionPlanner(initial, { type: 'input', field: 'origin', value: 'Casa nueva' });
  assert.equal(edited.state.origin, null);
  assert.equal(edited.state.originQuery, 'Casa nueva');
  assert.deepEqual(edited.state.search, { field: 'origin', generation: 1 });
  assert.equal(edited.state.loading, false);
  assert.deepEqual(edited.effects, [
    { type: 'place-change', field: 'origin', place: null },
    { type: 'schedule-search', query: 'Casa nueva', request: { field: 'origin', generation: 1 }, delayMs: 600 },
  ]);

  const synced = transitionPlanner(edited.state, { type: 'sync-place', field: 'origin', place: null });
  assert.equal(synced.state.originQuery, 'Casa nueva');

  const buses = transitionPlanner(synced.state, { type: 'set-buses-enabled', busesEnabled: false });
  assert.equal(buses.state.busesEnabled, false);
  assert.deepEqual(buses.effects, [{ type: 'buses-enabled-change', busesEnabled: false }]);
});

test('planner controller swaps endpoints and emits both endpoint callbacks', () => {
  const swapped = transitionPlanner(createPlannerState({ origin, destination, busesEnabled: true }), { type: 'swap-endpoints' });
  assert.deepEqual(swapped.state.origin, destination);
  assert.deepEqual(swapped.state.destination, origin);
  assert.deepEqual(swapped.effects, [
    { type: 'cancel-search' },
    { type: 'place-change', field: 'origin', place: destination },
    { type: 'place-change', field: 'destination', place: origin },
  ]);
});

test('planner controller wires map selection, valid submit, and close callbacks', () => {
  const initial = createPlannerState({ origin, destination, busesEnabled: true });
  assert.deepEqual(transitionPlanner(initial, { type: 'request-map-selection' }).effects, [
    { type: 'request-map-selection', field: 'origin' },
  ]);
  assert.deepEqual(transitionPlanner(initial, { type: 'submit' }).effects, [{ type: 'submit' }]);
  assert.deepEqual(transitionPlanner(initial, { type: 'close' }).effects, [{ type: 'close' }]);
  assert.deepEqual(
    transitionPlanner(createPlannerState({ origin, destination: null, busesEnabled: true }), { type: 'submit' }).effects,
    [],
  );
});

test('planner controller resolves and fails current location without leaving loading active', () => {
  const started = transitionPlanner(createPlannerState({ origin: null, destination: null, busesEnabled: true }), { type: 'begin-current-location', field: 'origin' });
  assert.equal(started.state.loading, true);
  assert.deepEqual(started.state.currentLocation, { field: 'origin', generation: 1 });

  const resolved = transitionPlanner(started.state, { type: 'current-location-success', token: started.state.currentLocation!, place: origin });
  assert.equal(resolved.state.loading, false);
  assert.deepEqual(resolved.state.origin, origin);
  assert.deepEqual(resolved.effects, [{ type: 'place-change', field: 'origin', place: origin }]);

  const retry = transitionPlanner(resolved.state, { type: 'begin-current-location', field: 'destination' });
  const failed = transitionPlanner(retry.state, { type: 'current-location-failure', token: retry.state.currentLocation! });
  assert.equal(failed.state.loading, false);
  assert.equal(failed.state.destination, null);
});

test('origin settlement cannot clear or publish over the destination search', () => {
  const typed = transitionPlanner(createPlannerState({ origin: null, destination: null, busesEnabled: true }), { type: 'input', field: 'origin', value: 'Parque' });
  const originRequest = typed.state.search!;
  const started = transitionPlanner(typed.state, { type: 'begin-search', request: originRequest });
  assert.equal(started.state.loading, true);

  const switched = transitionPlanner(started.state, { type: 'focus-field', field: 'destination' });
  assert.equal(switched.state.loading, false);
  const destinationTyped = transitionPlanner(switched.state, { type: 'input', field: 'destination', value: 'Museo' });
  const destinationRequest = destinationTyped.state.search!;
  const destinationStarted = transitionPlanner(destinationTyped.state, { type: 'begin-search', request: destinationRequest });
  assert.equal(destinationStarted.state.loading, true);

  const stale = transitionPlanner(destinationStarted.state, { type: 'settle-search', request: originRequest, results: [{ place_id: 'old', lat: '6.2', lon: '-75.5', display_name: 'Parque, Medellín' }] });
  assert.equal(stale.state.activeField, 'destination');
  assert.equal(stale.state.loading, true);
  assert.deepEqual(stale.state.results, []);

  const current = transitionPlanner(stale.state, { type: 'settle-search', request: destinationRequest, results: [{ place_id: 'new', lat: '6.3', lon: '-75.6', display_name: 'Museo, Medellín' }] });
  assert.equal(current.state.loading, false);
  assert.deepEqual(current.state.results, [{ place_id: 'new', lat: '6.3', lon: '-75.6', display_name: 'Museo, Medellín' }]);
});

test('clearing a field synchronously clears loading and ignores its stale search settlement', () => {
  const typed = transitionPlanner(createPlannerState({ origin: null, destination: null, busesEnabled: true }), { type: 'input', field: 'origin', value: 'Museo' });
  const request = typed.state.search!;
  const started = transitionPlanner(typed.state, { type: 'begin-search', request });
  const cleared = transitionPlanner(started.state, { type: 'input', field: 'origin', value: '' });
  assert.equal(cleared.state.loading, false);
  const stale = transitionPlanner(cleared.state, { type: 'settle-search', request, results: [{ place_id: 'old', lat: '6.2', lon: '-75.5', display_name: 'Museo, Medellín' }] });
  assert.equal(stale.state.loading, false);
  assert.deepEqual(stale.state.results, []);
});

test('only the newest query publishes results and clears its own loading state', () => {
  const firstTyped = transitionPlanner(createPlannerState({ origin: null, destination: null, busesEnabled: true }), { type: 'input', field: 'origin', value: 'A' });
  const firstRequest = firstTyped.state.search!;
  const firstStarted = transitionPlanner(firstTyped.state, { type: 'begin-search', request: firstRequest });
  const secondTyped = transitionPlanner(firstStarted.state, { type: 'input', field: 'origin', value: 'B' });
  const secondRequest = secondTyped.state.search!;
  const secondStarted = transitionPlanner(secondTyped.state, { type: 'begin-search', request: secondRequest });
  const firstSettled = transitionPlanner(secondStarted.state, { type: 'settle-search', request: firstRequest, results: [{ place_id: 'a', lat: '6.2', lon: '-75.5', display_name: 'A, Medellín' }] });
  assert.equal(firstSettled.state.loading, true);
  assert.deepEqual(firstSettled.state.results, []);

  const secondSettled = transitionPlanner(firstSettled.state, { type: 'settle-search', request: secondRequest, results: [{ place_id: 'b', lat: '6.3', lon: '-75.6', display_name: 'B, Medellín' }] });
  assert.equal(secondSettled.state.loading, false);
  assert.deepEqual(secondSettled.state.results, [{ place_id: 'b', lat: '6.3', lon: '-75.6', display_name: 'B, Medellín' }]);
});

test('current published result selection updates the endpoint and emits its callback', () => {
  const typed = transitionPlanner(createPlannerState({ origin: null, destination: null, busesEnabled: true }), { type: 'input', field: 'destination', value: 'Trabajo' });
  const request = typed.state.search!;
  const started = transitionPlanner(typed.state, { type: 'begin-search', request });
  const settled = transitionPlanner(started.state, { type: 'settle-search', request, results: [{ place_id: 'work', lat: '6.27', lon: '-75.55', display_name: 'Trabajo, Medellín' }] });
  const selected = transitionPlanner(settled.state, { type: 'select-search-result', request, place: destination });
  assert.deepEqual(selected.state.destination, destination);
  assert.equal(selected.state.destinationQuery, 'Trabajo');
  assert.deepEqual(selected.effects, [
    { type: 'cancel-search' },
    { type: 'place-change', field: 'destination', place: destination },
  ]);
});

test('map selection accepts one tap, rejects stale generations, and retains fallback coordinates', () => {
  const active = createMapSelectionState('origin');
  const firstTap = acceptMapSelectionTap(active);
  assert.ok(firstTap);
  assert.equal(acceptMapSelectionTap(firstTap.state), null);

  const newerMode = beginMapSelection(firstTap.state, 'destination');
  assert.equal(canDeliverMapSelection(newerMode, firstTap.attempt), false);
  assert.deepEqual(placeFromReverseGeocode(6.2442, -75.5812, undefined), {
    lat: 6.2442,
    lng: -75.5812,
    name: 'Punto seleccionado',
  });
});
