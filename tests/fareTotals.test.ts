import test from 'node:test';
import assert from 'node:assert/strict';
import { priceRoute } from '../src/lib/fares/routeAdapter';
import { calculateFare } from '../src/lib/fares/engine';
import type { RouteOption } from '../src/lib/routing';

const bus = (): RouteOption => ({id:'bus',source:'google',cost:-1,duration:20,transfers:0,modes:['bus'],
  steps:[{mode:'bus',line:'260-2',instruction:'Bus',duration:20}],providerFare:{amount:3800,currency:'COP'}});

test('explicit Google COP total backs up missing local classification, without inventing leg prices',()=>{
  const result=priceRoute(bus());
  assert.equal(result.cost,3800);
  assert.equal(result.fare?.status,'CONDICIONAL');
  assert.equal(result.fare?.source,'google');
  assert.equal(result.fare?.profile,'no_informado');
  assert.equal(result.steps[0].cost,undefined);
  assert.equal(result.fare?.savings,null);
  assert.equal(priceRoute(result).cost,3800);
});
test('provider fallback validates currency, positive amount, provenance and prefers the local tariff',()=>{
  for(const value of [NaN,Infinity,-1,0]) {
    const input=bus(); input.providerFare!.amount=value;
    assert.equal(priceRoute(input).cost,-1);
  }
  const input=bus(); input.providerFare!.currency='USD';
  assert.equal(priceRoute(input).cost,-1);
  input.providerFare!.currency='COP'; input.source='local';
  assert.equal(priceRoute(input).cost,-1);
  input.source='google'; input.steps[0].mode='metro';
  assert.equal(priceRoute(input).cost,3820);
});
test('A/B continuity inside a feeder integration does not create an unsupported extra Metro boarding',()=>{
  const result=calculateFare([
    {mode:'ALIMENTADOR',basin:'3',scheduledTime:'2026-10-12T12:00:00Z'},
    {mode:'METRO',scheduledTime:'2026-10-12T12:20:00Z'},
    {mode:'METRO',metroContinuation:'planned',scheduledTime:'2026-10-12T12:40:00Z'},
  ]);
  assert.equal(result.total,4570);
  assert.equal(result.status,'CONDICIONAL');
  assert.equal(result.chains[0].category,'integracion_3');
  assert.deepEqual(result.breakdown.map(row=>row.charge),[3820,750,0]);
});

test('mixed continuity never hides exit evidence or contradictory times',()=>{
  const base=[{mode:'ALIMENTADOR',basin:'3',scheduledTime:'2026-10-12T12:00:00Z'},
    {mode:'METRO',scheduledTime:'2026-10-12T12:20:00Z'}];
  assert.equal(calculateFare([...base,{mode:'METRO',metroContinuation:'planned',scheduledTime:'2026-10-12T12:10:00Z'}]).total,null);
  assert.equal(calculateFare([...base,{mode:'METRO',metroContinuation:'planned',newJourney:true,scheduledTime:'2026-10-12T12:30:00Z'}]).total,8390);
});
