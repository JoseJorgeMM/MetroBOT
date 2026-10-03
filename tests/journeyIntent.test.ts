import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalIntent, stationCandidates, requestJourneyIntent } from '../src/lib/journey/intent';
import type { Station } from '../src/lib/stations';
import {createPlannerState,transitionPlanner} from '../src/components/plannerState';
test('manual handoff retains unresolved addresses without inventing coordinates',()=>{
  const state=createPlannerState({origin:null,destination:null,busesEnabled:true,initialQueries:{origin:'Calle 10 #43-20',destination:'Carrera 70 #45-10'}});
  const sync=transitionPlanner(state,{type:'sync-place',field:'origin',place:null}).state;
  assert.equal(sync.originQuery,'Calle 10 #43-20');
  assert.equal(sync.destinationQuery,'Carrera 70 #45-10');
  assert.equal(sync.origin,null);
  assert.equal(sync.destination,null);
});
test('fare question becomes an editable trip rather than generated route prose', () => {
  const intent = parseLocalIntent('¿Cuánto vale un recorrido desde La Estrella hasta el Estadio?');
  assert.equal(intent.origin, 'La Estrella');
  assert.equal(intent.destination, 'el Estadio');
  assert.equal(intent.priority, 'cost');
});
test('local parser extracts explicit budgets and walking limits only', () => {
  const intent = parseLocalIntent('Desde Niquía hasta Poblado, máximo $5.000 y caminar máximo 10 minutos');
  assert.equal(intent.destination, 'Poblado');
  assert.equal(intent.maxCost, 5000);
  assert.equal(intent.maxWalkingMinutes, 10);
  assert.equal(parseLocalIntent('Necesito llegar pronto').maxDurationMinutes, null);
});
test('station candidates preserve ambiguity and coordinate identity', () => {
  const stations = [
    {id:'a',nombre:'Estadio',sistema:'METRO',linea:'B',lat:6.25,lng:-75.59},
    {id:'b',nombre:'Estadio',sistema:'EnCicla',linea:'',lat:6.26,lng:-75.58},
  ] as Station[];
  assert.deepEqual(stationCandidates('el Estadio',stations).map(s=>s.id),['a','b']);
  assert.equal(stationCandidates('una estación inexistente',stations).length,0);
});
test('advertised local example preserves singular transbordo constraint',()=>{
  const intent=parseLocalIntent('Desde Universidad hasta San Javier, máximo 1 transbordo y caminar máximo 10 minutos.');
  assert.equal(intent.maxTransfers,1);
  assert.equal(intent.maxWalkingMinutes,10);
});
test('local fallback carries unsupported accessibility and deadline requirements for review',()=>{
  assert.equal(parseLocalIntent('Desde Estadio hasta Poblado, necesito silla de ruedas').notes.length,1);
  assert.equal(parseLocalIntent('Desde Estadio hasta Poblado, llegar a las 8:00').notes.length,1);
});
test('missing AI service uses explicitly labeled local interpretation', async () => {
  const result = await requestJourneyIntent('Desde La Estrella hasta Estadio', undefined, async () => new Response('{"code":"CONFIGURATION"}',{status:503}));
  assert.equal(result.provider,'local');
  assert.match(result.notice,/IA no está activada/);
  assert.equal(result.intent.origin,'La Estrella');
});
test('cancellation does not become a successful local answer', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(requestJourneyIntent('Desde La Estrella hasta Estadio',controller.signal,async()=>{throw new DOMException('cancel','AbortError');}));
});
