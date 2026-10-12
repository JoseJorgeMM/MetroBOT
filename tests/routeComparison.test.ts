import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { rankRoutes, walkingMinutes, timeTradeoff } from '../src/lib/routeComparison';
import type { RouteOption } from '../src/lib/routing';

const route = (id: string, duration: number, cost: number, walk: number, transfers = 0): RouteOption => ({
  id, duration, cost, transfers, modes: ['metro', 'walk'],
  steps: [{ mode: 'walk', duration: walk, instruction: 'Camina' }],
});
const routes = [route('fast', 20, 5000, 10, 2), route('cheap', 30, 3000, 5, 1), route('short-walk', 25, 4000, 2)];

test('ranks each priority and keeps original indices for map selection', () => {
  assert.deepEqual(rankRoutes(routes, 'cost').map(x => x.index), [1, 2, 0]);
  assert.deepEqual(rankRoutes(routes, 'duration').map(x => x.index), [0, 2, 1]);
  assert.deepEqual(rankRoutes(routes, 'walking').map(x => x.index), [2, 1, 0]);
  assert.deepEqual(rankRoutes(routes, 'transfers').map(x => x.index), [2, 1, 0]);
  assert.deepEqual(routes.map(x => x.id), ['fast', 'cheap', 'short-walk']);
});
test('unknown or incomplete walking time is not presented as zero', () => {
  assert.equal(walkingMinutes({ ...routes[0], steps: [] }), null);
  assert.equal(walkingMinutes(route('unknown', 20, 0, NaN)), null);
  assert.equal(walkingMinutes({ ...routes[0], modes: ['metro'], steps: [{ mode: 'metro', duration: 12, instruction: 'Metro' }] }), 0);
});
test('missing values sort last and equal priorities use duration', () => {
  assert.deepEqual(rankRoutes([route('unknown', 10, NaN, NaN), route('known', 25, 0, 0)], 'cost').map(x => x.index), [1, 0]);
  assert.deepEqual(rankRoutes([route('a', 30, 1, 2), route('b', 20, 1, 2)], 'cost').map(x => x.index), [1, 0]);
  assert.deepEqual(rankRoutes([], 'duration'), []);
});
test('tradeoffs reflect actual candidates rather than a fabricated promise', () => {
  assert.equal(timeTradeoff(routes[1], routes), 10);
  assert.equal(timeTradeoff(routes[0], routes), 0);
  assert.equal(timeTradeoff(route('unknown', NaN, 0, 0), routes), null);
});

const transportRoute = (id:string, mode:RouteOption['steps'][number]['mode'], duration:number, fareMode?:string):RouteOption => ({
  ...route(id,duration,duration, duration, duration),modes:[mode],
  steps:[{mode,duration,instruction:id,...(fareMode?{fareInput:{mode:fareMode}}:{})}],
});

test('Metro system precedes integrated buses, and conventional or unknown buses stay last for every priority',()=>{
  const input=[transportRoute('bus','bus',1),transportRoute('feeder','bus',2,'ALIMENTADOR'),transportRoute('metro','metro',80),transportRoute('mixed','metro',3)];
  input[3].steps.push({mode:'bus',duration:1,instruction:'bus sin identificar'});
  for(const priority of ['duration','cost','walking','transfers'] as const){
    assert.deepEqual(rankRoutes(input,priority).map(x=>x.index),[2,1,0,3]);
  }
  assert.deepEqual(input.map(x=>x.id),['bus','feeder','metro','mixed']);
});

test('all selected priorities still order alternatives within the Metro group',()=>{
  const input=routes.map(r=>({...r,steps:[...r.steps,{mode:'metro' as const,duration:10,instruction:'Metro'}]}));
  input.unshift(transportRoute('conventional','bus',1));
  assert.deepEqual(rankRoutes(input,'duration').map(x=>x.index),[1,3,2,0]);
  assert.deepEqual(rankRoutes(input,'cost').map(x=>x.index),[2,3,1,0]);
  assert.deepEqual(rankRoutes(input,'walking').map(x=>x.index),[3,2,1,0]);
  assert.deepEqual(rankRoutes(input,'transfers').map(x=>x.index),[3,2,1,0]);
});

test('classification uses actual transport not fare availability, provider or route names',()=>{
  const input=[transportRoute('Metro falso','bus',1),transportRoute('integrated','bus',2,'BUS_INTEGRADO'),transportRoute('micro','bus',3,'MICRO_INTEGRADO'),transportRoute('metroplus','bus_articulado',90,'METROPLUS'),transportRoute('cable','metrocable',80),transportRoute('tram','tranvia',70)];
  input[0].source='google';input[0].cost=1000;input[4].cost=-1;
  assert.deepEqual(rankRoutes(input,'duration').map(x=>x.index),[5,4,3,1,2,0]);
});

test('walking and bikes do not demote Metro and standalone active travel is not labelled Metro',()=>{
  const metro=transportRoute('metro','metro',90);
  metro.steps.push({mode:'walk',duration:5,instruction:'Camina'},{mode:'encicla',duration:5,instruction:'EnCicla'});
  const input=[transportRoute('unknown','transit',1),transportRoute('walk','walk',2),metro];
  assert.deepEqual(rankRoutes(input,'duration').map(x=>x.index),[2,1,0]);
});
