import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { getStationStatus } from './routing';
import { loadStations, calculateDistance } from './stations';
import { getLocalOfflineRoute } from './localRouter';

let ai: GoogleGenAI;
try {
  const apiKey = process.env.GEMINI_API_KEY || "DUMMY_KEY_TO_PREVENT_CRASH";
  ai = new GoogleGenAI({ apiKey });
} catch (e) {
  console.warn("Could not initialize GoogleGenAI", e);
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

const renderRouteDeclaration: FunctionDeclaration = {
  name: 'render_route',
  description: 'Calculates and displays the optimal public transit routes between a start and end location in Medellín.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      routes: {
        type: Type.ARRAY,
        description: 'An array of proposed realistic routes based on the real map of the Metro de Medellín network.',
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
                  instruction: { type: Type.STRING, description: 'Clear instruction e.g. "Camina a la estación Acevedo", "Toma la Línea A hacia La Estrella"' },
                  mode: { type: Type.STRING, description: "'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'bus_articulado' | 'encicla' | 'walk'" },
                  duration: { type: Type.INTEGER },
                  cost: { type: Type.INTEGER, description: 'The individual cost of this step in COP (e.g., 0 or 3820). Set to 0 if it is a free transfer, walk or EnCicla.' },
                  line: { type: Type.STRING, description: 'Optional. e.g., "Línea A"' },
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

async function getIntegratedRoutesData() {
  try {
    const res = await fetch('/rutas_integradas.json');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("Error loading integrated routes:", e);
  }
  return [];
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
    const allIntegratedRoutes = await getIntegratedRoutesData();

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

      // 2. Contexto de paradas de Buses Integrados (Filtrado por cercanía)
      const nearbyBusStops: any[] = [];
      allIntegratedRoutes.forEach((route: any) => {
        route.stops.forEach((stop: any) => {
          if (options.origin) {
            const dOrig = calculateDistance(options.origin.lat, options.origin.lng, stop.lat, stop.lng);
            if (dOrig < 1000) nearbyBusStops.push({ ...stop, routeId: route.id, routeName: route.name, dist: dOrig, tag: 'Origen' });
          }
          if (options.dest) {
            const dDest = calculateDistance(options.dest.lat, options.dest.lng, stop.lat, stop.lng);
            if (dDest < 1000) nearbyBusStops.push({ ...stop, routeId: route.id, routeName: route.name, dist: dDest, tag: 'Destino' });
          }
        });
      });

      const bestBusStops = nearbyBusStops
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 15);

      integratedContext = bestBusStops
        .map(s => `- [Para ${s.tag}] Parada "${s.name}" (Bus Articulado ${s.routeId}): A ${Math.round(s.dist)} metros (Caminando: ~${Math.ceil(s.dist / 80)} min) - Coord: LAT ${s.lat}, LNG ${s.lng}`)
        .join('\n');

      grounding = `ESTACIONES RELEVANTES CERCANAS A LA BÚSQUEDA:\n${nearbyContext}\n\nPARADAS DE BUSES INTEGRADOS CERCANAS:\n${integratedContext}\n\nOTRAS ESTACIONES DEL SISTEMA:\n${await getGroundingData()}`;
    } else {
      grounding = await getGroundingData();
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: `Eres MetroBot, el asistente inteligente de movilidad de SITVA (Metro, Metrocable, Tranvía, Metroplús, EnCicla y Buses Articulados) en Medellín Colombia.
Tu objetivo es dar rutas REALISTAS y ÚTILES. Prioriza SIEMPRE minimizar la caminata usando el sistema integrado (Buses).

REGLAS DE ORO:
1. MINIMIZAR CAMINATA: Si hay una parada de BUS ARTICULADO cerca del usuario (ver lista PARADAS CERCANAS), ÚSALA obligatoriamente para evitar que camine a una estación lejana.
2. COORDINADAS PRECISAS: Al llamar a 'render_route', usa las coordenadas EXACTAS provistas en las listas de "CERCANAS" tanto para 'originStation' como para los 'steps'.
3. NO INVENTAR: No inventes estaciones.

DATOS OFICIALES SITVA 2026:
=== TARIFAS ===
${tarifas}
=== TIEMPOS ===
${tiempos}
=== ENCICLA ===
${encicla}

INSTRUCCIONES DE RESPUESTA:
1. Identifica estaciones/paradas de inicio y fin usando las listas "CERCANAS" con prioridad total.
2. Llama a 'render_route' con 2-3 opciones.
3. Responde brevemente en español.

DATOS DE RED SITVA:\n${grounding}`,
        tools: [{ functionDeclarations: [renderRouteDeclaration, getStationStatusDeclaration] }]
      }
    });

    const functionCalls = response.functionCalls;
    let textResponse = response.text || "";

    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        if (call.name === 'render_route') {
          const args = call.args as any;
          // Calculador de costos programático para evitar errores de la IA
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

              // Caso Cable Arví (Línea L)
              const isArviLine = step.line === 'L' || step.line === 'Línea L';
              const isArviStation = step.station?.name?.toLowerCase().includes('arví');

              if (isArviLine || isArviStation) {
                step.cost = 11900;
                totalCost += 11900;
                currentSystem = 'arvi';
                return;
              }

              if (mode === 'metroplus' || step.line === 'O' || step.line === 'Línea O' || step.line === '1' || step.line === 'Línea 1' || step.line === '2' || step.line === 'Línea 2') {
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

    return textResponse || "No estoy seguro de cómo ayudarte con eso.";
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
          return "⚠️ Modo Sin Conexión Activo.";
        }
      }
    } catch (offlineError) {
      console.error("Local routing fallback failed:", offlineError);
    }
    return "Error al calcular la ruta.";
  }
}
