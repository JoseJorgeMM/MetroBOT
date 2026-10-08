import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {TransferCompanion} from '../src/components/Journey/TransferCompanion';

test('manual comparison stays local, rejects ambiguity, and closing discards observations',async t=>{
 const win=new Window({url:'https://metro.test'});
 const old=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:win,document:win.document,navigator:win.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
  old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const catalog=JSON.parse(await readFile('public/transfers/san-antonio-a-b.json','utf8'));
 const calls:string[]=[];
 t.mock.method(globalThis,'fetch',async input=>{calls.push(String(input));return Response.json(catalog);});
 const container=win.document.createElement('div');win.document.body.append(container);const root=createRoot(container as unknown as Element);
 t.after(async()=>{await act(()=>root.unmount());await win.happyDOM.abort();for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k);}});
 const click=async(text:string)=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,text);await act(()=>b.click());};
 await act(()=>root.render(<TransferCompanion/>));await click('Explorar conexión San Antonio');
 assert.match(container.textContent,/Consulta documental/);
 assert.ok(container.querySelector('button:disabled'));
 const textarea=container.querySelector('textarea')!;
 // React listens to input changes in the browser; native setter plus bubbling event for test DOM.
 async function type(value:string){await act(()=>{const props=Object.keys(textarea).find(k=>k.startsWith('__reactProps'));assert.ok(props);(textarea as any)[props].onChange({target:{value}});});}
 await type('Línea B San Javier');await click('He revisado el texto · comprobar referencias');
 assert.match(container.textContent,/Referencias compatibles/);
 assert.match(container.textContent,/No confirma ubicación/);
 await type('Línea A Niquía');await click('He revisado el texto · comprobar referencias');
 assert.match(container.textContent,/Referencias distintas o ambiguas/);
 assert.deepEqual(calls,['/transfers/san-antonio-a-b.json']);
 const inputs=[...container.querySelectorAll('input')].filter(input=>input.type==='checkbox');
 await act(()=>inputs[1].click());await click('Necesité ayuda');
 assert.match(container.textContent,/1 observaciones/);
 let exported:Blob|undefined;
 t.mock.method(URL,'createObjectURL',(blob:Blob)=>{exported=blob;return 'blob:https://metro.test/observations';});
 t.mock.method(URL,'revokeObjectURL',()=>{});
 t.mock.method(win.HTMLAnchorElement.prototype,'click',()=>{});
 await click('Descargar observaciones JSON');
 assert.ok(exported);
 const report=JSON.parse(await exported.text());
 assert.deepEqual(Object.keys(report).sort(),['schemaVersion','pilot','scope','catalogVersion','summary','observations'].sort());
 assert.deepEqual(report.observations,[{stage:'connection',kind:'help-needed'}]);
 assert.equal(report.summary.total,1);
 assert.doesNotMatch(JSON.stringify(report),/Niquía|visibleText|data:image|latitude|longitude/);
 await click('Cerrar piloto de transbordo');await click('Explorar conexión San Antonio');
 assert.match(container.textContent,/0 observaciones/);
 assert.doesNotMatch(container.textContent,/Referencias distintas o ambiguas/);
});
