import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {TransferCompanion} from '../src/components/Journey/TransferCompanion';

const review = 'He revisado el texto · comprobar referencias';
const originalLabel = 'Revisa la transcripción de Gemini';
const editedLabel = 'Revisa la transcripción de Gemini editada por ti';
const retainedNotice = /Se conserva el texto anterior; no es una nueva transcripción/;

async function mount(t: TestContext) {
 const win = new Window({url:'https://metro.test'});
 const old = new Map<string, PropertyDescriptor | undefined>();
 for (const [key,value] of Object.entries({window:win, document:win.document, navigator:win.navigator,
  IS_REACT_ACT_ENVIRONMENT:true, createImageBitmap:async()=>({width:640,height:480,close(){}})})) {
  old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
  Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 t.mock.method(win.HTMLCanvasElement.prototype,'getContext',()=>({fillStyle:'',fillRect(){},drawImage(){}}));
 t.mock.method(win.HTMLCanvasElement.prototype,'toDataURL',()=> 'data:image/jpeg;base64,eA==');
 const catalog = JSON.parse(await readFile('public/transfers/san-antonio-a-b.json','utf8'));
 const pending: {resolve:(response:Response)=>void; signal:AbortSignal}[] = [];
 t.mock.method(globalThis,'fetch',async(input,init)=> {
  if (String(input).includes('/transfers/')) return Response.json(catalog);
  assert.equal(String(input),'/api/transfer-sign');
  assert.deepEqual(JSON.parse(String(init?.body)),{mimeType:'image/jpeg',data:'eA=='});
  // Deliberately allow late responses after abort to exercise the generation guard.
  return new Promise<Response>(resolve=>pending.push({resolve,signal:init!.signal as AbortSignal}));
 });
 const container=win.document.createElement('div'); win.document.body.append(container);
 const root=createRoot(container as unknown as Element);
 t.after(async()=>{
  await act(async()=>{root.unmount(); for(const request of pending) request.resolve(Response.json({provider:'gemini',visibleText:''}));}); await win.happyDOM.abort();
  for (const [key,value] of old) {
   if(value) Object.defineProperty(globalThis,key,value); else Reflect.deleteProperty(globalThis,key);
  }
 });
 const button=(text:string)=>{
  const found=[...container.querySelectorAll('button')].find(b=>b.textContent===text);
  assert.ok(found,text); return found;
 };
 const click=async(text:string)=>{await act(async()=>{button(text).click();});};
 // Same mounted React handler approach as transferSession.test.tsx for happy-dom changes.
 const change=async(element:object,event:unknown)=>{
  const key=Object.keys(element).find(k=>k.startsWith('__reactProps')); assert.ok(key);
  await act(async()=>{(element as any)[key].onChange(event);});
 };
 const type=async(value:string)=>change(container.querySelector('textarea')!,{target:{value}});
 const choose=async()=>{
  const target={files:[new win.File(['photo'],'sign.jpg',{type:'image/jpeg'})],value:'sign.jpg'};
  await change(container.querySelector('input[type=file]')!,{target});
  assert.equal(target.value,'','file input must allow choosing the same image again');
 };
 const consent=async()=>{await act(()=>[...container.querySelectorAll('input')].find(input=>input.type==='checkbox')!.click());};
 const answer=async(index:number,text='Línea B San Javier',status=200)=>{
  await act(async()=>pending[index].resolve(Response.json(status===200?{provider:'gemini',visibleText:text}:{code:'RATE_LIMIT'},{status})));
 };
 const label=()=>container.querySelector('textarea')!.parentElement!.firstChild!.textContent;
 const value=()=>container.querySelector('textarea')!.value;
 await act(()=>root.render(<TransferCompanion/>)); await click('Explorar conexión San Antonio');
 const ocr=async()=>{await choose();await consent();await click('Leer foto con Gemini');await answer(pending.length-1);};
 return {container,button,click,type,choose,consent,answer,label,value,pending,ocr};
}

test('edited OCR retains Gemini provenance through review and consent revocation',async t=>{
 const h=await mount(t); await h.ocr();
 assert.equal(h.label(),originalLabel);
 assert.doesNotMatch(h.container.textContent,/Referencias compatibles/);
 await h.click(review); assert.match(h.container.textContent,/Referencias compatibles/);
 await h.type('Línea B San Javier ');
 assert.equal(h.label(),editedLabel);
 assert.doesNotMatch(h.container.textContent,/Referencias compatibles/);
 await h.consent(); assert.equal(h.label(),editedLabel);
 await h.click(review); assert.equal(h.label(),editedLabel);
 assert.match(h.container.textContent,/Referencias compatibles/);
 assert.equal(h.pending.length,1);
});

test('cancelled and failed re-reads retain explicitly labelled previous OCR text',async t=>{
 const h=await mount(t); await h.ocr(); await h.click(review);
 await h.click('Leer foto con Gemini');
 assert.equal(h.label(),originalLabel);
 assert.match(h.container.textContent,retainedNotice);
 assert.equal(h.button(review).disabled,true);
 assert.doesNotMatch(h.container.textContent,/Referencias compatibles/);
 await h.click('Cancelar lectura');
 assert.equal(h.pending[1].signal.aborted,true);
 await h.answer(1,'Línea A Niquía');
 assert.equal(h.value(),'Línea B San Javier'); assert.equal(h.label(),originalLabel);
 assert.match(h.container.textContent,retainedNotice);
 await h.click('Leer foto con Gemini'); await h.answer(2,'',429);
 assert.equal(h.label(),originalLabel); assert.match(h.container.textContent,retainedNotice);
 assert.doesNotMatch(h.container.textContent,/Referencias compatibles/);
 await h.click(review); assert.match(h.container.textContent,/Referencias compatibles/);
});

test('fresh OCR replaces edited provenance and still requires explicit review',async t=>{
 const h=await mount(t); await h.ocr(); await h.type('Línea B San Javier ');
 assert.equal(h.label(),editedLabel);
 await h.click('Leer foto con Gemini');
 await h.consent(); assert.equal(h.pending[1].signal.aborted,true);
 assert.equal(h.label(),editedLabel);
 await h.answer(1,'Línea A Niquía'); assert.equal(h.value(),'Línea B San Javier ');
 await h.consent(); await h.click('Leer foto con Gemini'); await h.answer(2);
 assert.equal(h.label(),originalLabel); assert.doesNotMatch(h.container.textContent,retainedNotice);
 assert.doesNotMatch(h.container.textContent,/Referencias compatibles/);
 await h.click(review); assert.match(h.container.textContent,/Referencias compatibles/);
});

test('new photo, photo removal and session reset clear provenance and text',async t=>{
 const h=await mount(t); await h.ocr(); await h.choose();
 assert.match(h.label(),/sin IA/); assert.equal(h.value(),'');
 await h.consent(); await h.click('Leer foto con Gemini'); await h.answer(1);
 await h.click('Quitar foto'); assert.match(h.label(),/sin IA/); assert.equal(h.value(),'');
 await h.type('Línea B San Javier'); await h.click(review); assert.match(h.label(),/sin IA/);
 await h.ocr(); await h.click('Cerrar piloto de transbordo'); await h.click('Explorar conexión San Antonio');
 assert.match(h.label(),/sin IA/); assert.equal(h.value(),'');
 assert.doesNotMatch(h.container.textContent,/Referencias compatibles/);
});
