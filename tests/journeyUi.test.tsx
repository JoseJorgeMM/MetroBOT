import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { JourneyStudio } from '../src/components/Journey/JourneyStudio';
import { JourneyDecisions } from '../src/components/Journey/JourneyDecisions';
import { defaultNeeds } from '../src/lib/journey/types';
import { priceRoute } from '../src/lib/fares/routeAdapter';
import type { RouteOption } from '../src/lib/routing';
import { RouteComparison } from '../src/components/RouteComparison';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const base:RouteOption={id:'a',source:'local',duration:25,cost:-1,transfers:0,modes:['metro'],steps:[{mode:'metro',duration:25,instruction:'Metro',line:'A'}]};
test('journey workspace requires chosen places and exposes manual completion',()=>{
  const html=renderToStaticMarkup(<JourneyStudio origin={null} destination={null} needs={defaultNeeds} onNeedsChange={()=>{}} onPlan={()=>true} onManualPlan={()=>{}} onClose={()=>{}}/>);
  assert.doesNotMatch(html,/role="log"/);
  assert.match(html,/disabled=""[^>]*>Comparar recorridos reales/);
  assert.match(html,/Buscar otra dirección/);
  assert.match(html,/Presupuesto por viaje/);
});
test('known single fare appears in recommendation and repeated-trip projection',()=>{
  const route=priceRoute(base);
  const html=renderToStaticMarkup(<JourneyDecisions routes={[route]} needs={defaultNeeds} onNeedsChange={()=>{}} onSelect={()=>{}} activeRouteIndex={0}/>);
  assert.match(html,/opción 1 encaja mejor/);
  assert.match(html,/3.820 COP/);
  assert.match(html,/Gasto proyectado/);
  assert.match(html,/no busca nuevas rutas|ni busca nuevas rutas/);
});
test('unknown bus fare cannot satisfy a budget and never becomes projected zero',()=>{
  const route=priceRoute({...base,modes:['bus'],steps:[{mode:'bus',duration:25,instruction:'Bus'}]});
  const html=renderToStaticMarkup(<JourneyDecisions routes={[route]} needs={{...defaultNeeds,maxCost:5000}} onNeedsChange={()=>{}} onSelect={()=>{}} activeRouteIndex={0}/>);
  assert.match(html,/Hace falta ajustar el viaje/);
  assert.match(html,/sin datos suficientes/);
  assert.doesNotMatch(html,/Gasto proyectado:|opción 1 encaja mejor/);
});

test('fresh result renders retain the supplied fare profile, excluded service and repeats', () => {
  const render = (excludedService: string) => renderToStaticMarkup(<RouteComparison
    routes={[base]} activeRouteIndex={0} onSelect={()=>{}} onEdit={()=>{}}
    onStartNav={()=>{}} navState="idle" needs={defaultNeeds} onNeedsChange={()=>{}}
    profile={{id:'bancarizado',payment:'bank'}} onProfileChange={()=>{}}
    excludedService={excludedService} onExcludedServiceChange={()=>{}}
    repeats={7} onRepeatsChange={()=>{}}/>);
  for (let mount = 0; mount < 2; mount++) {
    const html = render('metro:A');
    assert.match(html, /value="bancarizado" selected=""/);
    assert.match(html, /value="metro:A" selected=""/);
    assert.match(html, /type="number" min="1" max="100"[^>]*value="7"/);
    assert.match(html, /Usa el servicio excluido/);
    assert.match(render(''), /por 7 recorridos/);
  }
});

test('map selection cancels the pending route before closing the surface', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler: ts.ArrowFunction | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'onRequestMapSelection' &&
      node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression &&
      ts.isArrowFunction(node.initializer.expression)) handler = node.initializer.expression;
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(handler, 'map-selection callback exists');
  const calls: string[] = [];
  const compiled = ts.transpileModule(`const callback = ${handler.getText(file)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const callback = new Function('cancelPendingRoute', 'setMapSelectionMode', 'dispatchSurface',
    `${compiled}; return callback;`)(
    () => calls.push('cancel'), (mode: string) => calls.push(mode),
    (action: {type: string}) => calls.push(action.type),
  );
  callback('destination');
  assert.deepEqual(calls, ['cancel', 'destination', 'CLOSE']);
});
