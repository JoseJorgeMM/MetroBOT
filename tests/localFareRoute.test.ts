import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getLocalOfflineRoute } from '../src/lib/localRouter';
import { loadStations } from '../src/lib/stations';
import { planTransit } from '../src/lib/transitPlanner';
import { priceRoute } from '../src/lib/fares/routeAdapter';

test('real local La Estrella → Estadio publishes structured A/B stops and one fare',async t=>{
  t.mock.method(globalThis,'fetch',async (input:unknown)=>{
    const path=String(input);
    assert.ok(path.startsWith('/') && !path.includes('..'));
    try { return new Response(await readFile(`public${path}`)); }
    catch { return new Response('',{status:404}); }
  });
  const stations=await loadStations();
  const origin=stations.find(s=>s.nombre==='La Estrella' && s.sistema==='Metro')!;
  const end=stations.find(s=>s.nombre==='Estadio' && s.sistema==='Metro')!;
  const planned=await planTransit(origin,end,{google:async()=>{throw Error('NOT_CONFIGURED');},local:()=>getLocalOfflineRoute(origin.lat,origin.lng,end.lat,end.lng)});
  const routes=planned.routes.map(route=>priceRoute(route));
  assert.ok(routes.length);
  for(const route of routes) {
    assert.equal(route.fare?.total,3820);
    assert.equal(route.fare?.status,'CONDICIONAL');
    const metro=route.steps.filter(s=>s.mode==='metro');
    assert.equal(metro[0].transit?.arrivalStop,'San Antonio');
    assert.equal(metro[1].transit?.departureStop,'San Antonio');
    assert.deepEqual(metro.map(s=>s.cost),[3820,0]);
  }
});
