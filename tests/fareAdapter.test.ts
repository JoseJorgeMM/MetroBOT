import test from 'node:test';
import assert from 'node:assert/strict';
import { priceRoute, classifyRouteSegments } from '../src/lib/fares/routeAdapter';
import type { RouteOption } from '../src/lib/routing';
import { readFileSync } from 'node:fs';
test('offline route builder delegates pricing to the same chain engine', () => {
  const source = readFileSync('src/lib/localRouter.ts', 'utf8');
  assert.match(source, /priceRoute\(/);
  assert.doesNotMatch(source, /3820|11900|calculateRouteCosts/);
});
const route = (mode: string): RouteOption => ({ id:'r', source:'google', duration:20, cost:99999, fareText:'$99.999', transfers:0, modes:[mode as never], steps:[{mode:mode as never,instruction:'Toma transporte',duration:20}] });
test('generic Google BUS is not automatically a feeder or free', () => {
  const priced = priceRoute(route('bus'));
  assert.equal(priced.fare?.status,'NO_DETERMINADA');
  assert.equal(priced.cost,-1);
  assert.equal(priced.fareText,undefined);
  assert.equal(priced.providerFare?.amount,99999);
});
test('does not mutate provider routes and known modes use JSON fares', () => {
  const input = route('metro');
  const priced = priceRoute(input);
  assert.equal(input.cost,99999);
  assert.equal(priced.cost,3820);
  assert.equal(priced.steps[0].cost,3820);
});
test('Arvi line is not treated as an integrated cable, and needs its own user category', () => {
  const input = route('metrocable'); input.steps[0].line='Línea L';
  assert.equal(classifyRouteSegments(input)[0].mode,'CABLE_ARVI');
  assert.equal(priceRoute(input).cost,-1);
});
test('explicit structured fare metadata distinguishes integrated buses and microbuses', () => {
  const input = route('bus'); input.steps[0].fareInput={mode:'MICRO_INTEGRADO',zone:'girardota',basin:'2',validationTime:'2026-10-01T12:00:00Z'};
  input.steps.push({mode:'metro',instruction:'Metro',duration:10,fareInput:{mode:'METRO',validationTime:'2026-10-01T12:20:00Z'}});
  assert.equal(priceRoute(input).cost,5390);
});
test('Google departure schedules are retained only as schedules', () => {
  const input=route('metro'); input.steps[0].transit={agencies:[],departureTime:'2026-10-01T12:00:00Z'};
  const segment=classifyRouteSegments(input)[0];
  assert.equal(segment.validationTime,undefined);
  assert.equal(segment.scheduledTime,'2026-10-01T12:00:00Z');
});
test('catalog identity must be unique and present before C3/C6 feeder classification', () => {
  const input=route('bus'); input.steps[0].line='C3-001';
  assert.equal(classifyRouteSegments(input)[0].mode,'TIPO_TRANSPORTE_NO_DETERMINADO');
  const catalog=[{id:'C3-001',name:'Ruta Integrada C3-001',stops:[]}];
  assert.equal(classifyRouteSegments(input,{routes:catalog})[0].mode,'ALIMENTADOR');
});
test('catalogued Metroplús stops classify a Google BUS before pricing Metroplús to Metro', () => {
  const rutaN={id:'mplus-ruta-n',nombre:'Ruta N',sistema:'MPLUS',linea:'1',lat:6.268,lng:-75.568};
  const cisneros={id:'mplus-cisneros',nombre:'Cisneros',sistema:'MPLUS',linea:'1',lat:6.251,lng:-75.582};
  const input:RouteOption={id:'ruta-n',source:'google',cost:-1,duration:28,transfers:1,modes:['bus','metro'],steps:[
    {mode:'bus',line:'Ruta N - U de A',instruction:'Autobús hacia Universidad de Medellín',duration:5,transit:{
      departureStop:'Ruta N - U de A',arrivalStop:'Cisneros - Moda',departureLocation:{lat:rutaN.lat,lng:rutaN.lng},arrivalLocation:{lat:cisneros.lat,lng:cisneros.lng},
      departureTime:'2026-10-12T16:21:00-05:00',arrivalTime:'2026-10-12T16:25:00-05:00',agencies:[{name:'Metro de Medellín'}],
    }},
    {mode:'metro',line:'B',instruction:'Metro hacia San Javier',duration:3,transit:{departureStop:'Cisneros',arrivalStop:'Estadio',departureTime:'2026-10-12T16:36:00-05:00',arrivalTime:'2026-10-12T16:39:00-05:00',agencies:[{name:'Metro de Medellín'}]}},
  ]};
  const priced=priceRoute(input,undefined,{stations:[rutaN,cisneros]});
  assert.deepEqual(classifyRouteSegments(input,{stations:[rutaN,cisneros]}).map(segment=>segment.mode),['METROPLUS','METRO']);
  assert.deepEqual(priced.modes,['metroplus','metro']);
  assert.equal(priced.steps[0].mode,'metroplus');
  assert.equal(priced.fare?.total,3820);
  assert.equal(priced.fare?.status,'CONDICIONAL');
  assert.equal(priced.fare?.chains[0].category,'integracion_2');
  assert.equal(priced.fare?.chains[0].group,'integraciones_1_4');
});
test('catalogued stops without the official agency remain an unpriced bus', () => {
  const rutaN={id:'mplus-ruta-n',nombre:'Ruta N',sistema:'MPLUS',linea:'1',lat:6.268,lng:-75.568};
  const cisneros={id:'mplus-cisneros',nombre:'Cisneros',sistema:'MPLUS',linea:'1',lat:6.251,lng:-75.582};
  const input=route('bus');
  input.steps[0].line='Ruta N - U de A';
  input.steps[0].transit={departureStop:'Ruta N - U de A',arrivalStop:'Cisneros - Moda',departureLocation:{lat:rutaN.lat,lng:rutaN.lng},arrivalLocation:{lat:cisneros.lat,lng:cisneros.lng},agencies:[{name:'Operador no verificado'}]};
  const priced=priceRoute(input,undefined,{stations:[rutaN,cisneros]});
  assert.equal(classifyRouteSegments(input,{stations:[rutaN,cisneros]})[0].mode,'TIPO_TRANSPORTE_NO_DETERMINADO');
  assert.equal(priced.fare?.total,null);
});
