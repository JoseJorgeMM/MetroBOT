import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServiceStatusView } from '../src/components/ServiceStatusView';
import { LINE_IDS, type ServiceSnapshot } from '../src/lib/serviceStatus';

const now = Date.now();
const snapshot: ServiceSnapshot = { availability: 'available', checkedAt: new Date(now).toISOString(), expiresAt: new Date(now + 300000).toISOString(), sourceUpdatedAt: null,
  lines: LINE_IDS.map(id => ({ id, status: id === 'L' ? 'suspended' : 'normal', message: id === 'L' ? 'Fuera de servicio - Baja' : 'Normal' })) };
test('home lists official line warning and states the station and publication limitations', () => {
  const html = renderToStaticMarkup(<ServiceStatusView snapshot={snapshot} />);
  assert.match(html, /Línea L/); assert.match(html, /Fuera de servicio/);
  assert.match(html, /no identifica estaciones/i); assert.match(html, /no informa la hora/i);
  assert.match(html, /metrodemedellin.gov.co/); assert.match(html, /instagram.com\/metrodemedellin/);
});
test('route warning only refers to matched lines and exposes unmonitored segments', () => {
  const html = renderToStaticMarkup(<ServiceStatusView snapshot={snapshot} route={{ steps: [{ mode: 'metro', line: 'A' }, { mode: 'bus', line: '260-2' }] } as any} />);
  assert.doesNotMatch(html, /Línea L|Fuera de servicio/);
  assert.match(html, /tramos sin cobertura/i); assert.match(html, /Línea A/);
});
test('expired evidence and failures cannot render a normal or suspended state as current', () => {
  for (const value of [null, { ...snapshot, expiresAt: new Date(now - 1).toISOString() }]) {
    const html = renderToStaticMarkup(<ServiceStatusView snapshot={value} />);
    assert.match(html, /Estado no verificado/); assert.doesNotMatch(html, /Fuera de servicio|>Normal</);
  }
});
test('upstream text is escaped instead of rendered as HTML', () => {
  const data = { ...snapshot, lines: snapshot.lines.map(l => ({ ...l, message: '<script>alert(1)</script>' })) };
  const html = renderToStaticMarkup(<ServiceStatusView snapshot={data} />);
  assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
});
