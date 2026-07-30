import assert from 'node:assert/strict';
import { parseLiveMetroStatus, isTrustedStatusSource } from './_liveMetroStatus_impl.mjs';

const now = new Date('2026-07-30T15:00:00.000Z');

const normal = parseLiveMetroStatus(
  'RESULTADO: NORMAL\nRESUMEN: No se reportan novedades operativas actuales.\nLINEAS_AFECTADAS: ninguna\nESTACIONES_AFECTADAS: ninguna',
  { groundingChunks: [{ web: { uri: 'https://www.metrodemedellin.gov.co/estado', title: 'Metro de Medellín' } }] },
  now
);
assert.equal(normal.status, 'normal');
assert.equal(normal.affectedLines.length, 0);
assert.equal(normal.sources.length, 1);

const alert = parseLiveMetroStatus(
  'RESULTADO: ALERTA\nRESUMEN: Se reporta falla en Línea A.\nLINEAS_AFECTADAS: A\nESTACIONES_AFECTADAS: Caribe',
  { groundingChunks: [
    { web: { uri: 'https://www.metrodemedellin.gov.co/noticias/falla', title: 'Aviso oficial' } },
    { web: { uri: 'https://www.instagram.com/p/publico', title: 'Reporte público' } },
  ] },
  now
);
assert.equal(alert.status, 'alerta');
assert.deepEqual(alert.affectedLines, ['A']);
assert.deepEqual(alert.affectedStations, ['Caribe']);
assert.equal(alert.sources.length, 2);

const ambiguous = parseLiveMetroStatus('No pude confirmar información reciente.', { groundingChunks: [] }, now);
assert.equal(ambiguous.status, 'no_verificado');

const stale = parseLiveMetroStatus(
  'RESULTADO: NORMAL\nRESUMEN: Operación normal.',
  { groundingChunks: [{ web: { uri: 'https://www.metrodemedellin.gov.co/estado', title: 'Aviso antiguo', publishedTime: '2026-07-29T00:00:00Z' } }] },
  now
);
assert.equal(stale.status, 'no_verificado');

assert.equal(isTrustedStatusSource('https://www.metrodemedellin.gov.co/'), true);
assert.equal(isTrustedStatusSource('https://www.instagram.com/metrodemedellin/'), false);
assert.equal(isTrustedStatusSource('https://example.com/noticia'), false);

console.log('ALL TESTS PASS (10/10)');
