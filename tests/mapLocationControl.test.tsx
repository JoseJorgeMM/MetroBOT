import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MapLocationControl,
  requestMapLocation,
  type GeolocationSource,
  type LeafletMapLocationTarget,
} from '../src/components/Map/MapLocationControl';

test('the mounted map location control exposes its accessible label', () => {
  const html = renderToStaticMarkup(<MapLocationControl />);

  assert.match(html, /aria-label="Ubicarme en el mapa"/);
});

test('requestMapLocation flies the current map to the first GPS fix and notifies the control', () => {
  let flownTo: { center: [number, number]; zoom: number; animate: boolean } | null = null;
  let receivedFix: { lat: number; lng: number } | null = null;
  const map: LeafletMapLocationTarget = {
    getZoom: () => 13,
    flyTo: (center, zoom, options) => {
      flownTo = { center, zoom, animate: options?.animate === true };
    },
  };
  const geolocation: GeolocationSource = {
    getCurrentPosition: (onSuccess) => onSuccess({ coords: { latitude: 6.2442, longitude: -75.5812 } }),
  };

  requestMapLocation(map, (fix) => { receivedFix = fix; }, undefined, geolocation);

  assert.deepEqual(flownTo, { center: [6.2442, -75.5812], zoom: 16, animate: true });
  assert.deepEqual(receivedFix, { lat: 6.2442, lng: -75.5812 });
});

test('requestMapLocation reports browser geolocation errors to the control', () => {
  let errored = false;
  const geolocation: GeolocationSource = {
    getCurrentPosition: (_onSuccess, onError) => onError?.(new Error('denied')),
  };

  requestMapLocation(null, () => {}, () => { errored = true; }, geolocation);

  assert.equal(errored, true);
});
