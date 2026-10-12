import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import {PilotDashboard} from '../src/components/Journey/PilotDashboard';

test('dashboard isolates demo, imports sessions, deduplicates and exports only aggregates',async t=>{
  const win=new Window({url:'http://metro.test'});
  const saved=new Map<string,PropertyDescriptor|undefined>();
  for(const[key,value]of Object.entries({window:win,document:win.document,navigator:win.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
    saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  const demo=JSON.parse(readFileSync('public/transfers/pilot-demo.json','utf8'));
  const calls:string[]=[];
  t.mock.method(globalThis,'fetch',async input=>{calls.push(String(input));return Response.json(demo);});
  let exported:Blob|undefined;
  t.mock.method(URL,'createObjectURL',(blob:Blob)=>{exported=blob;return 'blob:test';});
  t.mock.method(URL,'revokeObjectURL',()=>{});
  t.mock.method(win.HTMLAnchorElement.prototype,'click',()=>{});
  const container=win.document.createElement('div');win.document.body.append(container);const root=createRoot(container as unknown as Element);
  t.after(async()=>{await act(()=>root.unmount());await win.happyDOM.abort();for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
  const click=async(label:string)=>{const button=[...container.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,label);await act(async()=>button.click());};
  const upload=async(files:unknown[])=>{
    const input=container.querySelector('input[type=file]')!;
    const key=Object.keys(input).find(key=>key.startsWith('__reactProps'))!;
    await act(async()=>{await(input as any)[key].onChange({target:{files,value:'x'}});});
  };
  await act(()=>root.render(<PilotDashboard onClose={()=>{}}/>));
  assert.match(container.textContent,/Aún no hay sesiones importadas/);
  await click('Ver demostración');
  assert.match(container.textContent,/Datos sintéticos/);
  await click('Descargar informe agregado');
  assert.equal(JSON.parse(await exported!.text()).mode,'demo');
  await click('Ver sesiones importadas');
  assert.match(container.textContent,/Aún no hay sesiones importadas/);
  assert.doesNotMatch(container.textContent,/Datos sintéticos/);
  await upload([{size:100,text:async()=>JSON.stringify(demo.sessions[0])}]);
  assert.match(container.textContent,/sintética.*demostración/);
  assert.match(container.textContent,/Aún no hay sesiones importadas/);
  const file={size:100,text:async()=>JSON.stringify({...demo.sessions[0],sessionId:'10000000-0000-4000-8000-000000000001'})};
  await upload([file,file]);
  assert.match(container.textContent,/1 añadidas.*1 duplicadas/);
  await click('Descargar informe agregado');
  const report=JSON.parse(await exported!.text());
  assert.equal(report.mode,'imported');assert.equal(report.summary.sessions,1);
  assert.doesNotMatch(JSON.stringify(report),/sessionId|observations/);
  await upload([{size:200000,text:async()=>{throw Error('Must not read oversized files');}}]);
  assert.match(container.textContent,/128 KiB/);
  await click('Vaciar sesiones importadas');
  assert.match(container.textContent,/Aún no hay sesiones importadas/);
  assert.deepEqual(calls,['/transfers/pilot-demo.json']);
});
