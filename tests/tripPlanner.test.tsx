import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TripPlannerPanel } from '../src/components/TripPlannerPanel';

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
