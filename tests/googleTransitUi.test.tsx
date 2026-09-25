import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouteCard } from '../src/components/RouteCards/RouteCard';
import { buildShareText } from '../src/lib/share';
import type { RouteOption } from '../src/lib/routing';

const route: RouteOption = {
  id: 'google-0', source: 'google', cost: -1, duration: 41, transfers: 0, modes: ['walk', 'bus'],
  userOrigin: { lat: 6.25, lng: -75.57, name: 'Origen' }, userDest: { lat: 6.28, lng: -75.59, name: 'Destino' },
  steps: [{ mode: 'bus', instruction: 'Toma el bus', duration: 30, transit: {
    departureStop: 'Universidad', arrivalStop: 'Robledo', departureTime: '2026-09-25T13:25:00Z',
    agencies: [{ name: 'Operador', uri: 'https://example.org' }],
  } }],
};
test('Google card attributes data and offers external transit navigation, never OSRM navigation', () => {
  const html = renderToStaticMarkup(<RouteCard route={route} onStartNav={() => {}} />);
  assert.match(html, /Google Maps/);
  assert.match(html, /Costo sin confirmar/);
  assert.match(html, /Universidad/);
  assert.match(html, /08:25/);
  assert.match(html, /travelmode=transit/);
  assert.doesNotMatch(html, /Iniciar navegación/);
});
test('sharing Google trips provides an attributed live link rather than a stale itinerary or negative fare', () => {
  const text = buildShareText(route, 'Origen', 'Destino');
  assert.match(text, /Google Maps/);
  assert.match(text, /travelmode=transit/);
  assert.doesNotMatch(text, /-1|41 min/);
});
