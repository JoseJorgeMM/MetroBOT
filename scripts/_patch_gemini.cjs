const fs = require('fs');
let s = fs.readFileSync('src/lib/gemini.ts', 'utf8');

const oldImport = "import { reconstructBusStep } from './routeValidator';\nimport { enrichStation } from './stationResolver';";
const newImport = "import { reconstructBusStep, summarizeRouteValidation, validateUserCoords } from './routeValidator';\nimport { enrichStation } from './stationResolver';\nimport { computeHonestyAssessment, HonenessAssessment, HonestyLevel, HonestyAssessment } from './honesty';\nimport { computeEvidenceScore } from './evidence';\nimport { recordSession } from './validatorTelemetry';";
if (s.indexOf(oldImport) === -1) throw new Error('imports block not found');
s = s.replace(oldImport, newImport);

// Anti-hallucination prompt tail inserted just before `DATOS DE RED SITVA:`.
const oldPromptTail = "DATOS DE RED SITVA:\\n' + grounding;";
const newPromptTail = [
  "REGLAS ANTI-ALUCINACION (NUEVO):",
  "- Si NO conoces la parada exacta o el id de ruta, NO incluyas ese paso. Mejor retorna una ruta con menos pasos.",
  "- PROHIBIDO inventar ids como \"C7-999\" o \"Linea X\". Solo usa los ids de CATALOGO DE BUSES INTEGRADOS.",
  "- Para cada step con mode=\"bus_articulado\" incluye _evidence: {sourceRouteId, sourceStopName} citando la fuente del catalogo.",
  "EJEMPLOS (NO HACER):",
  "- Mal: line:\"C7-999\", station:{nameRef:\"Parada inventada\"}.",
  "- Bien: omitir esa ruta o usar unicamente el id real del catalogo.",
  "DATOS DE RED SITVA:\\n' + grounding;"
].join('\n');
if (s.indexOf(oldPromptTail) === -1) throw new Error('prompt tail not found');
s = s.replace(oldPromptTail, newPromptTail);

// _evidence property in schema.
const stationClose = "description: 'The station where this step occurs or ends. Only nameRef is accepted; coordinates are filled from the catalog.'";
if (s.indexOf(stationClose) === -1) throw new Error('station close not found');
const evidenceProp = [
  stationClose,
  "              },",
  "              _evidence: {",
  "                type: Type.OBJECT,",
  "                description: 'Citation: source catalog entry for this step (anti-hallucination).',",
  "                properties: {",
  "                  sourceRouteId: { type: Type.STRING, description: 'Exact route id from the catalog.' },",
  "                  sourceStopName: { type: Type.STRING, description: 'Exact stop name from the catalog.' }",
  "                }",
  "              }"
].join('\n');
s = s.replace(stationClose + "\n              }", evidenceProp);

// Pin Gemini config.
const oldConfig = "config: {\n              systemInstruction: sysPrompt,\n              tools: [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]\n            }";
const newConfig = "config: ((cfg: any) => { cfg.systemInstruction = sysPrompt; cfg.tools = [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]; cfg.temperature = 0.2; cfg.topP = 0.8; if ('seed' in cfg) cfg.seed = 42; return cfg; }) ({})";
if (s.indexOf(oldConfig) === -1) throw new Error('config block not found');
s = s.replace(oldConfig, newConfig);

const oldGenerateStart = "const generateWithRotation = async () => {";
const newGenerateStart = "let hasRetriedJsonMime = false;\n    const generateWithRotation = async () => {";
s = s.replace(oldGenerateStart, newGenerateStart);

// Insert Plan D - Defense A/C/D hooks after `route.validation = validation;`
const anchor = "route.validation = validation;";
if (s.indexOf(anchor) === -1) throw new Error('anchor not found');
const summaryBlock = [
  "route.validation = validation;",
  "// Plan D - Defense A: real summary across all modes.",
  "try {",
  "  const officialStations = await loadStations();",
  "  route.validation.summary = summarizeRouteValidation([route], allRoutes, officialStations.map(s => ({ nombre: s.nombre, lat: s.lat, lng: s.lng, sistema: s.sistema, linea: s.linea })));",
  "  route.validation.evidenceScore = computeEvidenceScore(route);",
  "  if (route.userOrigin && typeof route.userOrigin.lat === 'number' && typeof route.userOrigin.lng === 'number') {",
  "    const v = validateUserCoords({ lat: route.userOrigin.lat, lng: route.userOrigin.lng }, officialStations.map(s => ({ nombre: s.nombre, lat: s.lat, lng: s.lng, sistema: s.sistema, linea: s.linea })));",
  "    route.validation.userOriginValid = v.ok;",
  "  }",
  "  if (route.userDest && typeof route.userDest.lat === 'number' && typeof route.userDest.lng === 'number') {",
  "    const v = validateUserCoords({ lat: route.userDest.lat, lng: route.userDest.lng }, officialStations.map(s => ({ nombre: s.nombre, lat: s.lat, lng: s.lng, sistema: s.sistema, linea: s.linea })));",
  "    route.validation.userDestValid = v.ok;",
  "  }",
  "} catch (_e) { /* non-fatal */ }"
].join('\n');
s = s.replace(anchor, summaryBlock);

fs.writeFileSync('src/lib/gemini.ts', s, 'utf8');
console.log('patched', s.length);
