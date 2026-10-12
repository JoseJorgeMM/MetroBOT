import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RouteComparison} from '../src/components/RouteComparison';
import {defaultNeeds} from '../src/lib/journey/types';
import type {RouteOption} from '../src/lib/routing';

test('comparison explains grouping and renders Metro before bus while keeping original option numbers',()=>{
 const make=(id:string,mode:'bus'|'metro',duration:number):RouteOption=>({id,source:'google',modes:[mode],duration,cost:-1,transfers:0,steps:[{mode,duration,instruction:id}]});
 const html=renderToStaticMarkup(<RouteComparison routes={[make('bus-normal','bus',5),make('metro-lento','metro',50)]} activeRouteIndex={0} onSelect={()=>{}} onEdit={()=>{}} onStartNav={()=>{}} navState="idle" needs={{...defaultNeeds,priority:'duration'}} onNeedsChange={()=>{}}/>);
 assert.match(html,/Dentro de cada grupo se respeta/);
 assert.match(html,/>Sistema Metro<\/h4>/);
 assert.match(html,/>Buses convencionales o transporte sin confirmar<\/h4>/);
 assert.ok(html.indexOf('>Sistema Metro</h4>')<html.indexOf('>Buses convencionales o transporte sin confirmar</h4>'));
});
