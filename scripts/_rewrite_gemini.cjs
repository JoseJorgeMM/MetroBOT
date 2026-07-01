const fs = require('fs');
const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);
let orig = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const importOld = "import { reconstructBusStep } from './routeValidator';" + CRLF + "import { enrichStation } from './stationResolver';";
const importNew = "import { reconstructBusStep, summarizeRouteValidation, validateUserCoords } from './routeValidator';" + CRLF + "import { enrichStation } from './stationResolver';" + CRLF + "import { computeHonestyAssessment, HonestyAssessment } from './honesty';" + CRLF + "import { computeEvidenceScore } from './evidence';" + CRLF + "import { recordSession } from './validatorTelemetry';";
if (orig.indexOf(importOld) === -1) throw new Error('imports');
orig = orig.replace(importOld, importNew);

const sysPromptStart = "    const sysPrompt = '";
const sysPromptEnd = "DATOS DE RED SITVA:" + "\\n' + grounding;";
const i0 = orig.indexOf(sysPromptStart);
const i1 = orig.indexOf(sysPromptEnd);
if (i0 === -1 || i1 === -1 || i1 < i0) throw new Error('sysPrompt');
const iEnd = i1 + sysPromptEnd.length;

const lines = [];
lines.push("    const sysPrompt = [");
lines.push("      'Eres MetroBot, el asistente inteligente de movilidad de SITVA (Metro, Metrocable, Tranvia, Metroplus, EnCicla y Buses Articulados) en Medellin Colombia.',");
lines.push("      'Tu objetivo es dar rutas REALISTAS y UTILES. Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses).',");
lines.push("      '',");
lines.push("      '=== NOTICIAS Y ESTADO EN TIEMPO REAL ===',");
lines.push("      newsContext,");
lines.push("      '',");
lines.push("      'REGLAS DE ORO (CRITICO):',");
lines.push("      '1. MINIMIZAR CAMINATA: Si hay una parada de BUS ARTICULADO cerca del usuario, usala.',");
lines.push("      '2. NO INVENTAR: NUNCA inventes ids de ruta, nombres de paradas ni coordenadas. Para step.station, originStation, destinationStation SOLO puedes usar nameRef (un string EXACTO del catalogo o de la lista de paradas cercanas). El sistema rellena las coordenadas; TU no escribas lat/lng.',");
lines.push("      '3. Para line en un bus_articulado, usa EXACTAMENTE el id que aparece en el catalogo (p. ej. \"C7-001\", \"142I\", \"C1-001\", \"T4-027\").',");
lines.push("      '4. ESTADO ACTUAL: Si preguntan por el estado del sistema, basate en la seccion \"NOTICIAS Y ESTADO EN TIEMPO REAL\".',");
lines.push("      '',");
lines.push("      'REGLAS ANTI-ALUCINACION (Plan D):',");
lines.push("      '- Si NO conoces la parada exacta o el id de ruta, NO incluyas ese paso. Mejor retorna una ruta con menos pasos.',");
lines.push("      '- PROHIBIDO inventar ids como \"C7-999\" o \"Linea X\". Solo usa los ids de CATALOGO DE BUSES INTEGRADOS.',");
lines.push("      '- Para cada step con mode=\"bus_articulado\" incluye _evidence: {sourceRouteId, sourceStopName} citando la fuente del catalogo.',");
lines.push("      '',");
lines.push("      'EJEMPLOS (NO HACER):',");
lines.push("      '- Mal: line:\"C7-999\", station:{nameRef:\"Parada inventada\"}.',");
lines.push("      '- Bien: omitir esa ruta o usar unicamente el id real del catalogo.',");
lines.push("      '',");
lines.push("      'DATOS OFICIALES SITVA 2026:',");
lines.push("      '=== TARIFAS ===',");
lines.push("      tarifas,");
lines.push("      '=== TIEMPOS ===',");
lines.push("      tiempos,");
lines.push("      '=== ENCICLA ===',");
lines.push("      encicla,");
lines.push("      '',");
lines.push("      'INSTRUCCIONES DE RESPUESTA:',");
lines.push("      '1. Identifica paradas de inicio y fin usando las listas CERCANAS.',");
lines.push("      '2. Si recomiendas un Bus Integrado, usa mode: \"bus_articulado\" con line igual al id exacto del catalogo y station.nameRef igual al nombre exacto de la parada de abordaje.',");
lines.push("      '3. Llama a render_route con 2-3 opciones.',");
lines.push("      '4. Responde brevemente en espanol.',");
lines.push("      '',");
lines.push("      'DATOS DE RED SITVA:',");
lines.push("      grounding,");
lines.push("    ].join('\\n');");

const newSysPrompt = lines.join('\n');
orig = orig.slice(0, i0) + newSysPrompt + orig.slice(iEnd);

const cfgOld = "config: {" + CRLF + "              systemInstruction: sysPrompt," + CRLF + "              tools: [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]" + CRLF + "            }";
const cfgNew = "config: ((cfg: any) => { cfg.systemInstruction = sysPrompt; cfg.tools = [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]; cfg.temperature = 0.2; cfg.topP = 0.8; if ('seed' in cfg) cfg.seed = 42; return cfg; })({})";
if (orig.indexOf(cfgOld) === -1) throw new Error('cfg');
orig = orig.replace(cfgOld, cfgNew);

const stationCloseOld = "description: 'The station where this step occurs or ends. Only nameRef is accepted; coordinates are filled from the catalog.'" + CRLF + "              }";
const stationCloseNew =
  "description: 'The station where this step occurs or ends. Only nameRef is accepted; coordinates are filled from the catalog.'" + CRLF +
  "              }," + CRLF +
  "              _evidence: {" + CRLF +
  "                type: Type.OBJECT," + CRLF +
  "                description: 'Citation: source catalog entry for this step (anti-hallucination).'," + CRLF +
  "                properties: {" + CRLF +
  "                  sourceRouteId: { type: Type.STRING, description: 'Exact route id from the catalog.' }," + CRLF +
  "                  sourceStopName: { type: Type.STRING, description: 'Exact stop name from the catalog.' }" + CRLF +
  "                }" + CRLF +
  "              }";
if (orig.indexOf(stationCloseOld) === -1) throw new Error('schema station');
orig = orig.replace(stationCloseOld, stationCloseNew);

const anchorOld = "route.validation = validation;";
const anchorNew =
  "route.validation = validation;" + CRLF +
  "// Plan D - Defense A: real summary across all modes (bus + metro family)." + CRLF +
  "try {" + CRLF +
  "  const officialStations = await loadStations();" + CRLF +
  "  const stationMap = officialStations.map((s: any) => ({ nombre: s.nombre, lat: s.lat, lng: s.lng, sistema: s.sistema, linea: s.linea }));" + CRLF +
  "  route.validation.summary = summarizeRouteValidation([route], allRoutes, stationMap);" + CRLF +
  "  route.validation.evidenceScore = computeEvidenceScore(route);" + CRLF +
  "  if (route.userOrigin && typeof route.userOrigin.lat === 'number' && typeof route.userOrigin.lng === 'number') {" + CRLF +
  "    const v = validateUserCoords({ lat: route.userOrigin.lat, lng: route.userOrigin.lng }, stationMap);" + CRLF +
  "    route.validation.userOriginValid = v.ok;" + CRLF +
  "  }" + CRLF +
  "  if (route.userDest && typeof route.userDest.lat === 'number' && typeof route.userDest.lng === 'number') {" + CRLF +
  "    const v = validateUserCoords({ lat: route.userDest.lat, lng: route.userDest.lng }, stationMap);" + CRLF +
  "    route.validation.userDestValid = v.ok;" + CRLF +
  "  }" + CRLF +
  "} catch (_e) { /* non-fatal */ }";
if (orig.indexOf(anchorOld) === -1) throw new Error('anchor');
orig = orig.replace(anchorOld, anchorNew);

const honestyAnchor = "          const allRoutes = await getIntegratedRoutes();" + CRLF + "          for (const route of args.routes) {";
const honestyBlock =
  "          // Plan D - Defense D: honesty + telemetry aggregated before per-route validation." + CRLF +
  "          try {" + CRLF +
  "            const assessment: HonestyAssessment = computeHonestyAssessment(args.routes as any);" + CRLF +
  "            (args as any).__honestyAssessment = assessment;" + CRLF +
  "            for (const r of args.routes) {" + CRLF +
  "              if (!r.validation) r.validation = { ok: true, validatedSteps: 0, degradedSteps: 0, busLegs: [], degradedReasons: [] };" + CRLF +
  "              r.validation.assessment = assessment.level;" + CRLF +
  "              r.validation.assessmentLabel = assessment.label;" + CRLF +
  "            }" + CRLF +
  "          } catch (_e) { /* non-fatal */ }" + CRLF +
  "          try {" + CRLF +
  "            const sums = { v: 0, d: 0 };" + CRLF +
  "            for (const r of args.routes) {" + CRLF +
  "              const sm = r.validation && r.validation.summary;" + CRLF +
  "              if (sm) { sums.v += sm.validatedSteps || 0; sums.d += sm.degradedSteps || 0; }" + CRLF +
  "            }" + CRLF +
  "            recordSession(undefined, sums.v, sums.d);" + CRLF +
  "          } catch (_e) { /* non-fatal */ }" + CRLF +
  "          const allRoutes = await getIntegratedRoutes();" + CRLF +
  "          for (const route of args.routes) {";
if (orig.indexOf(honestyAnchor) === -1) throw new Error('honesty anchor');
orig = orig.replace(honestyAnchor, honestyBlock);

fs.writeFileSync('src/lib/gemini.ts', orig, 'utf8');
console.log('rewrote', orig.length);
