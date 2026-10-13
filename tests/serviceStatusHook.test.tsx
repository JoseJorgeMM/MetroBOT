import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { SystemStatus } from '../src/components/SystemStatus';
import { LINE_IDS } from '../src/lib/serviceStatus';

test('mounted panels share a request, expand details and discard expired state on reconnect', async t => {
  const window = new Window();
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  let time = Date.now(), offline = false, calls = 0;
  t.mock.method(Date, 'now', () => time);
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (offline) throw Error('offline');
    return Response.json({ availability: 'available', checkedAt: new Date(time).toISOString(), expiresAt: new Date(time + 300000).toISOString(), sourceUpdatedAt: null,
      lines: LINE_IDS.map(id => ({ id, status: id === 'L' ? 'suspended' : 'normal', message: id === 'L' ? 'Fuera de servicio - Baja' : 'Normal' })) });
  });
  const container = window.document.createElement('div');
  const root = createRoot(container as unknown as HTMLElement);
  try {
    await act(async () => { root.render(<><SystemStatus /><SystemStatus /></>); });
    assert.equal(calls, 1);
    assert.match(container.textContent, /Fuera de servicio/);
    const details = container.querySelector('details')!;
    details.querySelector('summary')!.click();
    assert.equal(details.open, true);
    assert.equal(details.querySelectorAll('li').length, 12);
    offline = true; time += 300001;
    await act(async () => { window.dispatchEvent(new window.Event('online')); });
    assert.equal(calls, 2);
    assert.match(container.textContent, /Estado no verificado/);
    assert.doesNotMatch(container.textContent, /Fuera de servicio/);
  } finally {
    await act(() => root.unmount());
    await window.happyDOM.abort();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
