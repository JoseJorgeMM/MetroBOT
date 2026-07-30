import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  acceptSearchResult,
  canSubmitRoute,
  getBusPreference,
  swapPlaces,
  syncQueryForPlaceChange,
  TripPlannerPanel,
  type PlaceValue,
} from '../src/components/TripPlannerPanel';
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

test('planner submits only valid, idle endpoints and renders an enabled route action', () => {
  assert.equal(canSubmitRoute(origin, destination, false), true);
  assert.equal(canSubmitRoute(origin, destination, true), false);
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

test('planner swaps endpoints and forwards the selected bus preference', () => {
  assert.deepEqual(swapPlaces(origin, destination), { origin: destination, destination: origin });
  assert.equal(getBusPreference(false), false);
  assert.equal(getBusPreference(true), true);
});

test('search results only publish and select for their current field and generation', () => {
  const current = { field: 'destination' as const, generation: 4 };
  assert.equal(acceptSearchResult({ field: 'origin', generation: 3 }, current), false);
  assert.equal(acceptSearchResult({ field: 'destination', generation: 3 }, current), false);
  assert.equal(acceptSearchResult({ field: 'destination', generation: 4 }, current), true);
});

test('editing a selected endpoint keeps typed text until a real external clear arrives', () => {
  assert.equal(syncQueryForPlaceChange('Casa nueva', origin, null, true), 'Casa nueva');
  assert.equal(syncQueryForPlaceChange('Casa nueva', origin, null, false), '');
  assert.equal(syncQueryForPlaceChange('Casa nueva', null, destination, true), 'Trabajo');
});

test('planner exposes 44px favorite controls for selected endpoints', () => {
  const html = renderToStaticMarkup(<TripPlannerPanel {...baseProps} origin={origin} />);
  assert.match(html, /aria-label="Guardar origen en favoritos"[^>]*h-11 w-11/);
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
