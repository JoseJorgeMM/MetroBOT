import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priceRoute } from '../src/lib/fares/routeAdapter';
import { parseUrbanFares } from '../src/lib/fares/urbanFares';
import type { RouteOption } from '../src/lib/routing';
const catalog=()=>parseUrbanFares(JSON.parse(readFileSync('public/tarifas_urbanas.json','utf8')),'2026-10-12');
const route=():RouteOption=>({id:'b',source:'google',cost:-1,duration:40,transfers:1,modes:['bus','metro'],steps:[
  {mode:'bus',line:'260-2',duration:20,instruction:'Bus'}, {mode:'metro',duration:20,instruction:'Metro'},
]});
test('urban budget requires explicit per-leg confirmation and never guesses a route identity',()=>{
  const input=route();
  assert.equal(priceRoute(input,undefined,{urbanFares:catalog()}).cost,-1);
  const result=priceRoute(input,undefined,{urbanFares:catalog(),urbanChoices:{0:'bus'}});
  assert.equal(result.cost,7620);
  assert.equal(result.fare?.source,'budget');
  assert.equal(result.fare?.status,'CONDICIONAL');
  assert.equal(result.fare?.integrationApplied,false);
  assert.deepEqual(result.steps.map(s=>s.cost),[3800,3820]);
});
test('budget preserves unknown remaining legs and does not override known tariff identities',()=>{
  const input=route(); input.steps.push({mode:'bus',duration:10,instruction:'Unknown'});
  assert.equal(priceRoute(input,undefined,{urbanFares:catalog(),urbanChoices:{0:'bus'}}).cost,-1);
  input.steps[0].fareInput={mode:'ALIMENTADOR',basin:'3',scheduledTime:'2026-10-12T12:00:00Z'};
  input.steps[1].transit={agencies:[],departureTime:'2026-10-12T12:20:00Z'};
  input.steps.pop();
  assert.equal(priceRoute(input,undefined,{urbanFares:catalog(),urbanChoices:{0:'bus'}}).cost,4570);
});
test('runtime tariff data rejects expired, malformed and unknown amounts',()=>{
  const data=JSON.parse(readFileSync('public/tarifas_urbanas.json','utf8'));
  assert.equal(parseUrbanFares(data,'2027-01-01'),null);
  data.prices.bus=-1; assert.equal(parseUrbanFares(data,'2026-10-12'),null);
  assert.equal(parseUrbanFares({},'2026-10-12'),null);
});

test('independent bus budgets sum every full fare once and still use selected Metro profile',()=>{
  const input=route();input.steps.push({mode:'bus',duration:10,instruction:'Otro bus'});
  const result=priceRoute(input,{id:'estudiantil',payment:'civica'},{urbanFares:catalog(),urbanChoices:{0:'bus',2:'micro'}});
  assert.equal(result.cost,9300);
  assert.deepEqual(result.steps.map(s=>s.cost),[3800,1600,3900]);
  assert.equal(priceRoute(result,{id:'estudiantil',payment:'civica'},{urbanFares:catalog(),urbanChoices:{0:'bus',2:'micro'}}).cost,9300);
  const reset=priceRoute(result,{id:'estudiantil',payment:'civica'},{urbanFares:catalog()});
  assert.equal(reset.cost,-1);
});
