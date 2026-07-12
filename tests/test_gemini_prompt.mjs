// tests/test_gemini_prompt.mjs
import { buildSysPrompt, BUS_CATALOG_CAP, STATION_CATALOG_CAP } from './_gemini_prompt_impl.mjs';

let passed = 0, failed = 0;
const failures = [];
function assert(name, cond, hint) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; failures.push({ name, hint }); console.log('  ✗', name, hint ? '(' + hint + ')' : ''); }
}
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log('  ✓', name); }
  else { failed++; failures.push({ name, actual: a, expected: e }); console.log('  ✗', name, '\n      actual:  ', a, '\n      expected:', e); }
}

const out = buildSysPrompt({
  grounding: 'GROUNDING_OK',
  integratedSnippet: 'BUS_OK',
  stationSnippet: 'STATION_OK',
  tarifas: 'TARIFAS_OK',
  tiempos: 'TIEMPOS_OK',
  encicla: 'ENCICLA_OK',
  news: 'NEWS_OK',
});

console.log('prompt: SITVA-first rule present');
assert('contains "BACKBONE SITVA"', out.includes('BACKBONE SITVA'), 'no SITVA-first rule');
assert('contains "1.5 km" hint', out.includes('1.5 km'), 'no distance threshold');
assert('contains "SITVA como backbone"', out.includes('SITVA como backbone'));

console.log('prompt: legacy bias removed');
assert('does NOT contain "Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses)"',
  !out.includes('Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses)'),
  'legacy line still present');
assert('does NOT contain "Si hay una parada de BUS ARTICULADO cerca del usuario, usala"',
  !out.includes('Si hay una parada de BUS ARTICULADO cerca del usuario, usala'),
  'legacy line still present');

console.log('prompt: catalog placeholders present');
assert('contains "CATALOGO DE ESTACIONES SITVA"', out.includes('CATALOGO DE ESTACIONES SITVA'));
assert('contains "CATALOGO DE BUSES INTEGRADOS"', out.includes('CATALOGO DE BUSES INTEGRADOS'));
assert('contains NEWS_OK marker', out.includes('NEWS_OK'));
assert('contains GROUNDING_OK marker', out.includes('GROUNDING_OK'));
assert('contains STATION_OK marker', out.includes('STATION_OK'));
assert('contains BUS_OK marker', out.includes('BUS_OK'));

console.log('prompt: anti-hallucination rules preserved');
assert('contains "NO INVENTAR"', out.includes('NO INVENTAR'));
assert('contains "C7-999"', out.includes('C7-999'));
assert('contains "REGLA 0"', out.includes('REGLA 0'));

console.log('prompt: catalog caps');
assertEq('BUS_CATALOG_CAP = 60', BUS_CATALOG_CAP, 60);
assertEq('STATION_CATALOG_CAP = 30', STATION_CATALOG_CAP, 30);

console.log('prompt: empty parts produce sane string');
const empty = buildSysPrompt();
assert('empty still has SITVA-first rule', empty.includes('BACKBONE SITVA'));
assert('empty does not crash', typeof empty === 'string' && empty.length > 100);

console.log('prompt: allowBuses toggle (default true)');
const onDefault = buildSysPrompt({ grounding: 'G', integratedSnippet: 'BUS_LIST_OK', stationSnippet: 'S', tarifas: 'T', tiempos: 'TI', encicla: 'E', news: 'N' });
assert('default keeps BUS_LIST_OK in catalog', onDefault.includes('BUS_LIST_OK'));
assert('default has no REGLA BLOQUEO BUSES', !onDefault.includes('REGLA BLOQUEO BUSES'));
assert('default has no "DESACTIVADO" sentinel', !onDefault.includes('DESACTIVADO'));

console.log('prompt: allowBuses toggle (explicit false)');
const off = buildSysPrompt({ allowBuses: false, grounding: 'G', integratedSnippet: 'BUS_LIST_OK', stationSnippet: 'S', tarifas: 'T', tiempos: 'TI', encicla: 'E', news: 'N' });
assert('disabled emits REGLA BLOQUEO BUSES', off.includes('REGLA BLOQUEO BUSES'));
assert('disabled forbids bus_articulado', off.includes('NO uses mode "bus_articulado"'));
assert('disabled drops BUS_LIST_OK from catalog', !off.includes('BUS_LIST_OK'));
assert('disabled still has REGLA 0', off.includes('REGLA 0'));
assert('disabled still has BACKBONE SITVA', off.includes('BACKBONE SITVA'));

console.log('prompt: allowBuses toggle (explicit true)');
const onExplicit = buildSysPrompt({ allowBuses: true, integratedSnippet: 'BUS_LIST_OK' });
assert('explicit true keeps BUS_LIST_OK', onExplicit.includes('BUS_LIST_OK'));
assert('explicit true has no REGLA BLOQUEO BUSES', !onExplicit.includes('REGLA BLOQUEO BUSES'));

console.log('\n-----');
if (failed === 0) { console.log('ALL TESTS PASS (' + passed + '/' + (passed + failed) + ')'); process.exit(0); }
else { console.log('FAILED ' + failed + '/' + (passed + failed)); for (const f of failures) console.log(' -', f.name, JSON.stringify(f)); process.exit(1); }
