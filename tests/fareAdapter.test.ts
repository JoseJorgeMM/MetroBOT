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
