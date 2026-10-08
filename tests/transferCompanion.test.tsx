import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import {TransferCompanion} from '../src/components/Journey/TransferCompanion';
import {validateTransferCatalog} from '../src/lib/transferCatalog';

test('pilot entry never pretends to be indoor navigation or an official Metro service',()=>{
 const html=renderToStaticMarkup(<TransferCompanion/>);
 assert.match(html,/Conexiones/); assert.match(html,/piloto/i);
 assert.match(html,/San Antonio/); assert.doesNotMatch(html,/Gira a la derecha|ascensor disponible/i);
});
test('sourced catalog explicitly blocks unverified indoor navigation',async()=>{
 const data=JSON.parse(await readFile('public/transfers/san-antonio-a-b.json','utf8'));
 assert.equal(validateTransferCatalog(data),true);
 assert.equal(data.indoorNavigation,false);
 assert.ok(data.sources.every((s:any)=>s.url.startsWith('https://www.metrodemedellin.gov.co/')));
 assert.equal(validateTransferCatalog({...data,indoorNavigation:true}),false);
 assert.equal(validateTransferCatalog({...data,sources:[{url:'javascript:alert(1)'}]}),false);
});
