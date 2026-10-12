import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { TransferEvaluation } from '../src/components/Journey/TransferEvaluation';

const download = 'Descargar observaciones JSON';
const clear = 'Borrar observaciones';
const choices = ['No fue claro', 'Necesité ayuda', 'Me resultó útil'];

async function mount(t: TestContext) {
  const win = new Window({ url: 'https://metro.test' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: win, document: win.document, navigator: win.navigator,
    localStorage: win.localStorage, sessionStorage: win.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const container = win.document.createElement('div');
  win.document.body.append(container);
  const root = createRoot(container as unknown as Element);
  const blobs: Blob[] = [];
  const clicked: { href: string; download: string }[] = [];
  const uuid = t.mock.method(crypto, 'randomUUID');
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('Evaluation must not transmit data');
  });
  const storage = [win.localStorage, win.sessionStorage].flatMap(store =>
    (['getItem', 'setItem'] as const).map(method => t.mock.method(store, method)));
  t.mock.method(URL, 'createObjectURL', (blob: Blob) => {
    blobs.push(blob);
    return `blob:https://metro.test/evaluation-${blobs.length}`;
  });
  const revoke = t.mock.method(URL, 'revokeObjectURL', () => {});
  t.mock.method(win.HTMLAnchorElement.prototype, 'click', function () {
    clicked.push({ href: this.href, download: this.download });
  });
  t.after(async () => {
    await act(() => root.unmount());
    t.mock.timers.reset();
    await win.happyDOM.abort();
    for (const [key, value] of previous) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
    assert.equal(fetch.mock.callCount(), 0);
    for (const method of storage) assert.equal(method.mock.callCount(), 0);
  });
  const button = (text: string) => {
    const found = [...container.querySelectorAll('button')].find(node => node.textContent === text);
    assert.ok(found, `Missing button: ${text}`);
    assert.equal(found.type, 'button', 'Actions must not submit a surrounding form');
    return found;
  };
  const select = (label: string) => {
    const found = [...container.querySelectorAll('select')].find(node =>
      [...node.labels].some(item => item.textContent?.startsWith(label)));
    assert.ok(found, `Missing labelled select: ${label}`);
    return found;
  };
  const choose = async (label: string, value: string) => {
    const node = select(label);
    assert.equal(node.disabled, false);
    await act(() => {
      node.value = value;
      node.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
  };
  const click = async (text: string) => { await act(() => button(text).click()); };
  const consent = async () => {
    const checkbox = [...container.querySelectorAll('input')].find(input => input.type === 'checkbox');
    assert.ok(checkbox);
    assert.equal(checkbox.labels[0].textContent, 'Participar en la evaluación local');
    await act(() => checkbox.click());
  };
  const report = async () => {
    const count = blobs.length;
    await click(download);
    assert.equal(blobs.length, count + 1);
    assert.equal(blobs.at(-1)!.type, 'application/json');
    return JSON.parse(await blobs.at(-1)!.text());
  };
  await act(() => root.render(<React.StrictMode><TransferEvaluation catalogVersion={1} /></React.StrictMode>));
  return { container, root, button, select, choose, click, consent, report, blobs, clicked, uuid, revoke };
}

test('consent is voluntary, defaults to practice/unassigned and exports only the v2 contract', async t => {
  const ui = await mount(t);
  assert.equal(ui.uuid.mock.callCount(), 0);
  assert.equal(ui.button(download).disabled, true);
  assert.equal(ui.button(clear).disabled, true);
  for (const text of choices) {
    const button = [...ui.container.querySelectorAll('button')].find(node => node.textContent === text);
    assert.ok(!button || button.disabled);
  }
  assert.match(ui.container.textContent, /0 observaciones en esta sesión\. No equivalen a personas diferentes\./);
  await ui.consent();
  assert.equal(ui.uuid.mock.callCount(), 1);
  assert.equal(ui.select('Contexto').value, 'practice');
  assert.equal(ui.select('Fase').value, 'unassigned');
  assert.equal(ui.select('Momento evaluado').value, 'connection');
  await ui.click('Necesité ayuda');
  const report = await ui.report();
  assert.match(report.sessionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(report.sessionId, ui.uuid.mock.calls[0].result);
  assert.deepEqual(report, {
    schemaVersion: 2, pilot: 'san-antonio-a-b', sessionId: report.sessionId,
    catalogVersion: 1, context: 'practice', phase: 'unassigned',
    observations: [{ stage: 'connection', kind: 'help-needed' }],
  });
  assert.match(ui.container.textContent, /1 observaciones en esta sesión\. No equivalen a personas diferentes\./);
  assert.equal(ui.container.querySelector('textarea, input[type="text"], input[type="file"]'), null);
});

test('labels explain declared field context and descriptive reference/assisted phases', async t => {
  const ui = await mount(t);
  await ui.consent();
  assert.match(ui.container.textContent, /campo.*declarad[oa].*no verificado/i);
  assert.match(ui.container.textContent, /no (?:permiten inferir|infieren|implican) causalidad/i);
  assert.match(ui.container.textContent, /sin fotos, texto, GPS ni (?:identidad|datos personales)/i);
  assert.match(ui.select('Fase').textContent, /Referencia.*sin (?:uso del )?asistente/i);
  assert.match(ui.select('Fase').textContent, /Asistida.*con (?:uso del )?asistente/i);
  assert.deepEqual([...ui.select('Momento evaluado').options].map(option => [option.value, option.textContent]), [
    ['connection', 'Comprender conexión'], ['sign', 'Comprobar señal'],
  ]);
  await ui.choose('Contexto', 'field');
  await ui.choose('Fase', 'baseline');
  await ui.choose('Fase', 'assisted');
  assert.equal(ui.uuid.mock.callCount(), 1, 'Category changes must preserve the consent ID');
  await ui.click('Me resultó útil');
  const report = await ui.report();
  assert.equal(report.context, 'field');
  assert.equal(report.phase, 'assisted');
  assert.equal(report.sessionId, ui.uuid.mock.calls[0].result);
});

test('first observation locks context/phase until clearing while stage stays editable', async t => {
  const ui = await mount(t);
  await ui.consent();
  await ui.choose('Contexto', 'field');
  await ui.choose('Fase', 'baseline');
  await ui.click('No fue claro');
  assert.equal(ui.select('Contexto').disabled, true);
  assert.equal(ui.select('Fase').disabled, true);
  await ui.choose('Momento evaluado', 'sign');
  await ui.click('Necesité ayuda');
  const first = await ui.report();
  const second = await ui.report();
  assert.deepEqual(second, first);
  assert.equal(first.context, 'field');
  assert.equal(first.phase, 'baseline');
  assert.equal(ui.uuid.mock.callCount(), 1);
  await ui.click(clear);
  assert.equal(ui.button(download).disabled, true);
  assert.equal(ui.select('Contexto').disabled, false);
  assert.equal(ui.select('Fase').disabled, false);
  await ui.choose('Contexto', 'practice');
  await ui.choose('Fase', 'unassigned');
  await ui.click('Me resultó útil');
  const fresh = await ui.report();
  assert.notEqual(fresh.sessionId, first.sessionId);
  assert.deepEqual(fresh.observations, [{ stage: 'sign', kind: 'useful' }]);
});

test('records at most six unique stage/kind pairs including repeated rapid clicks', async t => {
  const ui = await mount(t);
  await ui.consent();
  for (const stage of ['connection', 'sign']) {
    await ui.choose('Momento evaluado', stage);
    for (const text of choices) {
      await act(() => { ui.button(text).click(); ui.button(text).click(); });
      assert.equal(ui.button(text).disabled, true);
      await ui.click(text);
    }
  }
  const first = await ui.report();
  assert.deepEqual(first.observations, ['connection', 'sign'].flatMap(stage =>
    ['unclear', 'help-needed', 'useful'].map(kind => ({ stage, kind }))));
  assert.match(ui.container.textContent, /6 observaciones en esta sesión\. No equivalen a personas diferentes\./);
  await ui.choose('Momento evaluado', 'connection');
  for (const text of choices) assert.equal(ui.button(text).disabled, true);
  assert.equal((await ui.report()).sessionId, first.sessionId);
});

test('withdrawal discards observations and renewing consent creates a fresh default session', async t => {
  const ui = await mount(t);
  await ui.consent();
  await ui.choose('Contexto', 'field');
  await ui.choose('Fase', 'assisted');
  await ui.choose('Momento evaluado', 'sign');
  await ui.click('No fue claro');
  const before = await ui.report();
  await ui.consent();
  assert.match(ui.container.textContent, /0 observaciones/);
  assert.equal(ui.button(download).disabled, true);
  await ui.click(download);
  assert.equal(ui.blobs.length, 1);
  await ui.consent();
  assert.equal(ui.uuid.mock.callCount(), 2);
  assert.equal(ui.select('Contexto').value, 'practice');
  assert.equal(ui.select('Fase').value, 'unassigned');
  assert.equal(ui.select('Momento evaluado').value, 'connection');
  await ui.click('Me resultó útil');
  const after = await ui.report();
  assert.notEqual(after.sessionId, before.sessionId);
  assert.deepEqual(after.observations, [{ stage: 'connection', kind: 'useful' }]);
});

test('unmounting discards participation and observations', async t => {
  const ui = await mount(t);
  await ui.consent();
  await ui.click('Necesité ayuda');
  const before = await ui.report();
  await act(() => ui.root.render(null));
  await act(() => ui.root.render(<TransferEvaluation catalogVersion={1} />));
  assert.equal(ui.container.querySelector('input')!.checked, false);
  assert.equal(ui.button(download).disabled, true);
  assert.match(ui.container.textContent, /0 observaciones/);
  await ui.consent();
  await ui.click('Necesité ayuda');
  assert.notEqual((await ui.report()).sessionId, before.sessionId);
});

test('each Blob download revokes its own URL after 1000ms, even after unmount', async t => {
  const ui = await mount(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await ui.consent();
  await ui.click('Me resultó útil');
  await ui.report();
  await ui.report();
  assert.deepEqual(ui.clicked.map(item => item.href), [
    'blob:https://metro.test/evaluation-1', 'blob:https://metro.test/evaluation-2',
  ]);
  for (const item of ui.clicked) assert.match(item.download, /\.json$/);
  assert.equal(ui.container.querySelector('a'), null);
  assert.equal(ui.revoke.mock.callCount(), 0);
  await act(() => ui.root.render(null));
  t.mock.timers.tick(999);
  assert.equal(ui.revoke.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.deepEqual(ui.revoke.mock.calls.map(call => call.arguments), ui.clicked.map(item => [item.href]));
});
