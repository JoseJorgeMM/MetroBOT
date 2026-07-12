// src/lib/geminiPrompt.ts
// -----------------------------------------------------------------------------
// Pure builder for the Gemini render_route system prompt. Mirrors
// tests/_gemini_prompt_impl.mjs so the same contract is tested in Node and
// used at runtime in the browser.
// -----------------------------------------------------------------------------

// Number of integrated-bus routes surfaced in the system prompt. The catalog
// holds ~125 routes total; sending fewer left unknown ids that Gemini would
// hallucinate (e.g. "C7-999"). Surfacing more ids + more stops per route gives
// the model exact nameRef material so it can cite real paradas. See
// tests/_gemini_prompt_impl.mjs for the mirrored contract.
export const BUS_CATALOG_CAP = 60;
export const STATION_CATALOG_CAP = 30;

export interface SysPromptParts {
  grounding?: string;
  integratedSnippet?: string;
  stationSnippet?: string;
  tarifas?: string;
  tiempos?: string;
  encicla?: string;
  news?: string;
  allowBuses?: boolean;
}

export function buildSysPrompt(parts: SysPromptParts = {}): string {
  const grounding = parts.grounding ?? '';
  const integratedSnippet = parts.integratedSnippet ?? '';
  const stationSnippet = parts.stationSnippet ?? '';
  const tarifas = parts.tarifas ?? '';
  const tiempos = parts.tiempos ?? '';
  const encicla = parts.encicla ?? '';
  const news = parts.news ?? '';
  const allowBuses = parts.allowBuses !== false; // default true unless explicitly disabled

  // When the user disables articulated buses, forbid the mode outright and drop
  // the bus catalog so the model has nothing to hallucinate from. The catalog
  // snippet is replaced with an empty string here; gemini.ts also zeroes the
  // nearby-bus context when allowBuses is false.
  const busBlock = allowBuses ? '' : (
    'REGLA BLOQUEO BUSES: El usuario ha DESACTIVADO los buses articulados. ' +
    'NO uses mode "bus_articulado" bajo ninguna circunstancia. ' +
    'Arma la ruta unicamente con Metro, Metrocable, Tranvia, Metroplus, EnCicla y caminata. ' +
    'Ignora el catalogo de buses integrados.'
  );
  const effectiveIntegratedSnippet = allowBuses ? integratedSnippet : '';

  return [
    'Eres MetroBot, el asistente inteligente de movilidad de SITVA (Metro, Metrocable, Tranvia, Metroplus, EnCicla y Buses Articulados) en Medellin Colombia.',
    'Tu objetivo es dar rutas REALISTAS y UTILES sobre la red SITVA del Valle de Aburra.',
    '',
    '=== NOTICIAS Y ESTADO EN TIEMPO REAL ===',
    news,
    '',
    'REGLA 0 (BACKBONE SITVA - CRITICO):',
    '1. Si el origen Y el destino estan a menos de 1.5 km de una estacion SITVA (Metro, Metrocable, Tranvia, Metroplus o EnCicla), la ruta DEBE usar SITVA como backbone. Los buses solo se sugieren como (a) alimentador desde zonas SIN cobertura SITVA o (b) cuando el usuario pide explicitamente bus.',
    '2. NO INVENTAR: NUNCA inventes ids de ruta, nombres de paradas ni coordenadas. Para step.station, originStation, destinationStation SOLO puedes usar nameRef (un string EXACTO del catalogo o de la lista de paradas cercanas). El sistema rellena las coordenadas; TU no escribas lat/lng.',
    '3. Para line en un bus_articulado, usa EXACTAMENTE el id que aparece en el catalogo (p. ej. "C7-001", "142I", "C1-001", "T4-027").',
    '4. ESTADO ACTUAL: Si preguntan por el estado del sistema, basate en la seccion "NOTICIAS Y ESTADO EN TIEMPO REAL".',
    '',
    'REGLAS ANTI-ALUCINACION (Plan D):',
    '- Si NO conoces la parada exacta o el id de ruta, NO incluyas ese paso. Mejor retorna una ruta con menos pasos.',
    '- PROHIBIDO inventar ids como "C7-999" o "Linea X". Solo usa los ids de CATALOGO DE BUSES INTEGRADOS.',
    '- Para cada step con mode="bus_articulado" incluye _evidence: {sourceRouteId, sourceStopName} citando la fuente del catalogo.',
    busBlock,
    '',
    'EJEMPLOS (NO HACER):',
    '- Mal: line:"C7-999", station:{nameRef:"Parada inventada"}.',
    '- Bien: omitir esa ruta o usar unicamente el id real del catalogo.',
    '',
    'DATOS OFICIALES SITVA 2026:',
    '=== TARIFAS ===',
    tarifas,
    '=== TIEMPOS ===',
    tiempos,
    '=== ENCICLA ===',
    encicla,
    '',
    'CATALOGO DE ESTACIONES SITVA (Linea, Sistema):',
    stationSnippet,
    '',
    'INSTRUCCIONES DE RESPUESTA:',
    '1. Identifica paradas de inicio y fin usando las listas CERCANAS.',
    '2. Si recomiendas un Bus Integrado, usa mode: "bus_articulado" con line igual al id exacto del catalogo y station.nameRef igual al nombre exacto de la parada de abordaje.',
    '3. Llama a render_route con 2-3 opciones.',
    '4. Responde brevemente en espanol.',
    '',
    'CATALOGO DE BUSES INTEGRADOS (ids validos, parcial):',
    effectiveIntegratedSnippet,
    '',
    'OTRAS ESTACIONES DEL SISTEMA:',
    grounding,
  ].join('\n');
}
