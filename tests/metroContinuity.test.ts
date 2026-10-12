import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFare} from '../src/lib/fares/engine';
import {priceRoute} from '../src/lib/fares/routeAdapter';
import type {RouteOption} from '../src/lib/routing';
import {fareCatalog,fareConfig} from '../src/lib/fares/config';

const route = ():RouteOption => ({id:'ab',source:'google',cost:-1,duration:30,transfers:1,modes:['metro'],steps:[
 {mode:'metro',line:'A',instruction:'Metro A',duration:20,transit:{arrivalStop:'San Antonio',agencies:[]}},
 {mode:'metro',line:'B',instruction:'Metro B',duration:10,transit:{departureStop:'San Antonio',agencies:[]}},
]});
test('planned A/B handoff prices one Metro fare without claiming validation or savings',()=>{
 const input=route();const output=priceRoute(input);
 assert.equal(output.fare?.total,3820);assert.equal(output.fare?.status,'CONDICIONAL');
 assert.deepEqual(output.fare?.breakdown.map(s=>s.charge),[3820,0]);
 assert.match(output.fare!.breakdown[1].description,/\$0 adicional/);
 assert.equal(output.fare?.savings,null);assert.equal(input.cost,-1);
});
test('continuity still rejects contradictory times and reads explicit category/profile mappings',()=>{
 const segments=[{mode:'METRO',scheduledTime:'2026-10-11T15:30:00Z'},
 {mode:'METRO',scheduledTime:'2026-10-11T15:00:00Z',metroContinuation:'planned' as const}];
 assert.equal(calculateFare(segments).total,null);
 const config=structuredClone(fareConfig);delete config.categoryGroups.integracion_1;
 assert.equal(calculateFare([{mode:'METRO'},{mode:'METRO',metroContinuation:'verified'}],undefined,fareCatalog,config).total,null);
 const catalog=structuredClone(fareCatalog);catalog.equivalencia_integraciones_oficiales.integraciones_1_4.estudiantil=1701;
 assert.equal(calculateFare([{mode:'METRO'},{mode:'METRO',metroContinuation:'verified'}],{id:'estudiantil',payment:'civica'},catalog).total,1701);
});
test('reverse B/A works but named walk outside the station cannot establish continuity',()=>{
 const input=route();input.steps[0].line='B';input.steps[1].line='A';
 assert.equal(priceRoute(input).fare?.total,3820);
 input.steps.splice(1,0,{mode:'walk',duration:1,instruction:'Caminar',station:{name:'Parque Berrío',lat:6.2,lng:-75.5}});
 assert.equal(priceRoute(input).fare?.total,null);
});
test('verified Metro continuation reads profile tariff including bank payment',()=>{
 const segments=[{mode:'METRO'},{mode:'METRO',metroContinuation:'verified' as const}];
 assert.equal(calculateFare(segments).total,3820);
 assert.equal(calculateFare(segments,{id:'bancarizado',payment:'bank'}).total,4570);
 assert.equal(calculateFare(segments).status,'DETERMINADA');
 assert.equal(calculateFare([{mode:'METRO'},{mode:'METRO'}]).total,null);
 assert.equal(calculateFare([{mode:'METRO'},{mode:'METRO',newJourney:true,metroContinuation:'verified'}]).total,7640);
});
test('adapter requires configured same-station handoff and preserves explicit exit evidence',()=>{
 const different=route();different.steps[1].transit!.departureStop='Estadio';assert.equal(priceRoute(different).fare?.total,null);
 const unknown=route();unknown.steps[1].line='X';assert.equal(priceRoute(unknown).fare?.total,null);
 const exit=route();exit.steps[1].fareInput={mode:'METRO',newJourney:true};assert.equal(priceRoute(exit).fare?.total,7640);
 const walk=route();walk.steps.splice(1,0,{mode:'walk',duration:2,instruction:'Transbordo'});assert.equal(priceRoute(walk).fare?.total,3820);
 walk.steps[1].duration=15;assert.equal(priceRoute(walk).fare?.total,null);
});
