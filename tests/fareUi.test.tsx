import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FareBreakdown } from '../src/components/RouteCards/FareBreakdown';
import { calculateFare } from '../src/lib/fares/engine';
import { formatCOP } from '../src/lib/fares/config';
test('UI shows total, zero additional integration and valid savings separately', () => {
  const fare=calculateFare([{mode:'METRO',validationTime:'2026-10-01T12:00:00Z'},{mode:'METROPLUS',validationTime:'2026-10-01T12:20:00Z'}]);
  const html=renderToStaticMarkup(<FareBreakdown fare={fare} />);
  assert.match(html,/Costo total del viaje/); assert.match(html,/\$3\.820 COP/); assert.match(html,/\$0 adicional/);
  assert.match(html,/Sin integración/); assert.doesNotMatch(html,/Metroplús gratis/i);
  assert.equal(formatCOP(3820),'$3.820 COP');
});
test('unknown fares never render a partial sum or invented savings as a journey total', () => {
  const html=renderToStaticMarkup(<FareBreakdown fare={calculateFare([{mode:'BUS'}])} />);
  assert.match(html,/Tarifa no determinada/); assert.doesNotMatch(html,/Ahorro:|Costo total del viaje[^]*\$0 COP/);
});
