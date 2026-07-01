const fs = require('fs');
const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);
let orig = fs.readFileSync('src/lib/gemini.ts', 'utf8');
orig = orig.split(CRLF).join(LF);

// 1. Imports.
const importOld = "import { reconstructBusStep } from './routeValidator';" + LF + "import { enrichStation } from './stationResolver';";
const importNew = "import { reconstructBusStep, summarizeRouteValidation, validateUserCoords } from './routeValidator';" + LF + "import { enrichStation } from './stationResolver';" + LF + "import { computeHonestyAssessment, HonestyAssessment } from './honesty';" + LF + "import { computeEvidenceScore } from './evidence';" + LF + "import { recordSession } from './validatorTelemetry';";
if (orig.indexOf(importOld) === -1) {
  // Try matching the existing CRLF blocks; we already normalized to LF.
  const sample = orig.substring(orig.indexOf('reconstructBusStep') - 5, orig.indexOf('reconstructBusStep') + 80);
  console.log('looking for:', JSON.stringify(importOld));
  console.log('sample:', JSON.stringify(sample));
  throw new Error('imports');
}
orig = orig.replace(importOld, importNew);

// 2. sysPrompt: replace with array.join form. The current sysPrompt is a giant single-quoted string
//    starting with "    const sysPrompt = 'Eres MetroBot" and ending with "DATOS DE RED SITVA:\n' + grounding;".
const sysPromptStartMarker = "    const sysPrompt = '";
const sysPromptEndMarker = "DATOS DE RED SITVA:" + "\\n' + grounding;";
const i0 = orig.indexOf(sysPromptStartMarker);
const i1 = orig.indexOf(sysPromptEndMarker);
if (i0 === -1 || i1 === -1 || i1 < i0) throw new Error('sysPrompt');
const iEnd = i1 + sysPromptEndMarker.length;

const parts = [
  "    const sysPrompt = [",
  "      'Eres MetroBot, el asistente inteligente de movilidad de SITVA (Metro, Metrocable, Tranvia, Metroplus, EnCicla y Buses Articulados) en Medellin Colombia.',",
  "      'Tu objetivo es dar rutas REALISTAS y UTILES. Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses).',",
  "      '',",
  "      '=== NOTICIAS Y ESTADO EN TIEMPO REAL ===',",
  "      newsContext,",
  "      '',",
  "      'REGLAS DE ORO (CRITICO):',",
  "      '1. MINIMIZAR CAMINATA: Si hay una parada de BUS ARTICULADO cerca del usuario, usala.',",
  "      '2. NO INVENTAR: NUNCA inventes ids de ruta, nombres de paradas ni coordenadas. Para step.station, originStation, destinationStation SOLO puedes usar nameRef (un string EXACTO del catalogo o de la lista de paradas cercanas). El sistema rellena las coordenadas; TU no escribas lat/lng.',",
  "      '3. Para line en un bus_articulado, usa EXACTAMENTE el id que aparece en el catalogo (p. ej. \"C7-001\", \"142I\", \"C1-001\", \"T4-027\").',",
  "      '4. ESTADO ACTUAL: Si preguntan por el estado del sistema, basate en la seccion \"NOTICIAS Y ESTADO EN TIEMPO REAL\".',",
  "      '',",
  "      'REGLAS ANTI-ALUCINACION (Plan D):',",
  "      '- Si NO conoces la parada exacta o el id de ruta, NO incluyas ese paso. Mejor retorna una ruta con menos pasos.',",
  "      '- PROHIBIDO inventar ids como \"C7-999\" o \"Linea X\". Solo usa los ids de CATALOGO DE BUSES INTEGRADOS.',",
  "      '- Para cada step con mode=\"bus_articulado\" incluye _evidence: {sourceRouteId, sourceStopName} citando la fuente del catalogo.',",
  "      '',",
  "      'EJEMPLOS (NO HACER):',",
  "      '- Mal: line:\"C7-999\", station:{nameRef:\"Parada inventada\"}.',",
  "      '- Bien: omitir esa ruta o usar unicamente el id real del catalogo.',",
  "      '',",
  "      'DATOS OFICIALES SITVA 2026:',",
  "      '=== TARIFAS ===',",
  "      tarifas,",
  "      '=== TIEMPOS ===',",
  "      tiempos,",
  "      '=== ENCICLA ===',",
  "      encicla,",
  "      '',",
  "      'INSTRUCCIONES DE RESPUESTA:',",
  "      '1. Identifica paradas de inicio y fin usando las listas CERCANAS.',",
  "      '2. Si recomiendas un Bus Integrado, usa mode: \"bus_articulado\" con line igual al id exacto del catalogo y station.nameRef igual al nombre exacto de la parada de abordaje.',",
  "      '3. Llama a render_route con 2-3 opciones.',",
  "      '4. Responde brevemente en espanol.',",
  "      '',",
  "      'DATOS DE RED SITVA:',",
  "      grounding,",
  "    ].join('\\n');"
];
const newSysPrompt = parts.join(LF);
orig = orig.slice(0, i0) + newSysPrompt + orig.slice(iEnd);

// 3. Pin Gemini config.
const cfgOld = "config: {" + LF + "              systemInstruction: sysPrompt," + LF + "              tools: [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]" + LF + "            }";
const cfgNew = "config: ((cfg: any) => { cfg.systemInstruction = sysPrompt; cfg.tools = [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]; cfg.temperature = 0.2; cfg.topP = 0.8; if ('seed' in cfg) cfg.seed = 42; return cfg; })({})";
if (orig.indexOf(cfgOld) === -1) throw new Error('cfg');
orig = orig.replace(cfgOld, cfgNew);

// 4. Plan D hooks after `route.validation = validation;`
const anchorOld = "route.validation = validation;";
const anchorNew =
  "route.validation = validation;" + LF +
  "// Plan D - Defense A: real summary across all modes (bus + metro family)." + LF +
  "try {" + LF +
  "  const officialStations = await loadStations();" + LF +
  "  const stationMap = officialStations.map((s: any) => ({ nombre: s.nombre, lat: s.lat, lng: s.lng, sistema: s.sistema, linea: s.linea }));" + LF +
  "  route.validation.summary = summarizeRouteValidation([route], allRoutes, stationMap);" + LF +
  "  route.validation.evidenceScore = computeEvidenceScore(route);" + LF +
  "  if (route.userOrigin && typeof route.userOrigin.lat === 'number' && typeof route.userOrigin.lng === 'number') {" + LF +
  "    const v = validateUserCoords({ lat: route.userOrigin.lat, lng: route.userOrigin.lng }, stationMap);" + LF +
  "    route.validation.userOriginValid = v.ok;" + LF +
  "  }" + LF +
  "  if (route.userDest && typeof route.userDest.lat === 'number' && typeof route.userDest.lng === 'number') {" + LF +
  "    const v = validateUserCoords({ lat: route.userDest.lat, lng: route.userDest.lng }, stationMap);" + LF +
  "    route.validation.userDestValid = v.ok;" + LF +
  "  }" + LF +
  "} catch (_e) { /* non-fatal */ }";
if (orig.indexOf(anchorOld) === -1) throw new Error('anchor');
orig = orig.replace(anchorOld, anchorNew);

// 5. Plan D - Defense D: honesty + telemetry before per-route loop.
const honestyAnchor = "          const allRoutes = await getIntegratedRoutes();" + LF + "          for (const route of args.routes) {";
const honestyBlock =
  "          // Plan D - Defense D: honesty + telemetry aggregated before per-route validation." + LF +
  "          try {" + LF +
  "            const assessment: HonestyAssessment = computeHonestyAssessment(args.routes as any);" + LF +
  "            (args as any).__honestyAssessment = assessment;" + LF +
  "            for (const r of args.routes) {" + LF +
  "              if (!r.validation) r.validation = { ok: true, validatedSteps: 0, degradedSteps: 0, busLegs: [], degradedReasons: [] };" + LF +
  "              r.validation.assessment = assessment.level;" + LF +
  "              r.validation.assessmentLabel = assessment.label;" + LF +
  "            }" + LF +
  "          } catch (_e) { /* non-fatal */ }" + LF +
  "          try {" + LF +
  "            const sums = { v: 0, d: 0 };" + LF +
  "            for (const r of args.routes) {" + LF +
  "              const sm = r.validation && r.validation.summary;" + LF +
  "              if (sm) { sums.v += sm.validatedSteps || 0; sums.d += sm.degradedSteps || 0; }" + LF +
  "            }" + LF +
  "            recordSession(undefined, sums.v, sums.d);" + LF +
  "          } catch (_e) { /* non-fatal */ }" + LF +
  "          const allRoutes = await getIntegratedRoutes();" + LF +
  "          for (const route of args.routes) {";
if (orig.indexOf(honestyAnchor) === -1) throw new Error('honesty anchor');
orig = orig.replace(honestyAnchor, honestyBlock);

// Restore CRLF for consistency with the rest of the repo.
orig = orig.split(LF).join(CRLF);
fs.writeFileSync('src/lib/gemini.ts', orig, 'utf8');
console.log('patched', orig.length);
