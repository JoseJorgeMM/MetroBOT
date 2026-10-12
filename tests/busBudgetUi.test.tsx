import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import {BusBudgetControls} from '../src/components/RouteCards/BusBudgetControls';
import {FareBreakdown} from '../src/components/RouteCards/FareBreakdown';
import {priceRoute} from '../src/lib/fares/routeAdapter';
import {parseUrbanFares,type UrbanChoices} from '../src/lib/fares/urbanFares';
import type {RouteOption} from '../src/lib/routing';

test('confirming and clearing bus category recalculates the complete displayed total',async t=>{
  const window=new Window({url:'http://localhost'});
  const saved=new Map<string,PropertyDescriptor|undefined>();
  for(const [key,value] of Object.entries({window,document:window.document,navigator:window.navigator,IS_REACT_ACT_ENVIRONMENT:true})) {
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true});
  }
  const container=window.document.createElement('div');window.document.body.append(container);
  const root=createRoot(container as unknown as HTMLElement);
  t.after(async()=>{await act(()=>root.unmount());await window.happyDOM.abort();for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
  const route:RouteOption={id:'ui',source:'google',cost:-1,duration:20,transfers:0,modes:['bus'],steps:[{mode:'bus',line:'260-2',duration:20,instruction:'Bus'}]};
  const urbanFares=parseUrbanFares(JSON.parse(readFileSync('public/tarifas_urbanas.json','utf8')),'2026-10-12');
  function Host(){
    const[choices,setChoices]=useState<UrbanChoices>({});
    const priced=priceRoute(route,undefined,{urbanFares,urbanChoices:choices});
    return <><FareBreakdown fare={priced.fare!}/><BusBudgetControls route={priced} evidence={{urbanFares}} choices={choices} onChange={setChoices}/></>;
  }
  await act(()=>root.render(<Host/>));
  assert.match(container.textContent,/Tarifa no determinada/);
  const select=container.querySelector('select')!;
  await act(()=>{select.value='bus';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  assert.match(container.querySelector('[aria-label="Costo del viaje"]')!.textContent,/Presupuesto total.*\$3\.800 COP/);
  assert.doesNotMatch(container.querySelector('[aria-label="Costo del viaje"]')!.textContent,/Tarifa no determinada/);
  await act(()=>{select.value='micro';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  assert.match(container.querySelector('[aria-label="Costo del viaje"]')!.textContent,/\$3\.900 COP/);
  await act(()=>{select.value='';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  assert.match(container.querySelector('[aria-label="Costo del viaje"]')!.textContent,/Tarifa no determinada/);
});
