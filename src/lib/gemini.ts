import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { getStationStatus } from './routing';
import { loadStations, calculateDistance } from './stations';
import { getLocalOfflineRoute } from './localRouter';
import { fetchMetroNews } from './news';
import { loadIntegratedRoutes, findIntegratedRoutesNear, findIntegratedRoutesNearFull, IntegratedRoute, IntegratedStop } from './integratedRoutes';
import { reconstructBusStep, summarizeRouteValidation, validateUserCoords, isRouteUnsafe, BUS_UNSAFE_THRESHOLD } from './routeValidator';
import { enrichStation } from './stationResolver';
import { computeHonestyAssessment, HonestyAssessment } from './honesty';
import { computeEvidenceScore } from './evidence';
import { recordSession } from './validatorTelemetry';
import { buildSysPrompt, BUS_CATALOG_CAP, STATION_CATALOG_CAP } from './geminiPrompt';

const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "DUMMY_KEY").split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getAiInstance() {
  const apiKey = apiKeys[currentKeyIndex];
  return new GoogleGenAI({ apiKey });
}

let cachedStations = '';
let cachedTarifas = '';

async function getGroundingData() {
  if (cachedStations) return cachedStations;
  const stations = await loadStations();
  cachedStations = stations.map(s => s.nombre + ' (' + s.sistema + ' - Linea ' + s.linea + '): LAT ' + s.lat.toFixed(5) + ', LNG ' + s.lng.toFixed(5)).join('\n');
  return cachedStations;
}

async function getTarifasData() {
  if (cachedTarifas) return cachedTarifas;
  try {
    const res = await fetch('/tarifas_metro_medellin_2026.csv');
    if (res.ok) cachedTarifas = await res.text();
  } catch (e) { console.error("Error cargando CSV de tarifas:", e); }
  return cachedTarifas;
}

async function getRecentNewsContext() {
  try {
    const news = await fetchMetroNews();
    if (news.length === 0) return "No hay noticias recientes reportadas.";
    return news.slice(0, 5).map(n => '- [' + n.pubDate + '] ' + n.title).join('\n');
  } catch (e) {
    return "Error al cargar noticias en tiempo real.";
  }
}

const renderRouteDeclaration = {
  name: 'render_route',
  description: 'Calculates and displays the optimal public transit routes between a start and end location in Medellin.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      routes: {
        type: Type.ARRAY,
        description: 'An array of proposed realistic routes based on the real map of the Metro de Medellin network.',
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            userOrigin: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              },
              description: 'The physical start location requested by the user, WITH accurate coordinates (LAT/LNG) found via your knowledge. MUST be provided if the user specifies a physical location like a neighborhood, hospital, etc.'
            },
            userDest: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              },
              description: 'The physical destination location requested by the user, WITH accurate coordinates (LAT/LNG) found via your knowledge. MUST be provided if the user specifies a physical location.'
            },
            originStation: {
              type: Type.OBJECT,
              properties: {
                nameRef: { type: Type.STRING, description: 'EXACT name or id of a station from the catalog. NEVER invent.' }
              },
              description: 'The starting public transit station. MUST be an official station from the data. Only nameRef is accepted; the app fills coordinates from the catalog.'
            },
            destinationStation: {
              type: Type.OBJECT,
              properties: {
                nameRef: { type: Type.STRING, description: 'EXACT name or id of a station from the catalog. NEVER invent.' }
              },
              description: 'The final public transit station. MUST be an official station from the data. Only nameRef is accepted; the app fills coordinates from the catalog.'
            },
            modes: {
              type: Type.ARRAY,
              items: { type: Type.STRING, description: "'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'bus_articulado' | 'encicla' | 'walk'" }
            },
            duration: { type: Type.INTEGER, description: 'Total duration in minutes' },
            cost: { type: Type.INTEGER, description: 'Total cost in COP (e.g., 3430)' },
            transfers: { type: Type.INTEGER },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  instruction: { type: Type.STRING, description: 'Clear instruction e.g. "Camina a la estaci\u00f3n Acevedo"' },
                  mode: { type: Type.STRING, description: "'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'bus_articulado' | 'encicla' | 'walk'" },
                  duration: { type: Type.INTEGER },
                  cost: { type: Type.INTEGER, description: 'The individual cost of this step in COP. Set to 0 if it is a free transfer, walk or EnCicla.' },
                  line: { type: Type.STRING, description: 'Optional. For bus_articulado, this MUST be the EXACT id of a route in the catalog (e.g. "C7-001", "142I").' },
                  station: {
                    type: Type.OBJECT,
                    properties: {
                      nameRef: { type: Type.STRING, description: 'EXACT name of a real bus stop or station from the catalog. NEVER invent.' }
                    },
                    description: 'The station where this step occurs or ends. Only nameRef is accepted; coordinates are filled from the catalog.'
                  },
                  _evidence: {
                    type: Type.OBJECT,
                    description: 'Citation: source catalog entry for this step (anti-hallucination).',
                    properties: {
                      sourceRouteId: { type: Type.STRING, description: 'Exact route id from the catalog.' },
                      sourceStopName: { type: Type.STRING, description: 'Exact stop name from the catalog.' }
                    }
                  }
                },
                required: ['instruction', 'mode', 'duration']
              }
            }
          },
          required: ['id', 'modes', 'duration', 'cost', 'transfers', 'steps', 'originStation', 'destinationStation']
        }
      }
    },
    required: ['routes']
  }
};

const getStationStatusDeclaration = {
  name: 'get_station_status',
  description: 'Get the current operational status of a specific station or line.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      stationId: { type: Type.STRING, description: 'The name or ID of the station/line (e.g., "Metrocable Line K", "Poblado").' }
    },
    required: ['stationId']
  }
};

let cachedEnCicla = '';
async function getEnCiclaData() {
  if (cachedEnCicla) return cachedEnCicla;
  try {
    const res = await fetch('/Estaciones_En_Cicla.csv');
    if (res.ok) cachedEnCicla = await res.text();
  } catch (e) { console.error("Error cargando EnCicla CSV:", e); }
  return cachedEnCicla;
}

let cachedIntegratedRoutes = null;
async function getIntegratedRoutes() {
  if (cachedIntegratedRoutes) return cachedIntegratedRoutes;
  cachedIntegratedRoutes = await loadIntegratedRoutes();
  return cachedIntegratedRoutes;
}

let cachedTiempos = '';
async function getTiemposData() {
  if (cachedTiempos) return cachedTiempos;
  try {
    const res = await fetch('/tiempos_desplazamiento_multimodal.csv');
    if (res.ok) cachedTiempos = await res.text();
  } catch (e) { console.error("Error cargando CSV de tiempos:", e); }
  return cachedTiempos;
}

function formatIntegratedRouteForPrompt(route, nearestOrigin, nearestDest) {
  const originName = nearestOrigin ? nearestOrigin.name : (route.stops[0] && route.stops[0].name || 'inicio');
  const destName = nearestDest ? nearestDest.name : (route.stops[route.stops.length - 1] && route.stops[route.stops.length - 1].name || 'fin');
  const startCoord = nearestOrigin || route.stops[0];
  const endCoord = nearestDest || route.stops[route.stops.length - 1];
  const sLat = startCoord && startCoord.lat && startCoord.lat.toFixed ? startCoord.lat.toFixed(5) : (startCoord && startCoord.lat);
  const sLng = startCoord && startCoord.lng && startCoord.lng.toFixed ? startCoord.lng.toFixed(5) : (startCoord && startCoord.lng);
  const eLat = endCoord && endCoord.lat && endCoord.lat.toFixed ? endCoord.lat.toFixed(5) : (endCoord && endCoord.lat);
  const eLng = endCoord && endCoord.lng && endCoord.lng.toFixed ? endCoord.lng.toFixed(5) : (endCoord && endCoord.lng);
  return '- Bus Integrado ' + route.id + ' (' + route.name + ')' + (route.folder ? ' [Subred ' + route.folder + ']' : '') + ': Abordaje sugerido "' + originName + '" (LAT ' + sLat + ', LNG ' + sLng + '), Bajada sugerida "' + destName + '" (LAT ' + eLat + ', LNG ' + eLng + '). Recorrido completo: ' + route.stops.length + ' paradas.';
}

export async function processUserQuery(query, onRouteFound, onStatusFound, options) {
  try {
    const tarifas = await getTarifasData();
    const encicla = await getEnCiclaData();
    const tiempos = await getTiemposData();
    const allIntegratedRoutes = await getIntegratedRoutes();

    let grounding = '';
    let nearbyContext = '';
    let integratedContext = '';
    // User-facing toggle: when allowBuses is false we drop every bus-articulado
    // signal from the prompt AND downgrade any bus step Gemini still returns.
    // Lets the user empirically test whether hallucinated buses are the source
    // of bad routes by forcing a SITVA-only answer.
    const allowBuses = !(options && (options as any).allowBuses === false);

    if (options && (options.origin || options.dest)) {
      const allStations = await loadStations();
      const originNearby = options.origin
        ? allStations.map(s => ({ ...s, distance: calculateDistance(options.origin.lat, options.origin.lng, s.lat, s.lng), walkingMinutes: Math.ceil(calculateDistance(options.origin.lat, options.origin.lng, s.lat, s.lng) / 80) })).sort((a, b) => a.distance - b.distance).slice(0, 8).map(s => ({ ...s, tag: 'Origen' }))
        : [];
      const destNearby = options.dest
        ? allStations.map(s => ({ ...s, distance: calculateDistance(options.dest.lat, options.dest.lng, s.lat, s.lng), walkingMinutes: Math.ceil(calculateDistance(options.dest.lat, options.dest.lng, s.lat, s.lng) / 80) })).sort((a, b) => a.distance - b.distance).slice(0, 8).map(s => ({ ...s, tag: 'Destino' }))
        : [];
      const relevantStations = originNearby.concat(destNearby).reduce((acc, curr) => {
        if (!acc.find(s => s.id === curr.id)) acc.push(curr);
        return acc;
      }, []);
      nearbyContext = relevantStations.map(s => '- [Para ' + s.tag + '] ' + s.nombre + ' (' + s.sistema + ' - Linea ' + s.linea + '): A ' + Math.round(s.distance) + ' metros (Caminando: ~' + s.walkingMinutes + ' min) - Coord: LAT ' + s.lat.toFixed(5) + ', LNG ' + s.lng.toFixed(5)).join('\n');

      const originHits = (allowBuses && options.origin) ? await findIntegratedRoutesNear(options.origin.lat, options.origin.lng, 1500) : [];
      const destHits = (allowBuses && options.dest) ? await findIntegratedRoutesNear(options.dest.lat, options.dest.lng, 1500) : [];
      const bestBusStops = [];
      for (const h of originHits.slice(0, 10)) bestBusStops.push({ stop: h.closestStop, route: h.route, dist: h.distance, tag: 'Origen' });
      for (const h of destHits.slice(0, 10)) bestBusStops.push({ stop: h.closestStop, route: h.route, dist: h.distance, tag: 'Destino' });
      bestBusStops.sort((a, b) => a.dist - b.dist);
      integratedContext = allowBuses
        ? bestBusStops.map(s => '- [Para ' + s.tag + '] Parada "' + s.stop.name + '" (Bus Articulado ' + s.route.id + '): A ' + Math.round(s.dist) + ' metros (Caminando: ~' + Math.ceil(s.dist / 80) + ' min) - Coord: LAT ' + s.stop.lat.toFixed(5) + ', LNG ' + s.stop.lng.toFixed(5)).join('\n')
        : '';

      // Build a complete-stop catalog for every bus route that passes within
      // 1.5 km of the user's origin or destination. The capped catalog already
      // shown to Gemini only lists the first 6 stops of each route, which made
      // the LLM invent paradas that don't exist on the chosen route. By
      // giving the model the FULL stop list for the routes that are actually
      // relevant to this query (origin or destination nearby), the LLM can
      // pick an exact nameRef from the real data.
      let fullStopsContext = '';
      if (allowBuses) {
        const NEARBY_RADIUS_M = 1500;
        const NEARBY_ROUTE_LIMIT = 15;
        const nearbyRoutes: IntegratedRoute[] = [];
        const seenIds = new Set<string>();
        const collect = (lat: number, lng: number) => {
          for (const r of allIntegratedRoutes) {
            if (seenIds.has(r.id) || nearbyRoutes.length >= NEARBY_ROUTE_LIMIT) continue;
            for (const stop of r.stops) {
              if (calculateDistance(lat, lng, stop.lat, stop.lng) <= NEARBY_RADIUS_M) {
                seenIds.add(r.id);
                nearbyRoutes.push(r);
                break;
              }
            }
          }
        };
        if (options.origin) collect(options.origin.lat, options.origin.lng);
        if (options.dest) collect(options.dest.lat, options.dest.lng);
        if (nearbyRoutes.length > 0) {
          fullStopsContext = 'STOPS COMPLETOS DE RUTAS CERCANAS (radio 1.5 km, hasta ' + NEARBY_ROUTE_LIMIT + ' rutas):\n' +
            nearbyRoutes.map(r => {
              const stopsList = r.stops.map((s, idx) => (idx + 1) + '. ' + s.name).join(' | ');
              return 'Bus ' + r.id + ' (' + r.stops.length + ' paradas): ' + stopsList;
            }).join('\n') + '\n';
        }
      }

      let passingThrough = '';
      if (allowBuses && options.origin && options.dest) {
        const out = [];
        for (const r of allIntegratedRoutes) {
          let oIdx = -1, dIdx = -1;
          for (let i = 0; i < r.stops.length; i++) {
            const dO = calculateDistance(options.origin.lat, options.origin.lng, r.stops[i].lat, r.stops[i].lng);
            const dD = calculateDistance(options.dest.lat, options.dest.lng, r.stops[i].lat, r.stops[i].lng);
            if (dO < 1500 && (oIdx === -1 || dO < calculateDistance(options.origin.lat, options.origin.lng, r.stops[oIdx].lat, r.stops[oIdx].lng))) oIdx = i;
            if (dD < 1500 && (dIdx === -1 || dD < calculateDistance(options.dest.lat, options.dest.lng, r.stops[dIdx].lat, r.stops[dIdx].lng))) dIdx = i;
          }
          if (oIdx !== -1 && dIdx !== -1 && oIdx < dIdx) {
            out.push(formatIntegratedRouteForPrompt(r, r.stops[oIdx], r.stops[dIdx]));
          }
        }
        passingThrough = out.slice(0, 6).join('\n');
      }

      const catalogSnippet = allowBuses ? allIntegratedRoutes.slice(0, BUS_CATALOG_CAP).map(r => r.id + ': ' + r.stops.slice(0, 6).map(s => s.name).join(' | ') + ' ...').join('\n') : '';
      const allGrounding = await getGroundingData();

      // When buses are disabled, strike the whole integrated-bus section from
      // grounding so the model literally has no bus ids to cite.
      grounding = allowBuses
        ? 'ESTACIONES RELEVANTES CERCANAS A LA BUSQUEDA:\n' + nearbyContext + '\n\nPARADAS DE BUSES INTEGRADOS CERCANAS:\n' + integratedContext + (passingThrough ? '\n\nBUSES INTEGRADOS QUE PASAN CERCA DE ORIGEN Y DESTINO:\n' + passingThrough + '\n' : '') + (fullStopsContext ? '\n' + fullStopsContext : '') + '\nCATALOGO DE BUSES INTEGRADOS (ids validos, parcial):\n' + catalogSnippet + '\n\nOTRAS ESTACIONES DEL SISTEMA:\n' + allGrounding
        : 'ESTACIONES RELEVANTES CERCANAS A LA BUSQUEDA:\n' + nearbyContext + '\n\nEL USUARIO DESACTIVO LOS BUSES ARTICULADOS: no incluyas bus_articulado.\n\nOTRAS ESTACIONES DEL SISTEMA:\n' + allGrounding;
    } else {
      grounding = await getGroundingData();
    }

    const newsContext = await getRecentNewsContext();

    // Build the station snippet from the full grounding string. We slice the
    // first STATION_CATALOG_CAP lines so Gemini sees SITVA stations with the
    // same weight as the (now capped) bus catalog.
    const stationSnippet = (typeof grounding === 'string' ? grounding : '').split('\n').slice(0, STATION_CATALOG_CAP).join('\n');
    // When there is no nearby search, surface the capped bus catalog too so
    // the model still has a balanced view of the network.
    const integratedSnippet = (allowBuses && options && (options.origin || options.dest))
      ? (allIntegratedRoutes.slice(0, BUS_CATALOG_CAP).map(r => r.id + ': ' + r.stops.slice(0, 6).map(s => s.name).join(' | ') + ' ...').join('\n'))
      : '';

    const sysPrompt = buildSysPrompt({
      grounding,
      integratedSnippet,
      stationSnippet,
      tarifas,
      tiempos,
      encicla,
      news: newsContext,
      allowBuses,
    });

    const generateWithRotation = async () => {
      let attempts = 0;
      while (attempts < apiKeys.length) {
        try {
          const ai = getAiInstance();
          return await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: ((cfg: any) => { cfg.systemInstruction = sysPrompt; cfg.tools = [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]; cfg.temperature = 0.2; cfg.topP = 0.8; if ('seed' in cfg) cfg.seed = 42; return cfg; })({})
          });
        } catch (error) {
          attempts++;
          const isTransient = error && (error.status === 429 || error.status === 503 || (error.message && (error.message.indexOf('429') !== -1 || error.message.indexOf('503') !== -1 || error.message.indexOf('quota') !== -1 || error.message.indexOf('demand') !== -1)));
          if (isTransient && attempts < apiKeys.length) {
            console.warn('Error temporal en clave ' + currentKeyIndex + ', probando la siguiente...');
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            continue;
          }
          throw error;
        }
      }
    };

    const response = await generateWithRotation();
    const functionCalls = response.functionCalls;
    let textResponse = response.text || '';

    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === 'render_route') {
          const args: any = call.args;
          args.routes.forEach((route) => {
            let totalCost = 0;
            let hasUsedMetroplus = false;
            let currentSystem = '';
            route.steps.forEach((step) => {
              const mode = (step.mode || '').toLowerCase();
              if (mode === 'walk' || mode === 'encicla') { step.cost = 0; return; }
              const isArviLine = step.line === 'L' || step.line === 'Linea L';
              const isArviStation = step.station && step.station.name && step.station.name.toLowerCase && step.station.name.toLowerCase().indexOf('arv') !== -1;
              if (isArviLine || isArviStation) { step.cost = 11900; totalCost += 11900; currentSystem = 'arvi'; return; }
              if (mode === 'metroplus' || step.line === 'O' || step.line === 'Linea O' || step.line === '1' || step.line === 'Linea 1' || step.line === '2' || step.line === 'Linea 2') {
                let stepCost = 0;
                if (currentSystem !== 'metroplus') {
                  if (!hasUsedMetroplus) { stepCost = (totalCost === 0) ? 3820 : 0; hasUsedMetroplus = true; }
                  else { stepCost = 3820; }
                }
                step.cost = stepCost; totalCost += stepCost; currentSystem = 'metroplus';
              } else if (mode === 'metro' || mode === 'metrocable' || mode === 'tranvia') {
                let stepCost = 0;
                if (totalCost === 0) stepCost = 3820;
                else if (currentSystem === 'arvi') stepCost = 3820;
                step.cost = stepCost; totalCost += stepCost; currentSystem = 'metro';
              } else { step.cost = 0; }
            });
            if (totalCost > 0) {
              route.cost = totalCost;
            } else {
              const transitSteps = route.steps.filter(s => { const m = (s.mode || '').toLowerCase(); return m === 'metro' || m === 'metrocable' || m === 'tranvia' || m === 'metroplus'; });
              if (transitSteps.length > 0) {
                route.cost = 3820;
                transitSteps.forEach((s, idx) => { s.cost = (idx === 0) ? 3820 : 0; });
              }
            }
          });

          // Plan D - Defense D: honesty + telemetry aggregated before per-route validation.
          try {
            const assessment: HonestyAssessment = computeHonestyAssessment(args.routes as any);
            (args as any).__honestyAssessment = assessment;
            for (const r of args.routes) {
              if (!r.validation) r.validation = { ok: true, validatedSteps: 0, degradedSteps: 0, busLegs: [], degradedReasons: [] };
              r.validation.assessment = assessment.level;
              r.validation.assessmentLabel = assessment.label;
            }
          } catch (_e) { /* non-fatal */ }
          try {
            const sums = { v: 0, d: 0 };
            for (const r of args.routes) {
              const sm = r.validation && r.validation.summary;
              if (sm) { sums.v += sm.validatedSteps || 0; sums.d += sm.degradedSteps || 0; }
            }
            recordSession(undefined, sums.v, sums.d);
          } catch (_e) { /* non-fatal */ }
          const allRoutes = await getIntegratedRoutes();
          for (const route of args.routes) {
            const validation = { ok: true, validatedSteps: 0, degradedSteps: 0, busLegs: [], degradedReasons: [] };
            if (Array.isArray(route.steps)) {
              for (let i = 0; i < route.steps.length; i++) {
                const original = route.steps[i];
                // Defense-in-depth: if the user disabled buses, force every bus
                // step to a walk regardless of what the model returned. The
                // prompt already says not to emit bus_articulado, but we cannot
                // trust the LLM to obey.
                if (!allowBuses && original && (original.mode || '').toLowerCase() === 'bus_articulado') {
                  original.instruction = 'Camina hacia tu destino (los buses articulados estaban desactivados por el usuario).';
                  original.mode = 'walk';
                  original.cost = 0;
                  original.station = undefined;
                }
                const rec = reconstructBusStep(original, allRoutes);
                route.steps[i] = rec.step;
                if (original.mode === 'bus_articulado') {
                  if (rec.validation.ok && rec.validation.validatedRoute && rec.validation.boardingStop) {
                    validation.validatedSteps++;
                    validation.busLegs.push({
                      routeId: rec.validation.validatedRoute.id,
                      routeName: rec.validation.validatedRoute.name,
                      boardingStop: rec.validation.boardingStop.name,
                      boardingLat: rec.validation.boardingStop.lat,
                      boardingLng: rec.validation.boardingStop.lng,
                      realStops: rec.validation.validatedRoute.stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng }))
                    });
                  } else {
                    validation.degradedSteps++;
                    validation.ok = false;
                    validation.degradedReasons.push(rec.validation.reason || 'invalid');
                  }
                }
              }
            }
            // Plan D - honest bookkeeping: do NOT reset degradedSteps when the
            // route had no valid bus leg. If Gemini emitted a bus_articulado we
            // could not verify, reconstructBusStep already downgraded it to a
            // walk and bumped degradedSteps. Resetting it here would erase the
            // evidence of the hallucinated bus, leaving the route looking clean
            // (confiable/parcial) and showing the false route to the user. Only
            // mark the route ok=false when at least one step was degraded; an
            // empty route (no bus step attempted) keeps ok=true with zeroed counts.
            if (validation.busLegs.length === 0 && validation.degradedSteps === 0) {
              validation.ok = true;
              validation.validatedSteps = 0;
            }
            route.validation = validation;
// Plan D - Defense A: real summary across all modes (bus + metro family).
try {
  const officialStations = await loadStations();
  const stationMap = officialStations.map((s: any) => ({ nombre: s.nombre, lat: s.lat, lng: s.lng, sistema: s.sistema, linea: s.linea }));
  route.validation.summary = summarizeRouteValidation([route], allRoutes, stationMap);
  route.validation.evidenceScore = computeEvidenceScore(route);
  // Plan D - hard-fail: flag the route as unsafe when the bus steps dominate
  // and most of them fail validation. The chat UI drops unsafe routes
  // entirely (see src/App.tsx -> handleSubmit -> (newRoutes) => { ... }).
  const unsafe = isRouteUnsafe(route, allRoutes, stationMap, BUS_UNSAFE_THRESHOLD);
  route.validation.unsafe = unsafe.unsafe;
  route.validation.unsafeReason = unsafe.reason;
  if (route.userOrigin && typeof route.userOrigin.lat === 'number' && typeof route.userOrigin.lng === 'number') {
    const v = validateUserCoords({ lat: route.userOrigin.lat, lng: route.userOrigin.lng }, stationMap);
    route.validation.userOriginValid = v.ok;
  }
  if (route.userDest && typeof route.userDest.lat === 'number' && typeof route.userDest.lng === 'number') {
    const v = validateUserCoords({ lat: route.userDest.lat, lng: route.userDest.lng }, stationMap);
    route.validation.userDestValid = v.ok;
  }
} catch (_e) { /* non-fatal */ }
          }
          // Resolve nameRef-only stations to real coords from the catalog
                      // (originStation, destinationStation and every step.station).
                      for (const route of args.routes) {
                        if (route.originStation) route.originStation = await enrichStation(route.originStation);
                        if (route.destinationStation) route.destinationStation = await enrichStation(route.destinationStation);
                        if (Array.isArray(route.steps)) {
                          for (let i = 0; i < route.steps.length; i++) {
                            if (route.steps[i].station) {
                              route.steps[i].station = await enrichStation(route.steps[i].station, route.steps[i].mode);
                            }
                          }
                        }
                      }
                      onRouteFound(args.routes);
        } else if (call.name === 'get_station_status') {
          const status = await getStationStatus((call.args as any).stationId);
          onStatusFound(status);
          return 'Estado para ' + ((call.args as any).stationId) + ': ' + status;
        }
      }
    }
    return textResponse || 'No estoy seguro de como ayudarte con eso.';
  } catch (error) {
    console.warn('Gemini API Error, falling back to local routing:', error);
    try {
      let originLat = options && options.origin && options.origin.lat;
      let originLng = options && options.origin && options.origin.lng;
      let destLat = options && options.dest && options.dest.lat;
      let destLng = options && options.dest && options.dest.lng;
      if (!originLat || !destLat) {
        const stations = await loadStations();
        const foundStations = [];
        const queryLower = query.toLowerCase();
        const sortedStations = stations.slice().sort((a, b) => b.nombre.length - a.nombre.length);
        sortedStations.forEach(s => {
          const nameLower = s.nombre.toLowerCase();
          if (queryLower.indexOf(nameLower) !== -1 && !foundStations.some(fs => fs.nombre === s.nombre)) foundStations.push(s);
        });
        if (foundStations.length >= 2) {
          originLat = foundStations[0].lat; originLng = foundStations[0].lng;
          destLat = foundStations[1].lat; destLng = foundStations[1].lng;
        }
      }
      if (originLat && originLng && destLat && destLng) {
        const offlineRoutes = await getLocalOfflineRoute(originLat, originLng, destLat, destLng);
        if (offlineRoutes && offlineRoutes.length > 0) { onRouteFound(offlineRoutes); return 'Modo Sin Conexion Activo.'; }
      }
    } catch (offlineError) { console.error('Local routing fallback failed:', offlineError); }
    return 'Error al calcular la ruta.';
  }
}