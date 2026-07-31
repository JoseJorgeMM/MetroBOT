import test from 'node:test';
import assert from 'node:assert/strict';
import {
  admitRouteRequest,
  completeAppRequest,
  createAppRequestState,
  assistantResponseForOutcome,
} from '../src/lib/appRouteFlow';

const firstEndpoints = {
  origin: { lat: 6.25, lng: -75.57, name: 'Casa' },
  destination: { lat: 6.27, lng: -75.55, name: 'Trabajo' },
};

const secondEndpoints = {
  origin: { lat: 6.30, lng: -75.60, name: 'Universidad' },
  destination: { lat: 6.20, lng: -75.58, name: 'Terminal' },
};

test('a concurrent route request is rejected without replacing accepted endpoints', () => {
  const first = admitRouteRequest(createAppRequestState(), firstEndpoints);
  assert.deepEqual(first.request, {
    id: 1,
    kind: 'route',
    endpoints: firstEndpoints,
  });

  const rejected = admitRouteRequest(first.state, secondEndpoints);
  assert.equal(rejected.request, null);
  assert.deepEqual(rejected.state.activeRequest, first.request);
  assert.deepEqual(rejected.state.activeRequest?.kind === 'route' ? rejected.state.activeRequest.endpoints : null, firstEndpoints);
});

test('the next accepted request owns its matching endpoints after completion', () => {
  const first = admitRouteRequest(createAppRequestState(), firstEndpoints);
  const completed = completeAppRequest(first.state, first.request!.id);
  const second = admitRouteRequest(completed, secondEndpoints);

  assert.deepEqual(second.request, {
    id: 2,
    kind: 'route',
    endpoints: secondEndpoints,
  });
  assert.deepEqual(second.state.activeRequest, second.request);
});

test('a failed or unsafe route outcome suppresses generated response prose', () => {
  assert.equal(
    assistantResponseForOutcome('failed', 'Texto adicional del modelo.'),
    null,
  );
});

test('ordinary assistant and no-verificada-ready outcomes retain their response', () => {
  assert.equal(
    assistantResponseForOutcome('none', 'Respuesta ordinaria.'),
    'Respuesta ordinaria.',
  );
  assert.equal(
    assistantResponseForOutcome('ready', 'Detalle de la ruta no verificada.'),
    'Detalle de la ruta no verificada.',
  );
});
