import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { getStationStatus } from './routing';
import { loadStations, calculateDistance } from './stations';
import { getLocalOfflineRoute } from './localRouter';
import { fetchMetroNews } from './news';
import { loadIntegratedRoutes, findIntegratedRoutesNear, IntegratedRoute, IntegratedStop } from './integratedRoutes';

const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "DUMMY_KEY").split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getAiInstance() {
  const apiKey = apiKeys[currentKeyIndex];
  return new GoogleGenAI({ apiKey });
}

let cachedStations: string = '';
let cachedTarifas: string = '';

async function getGroundingData() {
  if (cachedStations) return cachedStations;
  const stations = await loadStations();
  cachedStations = stations.map(s => `${s.nombre} (${s.sistema} - Linea ${s.linea}): LAT ${s.lat.toFixed(5)}, LNG ${s.lng.toFixed(5)}`).join('\n');
  return cachedStations;
}

async function getTarifasData() {
  if (cachedTarifas) return cachedTarifas;
  try {
    const res = await fetch('/tarifas_metro_medellin_2026.csv');
    if (res.ok) {
      cachedTarifas = await res.text();
    }
  } catch (e) {
    console.error("Error cargando CSV de tarifas:", e);
  }
  return cachedTarifas;
}

async function getRecentNewsContext() {
  try {
    const news = await fetchMetroNews();
    if (news.length === 0) return "No hay noticias recientes reportadas.";
    return news.slice(0, 5).map(n => `- [${n.pubDate}] ${n.title}`).join('\n');
  } catch (e) {
    return "Error al cargar noticias en tiempo real.";
  }
}

const renderRouteDeclaration: FunctionDeclaration = {
  name: 'render_route',
  description: 'Calculates and displays the optimal public transit routes between a start and end location in Medell\u00edn.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      routes: {
        type: Type.ARRAY,
        description: 'An array of proposed realistic routes based on the real map of the Metro de Medell\u00edn network.',
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
                name: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              },
              description: 'The starting public transit station of this route. MUST be an official station from the data, not the user\'s physical start location.'
            },
            destinationStation: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                lat: { type: Type.NUMBER },
                lng: { type: Type.NUMBER }
              },
              description: 'The final public transit station of this route. MUST be an official station from the data, not the user\'s physical destination location.'
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
                  instruction: { type: Type.STRING, description: 'Clear instruction e.g. "Camina a la estaci\u00f3n Acevedo", "Toma la L\u00ednea A hacia La Estrella"' },
                  mode: { type: Type.STRING, description: "'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'bus_articulado' | 'encicla' | 'walk'" },
                  duration: { type: Type.INTEGER },
                  cost: { type: Type.INTEGER, description: 'The individual cost of this step in COP (e.g., 0 or 3820). Set to 0 if it is a free transfer, walk or EnCicla.' },
                  line: { type: Type.STRING, description: 'Optional. e.g., "L\u00ednea A"' },
                  station: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      lat: { type: Type.NUMBER },
                      lng: { type: Type.NUMBER }
                    },
                    description: 'The station where this step occurs or ends.'
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

const getStationStatusDeclaration: FunctionDeclaration = {
  name: 'get_station_status',
  description: 'Get the current operational status of a specific station or line.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      stationId: {
        type: Type.STRING,
        description: 'The name or ID of the station/line (e.g., "Metrocable Line K", "Poblado").'
      }
    },
    required: ['stationId']
  }
};

let cachedEnCicla: string = '';

async function getEnCiclaData() {
  if (cachedEnCicla) return cachedEnCicla;
  try {
    const res = await fetch('/Estaciones_En_Cicla.csv');
    if (res.ok) {
      cachedEnCicla = await res.text();
    }
  } catch (e) {
    console.error("Error cargando EnCicla CSV:", e);
  }
  return cachedEnCicla;
}

let cachedIntegratedRoutes: IntegratedRoute[] | null = null;

async function getIntegratedRoutes(): Promise<IntegratedRoute[]> {
  if (cachedIntegratedRoutes) return cachedIntegratedRoutes;
  cachedIntegratedRoutes = await loadIntegratedRoutes();
  return cachedIntegratedRoutes;
}

let cachedTiempos: string = '';

async function getTiemposData() {
  if (cachedTiempos) return cachedTiempos;
  try {
    const res = await fetch('/tiempos_desplazamiento_multimodal.csv');
    if (res.ok) {
      cachedTiempos = await res.text();
    }
  } catch (e) {
    console.error("Error cargando CSV de tiempos:", e);
  }
  return cachedTiempos;
}

export interface QueryOptions {
  origin?: { lat: number; lng: number };
  dest?: { lat: number; lng: number };
}

function formatIntegratedRouteForPrompt(route: IntegratedRoute, nearestOrigin?: IntegratedStop, nearestDest?: IntegratedStop): string {
  const lines: string[] = [];
  const originName = nearestOrigin ? nearestOrigin.name : (route.stops[0]?.name || 'inicio');
  const destName = nearestDest ? nearestDest.name : (route.stops[route.stops.length - 1]?.name || 'fin');
  const startCoord = nearestOrigin || route.stops[0];
  const endCoord = nearestDest || route.stops[route.stops.length - 1];
  lines.push(`- Bus Integrado ${route.id} (${route.name})${route.folder ? ' [Subred ' + route.folder + ']' : ''}: Abordaje sugerido "${originName}" (LAT ${startCoord?.lat?.toFixed?.(5) ?? startCoord?.lat}, LNG ${startCoord?.lng?.toFixed?.(5) ?? startCoord?.lng}), Bajada sugerida "${destName}" (LAT ${endCoord?.lat?.toFixed?.(5) ?? endCoord?.lat}, LNG ${endCoord?.lng?.toFixed?.(5) ?? endCoord?.lng}). Recorrido completo: ${route.stops.length} paradas.`);
  return lines.join('\n');
}

export async function processUserQuery(
  query: string,
  onRouteFound: (routes: any) => void,
  onStatusFound: (status: string) => void,
  options?: QueryOptions
) {
  try {
    const tarifas = await getTarifasData();
    const encicla = await getEnCiclaData();
    const tiempos = await getTiemposData();
    const allIntegratedRoutes = await getIntegratedRoutes();

    let grounding = '';
    let nearbyContext = '';
    let integratedContext = '';

    if (options?.origin || options?.dest) {
      const allStations = await loadStations();
      const originNearby = options.origin
        ? allStations
          .map(s => {
            const dist = calculateDistance(options.origin!.lat, options.origin!.lng, s.lat, s.lng);
            return { ...s, distance: dist, walkingMinutes: Math.ceil(dist / 80) };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 8)
          .map(s => ({ ...s, tag: 'Origen' }))
        : [];

      const destNearby = options.dest
        ? allStations
          .map(s => {
            const dist = calculateDistance(options.dest!.lat, options.dest!.lng, s.lat, s.lng);
            return { ...s, distance: dist, walkingMinutes: Math.ceil(dist / 80) };
          })
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 8)
          .map(s => ({ ...s, tag: 'Destino' }))
        : [];

      const relevantStations = [...originNearby, ...destNearby].reduce((acc, curr) => {
        if (!acc.find(s => s.id === curr.id)) acc.push(curr);
        return acc;
      }, [] as any[]);

      nearbyContext = relevantStations
        .map(s => `- [Para ${s.tag}] ${s.nombre} (${s.sistema} - Linea ${s.linea}): A ${Math.round(s.distance)} metros de distancia (Caminando: ~${s.walkingMinutes} min) - Coord: LAT ${s.lat.toFixed(5)}, LNG ${s.lng.toFixed(5)}`)
        .join('\n');

      const originHits = options.origin
        ? await findIntegratedRoutesNear(options.origin.lat, options.origin.lng, 1500)
        : [];
      const destHits = options.dest
        ? await findIntegratedRoutesNear(options.dest.lat, options.dest.lng, 1500)
        : [];

      const bestBusStops: Array<{ stop: IntegratedStop; route: IntegratedRoute; dist: number; tag: string }> = [];
      for (const h of originHits.slice(0, 10)) {
        bestBusStops.push({ stop: h.closestStop, route: h.route, dist: h.distance, tag: 'Origen' });
      }
      for (const h of destHits.slice(0, 10)) {
        bestBusStops.push({ stop: h.closestStop, route: h.route, dist: h.distance, tag: 'Destino' });
      }
      bestBusStops.sort((a, b) => a.dist - b.dist);

      integratedContext = bestBusStops
        .map(s => `- [Para ${s.tag}] Parada "${s.stop.name}" (Bus Articulado ${s.route.id}): A ${Math.round(s.dist)} metros (Caminando: ~${Math.ceil(s.dist / 80)} min) - Coord: LAT ${s.stop.lat.toFixed(5)}, LNG ${s.stop.lng.toFixed(5)}`)
        .join('\n');

      const passingThrough = options.origin && options.dest
        ? (() => {
            const out: string[] = [];
            for (const r of allIntegratedRoutes) {
              let oIdx = -1, dIdx = -1;
              for (let i = 0; i < r.stops.length; i++) {
                const dO = calculateDistance(options.origin!.lat, options.origin!.lng, r.stops[i].lat, r.stops[i].lng);
                const dD = calculateDistance(options.dest!.lat, options.dest!.lng, r.stops[i].lat, r.stops[i].lng);
                if (dO < 1500 && (oIdx === -1 || dO < calculateDistance(options.origin!.lat, options.origin!.lng, r.stops[oIdx].lat, r.stops[oIdx].lng))) oIdx = i;
                if (dD < 1500 && (dIdx === -1 || dD < calculateDistance(options.dest!.lat, options.dest!.lng, r.stops[dIdx].lat, r.stops[dIdx].lng))) dIdx = i;
              }
              if (oIdx !== -1 && dIdx !== -1 && oIdx < dIdx) {
                out.push(formatIntegratedRouteForPrompt(r, r.stops[oIdx], r.stops[dIdx]));
              }
            }
            return out.slice(0, 6).join('\n');
          })()
        : '';

      grounding = `ESTACIONES RELEVANTES CERCANAS A LA B\u00daSQUEDA:\n${nearbyContext}\n\nPARADAS DE BUSES INTEGRADOS CERCANAS:\n${integratedContext}\n${passingThrough ? '\nBUSES INTEGRADOS QUE PASAN CERCA DE ORIGEN Y DESTINO:\n' + passingThrough + '\n' : ''}\nOTRAS ESTACIONES DEL SISTEMA:\n${await getGroundingData()}`;
    } else {
      grounding = await getGroundingData();
    }

    const newsContext = await getRecentNewsContext();

    const generateWithRotation = async () => {
      let attempts = 0;
      while (attempts < apiKeys.length) {
        try {
          const ai = getAiInstance();
          return await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: {
              systemInstruction: `Eres MetroBot, el asistente inteligente de movilidad de SITVA (Metro, Metrocable, Tranv\u00eda, Metropl\u00fas, EnCicla y Buses Articulados) en Medell\u00edn Colombia.
Tu objetivo es dar rutas REALISTAS y \u00daTILES. Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses).

=== NOTICIAS Y ESTADO EN TIEMPO REAL ===
${newsContext}

REGLAS DE ORO:
1. MINIMIZAR CAMINATA: Si hay una parada de BUS ARTICULADO cerca del usuario (ver lista PARADAS CERCANAS o BUSES QUE PASAN CERCA DE ORIGEN Y DESTINO), \u00dasala obligatoriamente para evitar que camine a una estaci\u00f3n lejana.
2. COORDINADAS PRECISAS: Al llamar a 'render_route', usa las coordenadas EXACTAS provistas en las listas de "CERCANAS" tanto para 'originStation' como para los 'steps'. Si recomiendas un Bus Integrado, usa 'mode: "bus_articulado"' en el step correspondiente.
3. NO INVENTAR: No inventes estaciones.
4. ESTADO ACTUAL: Si el usuario pregunta por el estado del sistema o cierres, b\u00e1sate en la secci\u00f3n "NOTICIAS Y ESTADO EN TIEMPO REAL" de arriba.

DATOS OFICIALES SITVA 2026:
=== TARIFAS ===
${tarifas}
=== TIEMPOS ===
${tiempos}
=== ENCICLA ===
${encicla}

INSTRUCCIONES DE RESPUESTA:
1. Identifica estaciones/paradas de inicio y fin usando las listas "CERCANAS" con prioridad total.
2. Si hay un Bus Integrado que conecte paradas razonablemente cerca del origen y del destino, sugi\u00e9relo como una de las opciones en 'render_route' con 'mode: "bus_articulado"'.
3. Llama a 'render_route' con 2-3 opciones.
4. Responde brevemente en espa\u00f1ol.

DATOS DE RED SITVA:\n${grounding}`,
              tools: [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]
            }
          });
        } catch (error: any) {
          attempts++;
          const isTransientError = 
            error.status === 429 || error.status === 503 || 
            error.message?.includes('429') || error.message?.includes('503') ||
            error.message?.includes('quota') || error.message?.includes('demand');

          if (isTransientError && attempts < apiKeys.length) {
            console.warn(`Error temporal (${error.status || 'AI'}) en clave ${currentKeyIndex}, probando la siguiente...`);
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            continue;
          }
          throw error;
        }
      }
    };

    const response = await generateWithRotation();

    const functionCalls = response.functionCalls;
    let textResponse = response.text || "";

    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === 'render_route') {
          const args = call.args as any;
          args.routes.forEach((route: any) => {
            let totalCost = 0;
            let hasUsedMetroplus = false;
            let currentSystem = '';

            route.steps.forEach((step: any) => {
              const mode = (step.mode || '').toLowerCase();
              if (mode === 'walk' || mode === 'encicla') {
                step.cost = 0;
                return;
              }

              const isArviLine = step.line === 'L' || step.line === 'L\u00ednea L';
              const isArviStation = step.station?.name?.toLowerCase().includes('arv\u00ed');

              if (isArviLine || isArviStation) {
                step.cost = 11900;
                totalCost += 11900;
                currentSystem = 'arvi';
                return;
              }

              if (mode === 'metroplus' || step.line === 'O' || step.line === 'L\u00ednea O' || step.line === '1' || step.line === 'L\u00ednea 1' || step.line === '2' || step.line === 'L\u00ednea 2') {
                let stepCost = 0;
                if (currentSystem !== 'metroplus') {
                  if (!hasUsedMetroplus) {
                    stepCost = (totalCost === 0) ? 3820 : 0;
                    hasUsedMetroplus = true;
                  } else {
                    stepCost = 3820;
                  }
                }
                step.cost = stepCost;
                totalCost += stepCost;
                currentSystem = 'metroplus';
              } else if (['metro', 'metrocable', 'tranvia'].includes(mode)) {
                let stepCost = 0;
                if (totalCost === 0) {
                  stepCost = 3820;
                } else if (currentSystem === 'arvi') {
                  stepCost = 3820;
                }
                step.cost = stepCost;
                totalCost += stepCost;
                currentSystem = 'metro';
              } else {
                step.cost = 0;
              }
            });

            if (totalCost > 0) {
              route.cost = totalCost;
            } else {
              const transitSteps = route.steps.filter((s: any) => {
                const m = (s.mode || '').toLowerCase();
                return ['metro', 'metrocable', 'tranvia', 'metroplus'].includes(m);
              });
              if (transitSteps.length > 0) {
                route.cost = 3820;
                transitSteps.forEach((s: any, idx: number) => {
                  s.cost = (idx === 0) ? 3820 : 0;
                });
              }
            }
          });
          onRouteFound(args.routes);
        } else if (call.name === 'get_station_status') {
          const args = call.args as any;
          const status = await getStationStatus(args.stationId);
          onStatusFound(status);
          return `Estado para ${args.stationId}: ${status}`;
        }
      }
    }

    return textResponse || "No estoy seguro de c\u00f3mo ayudarte con eso.";
  } catch (error) {
    console.warn("Gemini API Error, falling back to local routing:", error);
    try {
      let originLat = options?.origin?.lat;
      let originLng = options?.origin?.lng;
      let destLat = options?.dest?.lat;
      let destLng = options?.dest?.lng;

      if (!originLat || !destLat) {
        const stations = await loadStations();
        const foundStations: any[] = [];
        const queryLower = query.toLowerCase();
        const sortedStations = [...stations].sort((a, b) => b.nombre.length - a.nombre.length);

        sortedStations.forEach(s => {
          const nameLower = s.nombre.toLowerCase();
          if (queryLower.includes(nameLower) && !foundStations.some(fs => fs.nombre === s.nombre)) {
            foundStations.push(s);
          }
        });

        if (foundStations.length >= 2) {
          originLat = foundStations[0].lat;
          originLng = foundStations[0].lng;
          destLat = foundStations[1].lat;
          destLng = foundStations[1].lng;
        }
      }

      if (originLat && originLng && destLat && destLng) {
        const offlineRoutes = await getLocalOfflineRoute(originLat, originLng, destLat, destLng);
        if (offlineRoutes && offlineRoutes.length > 0) {
          onRouteFound(offlineRoutes);
          return "\u26a0\ufe0f Modo Sin Conexi\u00f3n Activo.";
        }
      }
    } catch (offlineError) {
      console.error("Local routing fallback failed:", offlineError);
    }
    return "Error al calcular la ruta.";
  }
}
