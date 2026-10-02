import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StationDetails } from '../src/components/Map/StationDetails';

test('station card labels source, scheduled boarding and bicycle data limitations', () => {
  const html = renderToStaticMarkup(<StationDetails stop={{
    id: 'bike', name: 'Universidad', lat: 6.26, lng: -75.56, mode: 'encicla',
    station: { id: 'bike', nombre: 'Universidad', lat: 6.26, lng: -75.56, sistema: 'EnCicla', linea: 'Bicis', capacity: 33, address: 'Calle 73' },
    visits: [{ role: 'Sube aquí', time: '2026-09-30T13:25:00Z', stepIndex: 0 }],
  }} nearby={[]} source="google" />);
  assert.match(html, /Calle 73/);
  assert.match(html, /33/);
  assert.match(html, /no es disponibilidad en tiempo real/i);
  assert.match(html, /08:25/);
  assert.match(html, /Google Maps/);
  assert.match(html, /Catálogo local/);
});
