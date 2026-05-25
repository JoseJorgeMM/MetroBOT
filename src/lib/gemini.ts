import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { getStationStatus } from './routing';
import { loadStations, calculateDistance } from './stations';

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
    } else {
      console.warn("No se pudo cargar el CSV de tarifas.");
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
              items: { type: Type.STRING, description: "'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk'" }
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
                  mode: { type: Type.STRING, description: "'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk'" },
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

    let grounding = '';
    let nearbyContext = '';

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

      // Combine and deduplicate
      const relevantStations = [...originNearby, ...destNearby].reduce((acc, curr) => {
        if (!acc.find(s => s.id === curr.id)) acc.push(curr);
        return acc;
      }, [] as any[]);

      nearbyContext = relevantStations
        .map(s => `- [Para ${s.tag}] ${s.nombre} (${s.sistema} - Linea ${s.linea}): A ${Math.round(s.distance)} metros de distancia (Caminando: ~${s.walkingMinutes} min) - Coord: LAT ${s.lat.toFixed(5)}, LNG ${s.lng.toFixed(5)}`)
        .join('\n');

      grounding = `ESTACIONES RELEVANTES CERCANAS A LA BÚSQUEDA:\n${nearbyContext}\n\nOTRAS ESTACIONES:\n${await getGroundingData()}`;
    } else {
      grounding = await getGroundingData();
    }

    // We append the instruction to force the model to call our renderer and ALSO reply in textual steps.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: `Eres MetroBot, el asistente inteligente de movilidad de SITVA (Metro, Metrocable, Tranvía, Metroplús, EnCicla) en Medellín Colombia.
Tu objetivo es dar rutas REALISTAS y ÚTILES. Por ejemplo, No sugieras caminar 1km si hay una estación a 200 metros.

DATOS OFICIALES REALES DE TARIFAS 2026:
=== INICIO DOCUMENTO DE TARIFAS (CSV) ===
${tarifas}
=== FIN DOCUMENTO DE TARIFAS (CSV) ===

DATOS DE ESTACIONES ENCICLA:
${encicla}

DATOS DE ESTACIONES Y TIEMPOS DE DESPLAZAMIENTO (Minutos):
=== INICIO DOCUMENTO DE TIEMPOS (CSV) ===
${tiempos}
=== FIN DOCUMENTO DE TIEMPOS (CSV) ===

REGLAS DE MOVILIDAD:
1. EnCicla es GRATUITO. Úsalo para distancias cortas o "última milla".
2. LÍMITE DE BICICLETA: Las distancias en EnCicla NO DEBEN exceder los 3 kilómetros (aprox 15-20 min). Los usuarios no pedalearán distancias extremas ni subirán lomas pronunciadas. Para tramos largos, USA SIEMPRE Metro, Cable o Plus.
3. PRIORIDAD Y ORDEN MÁXIMO: El orden de las rutas sugeridas en el ARRAY \`routes\` DEBE ser estrictamente de menor a mayor en cuanto a la distancia total que el usuario deba CAMINAR. 
   - La PRIMERA ruta debe ser la más cómoda: la que encuentre estaciones SITVA (Metro, Cable, Plus, etc.) más cercanas tanto al origen como al destino, de forma que el usuario camine la mínima cantidad de metros o minutos.
   - Las SIGUIENTES rutas deben ser alternativas donde quizás el usuario camina un poco más, o usa EnCicla, ordenadas hasta llegar a la opción donde deba caminar o pedalear más. 
   - Asegúrate de ordenar el ARRAY devuelto usando esta regla inquebrantable.
4. Si existe la lista "ESTACIONES RELEVANTES CERCANAS" abajo, DEBES elegir el origen y el destino de ESA LISTA preferiblemente para minimizar la caminata.
5. NO inventes estaciones. Usa solo los nombres exactos provistos. \`originStation\` y \`destinationStation\` DEBEN ser siempre ESTACIONES de la red (ej. "Parada Plaza Mayor"), NUNCA el lugar físico buscado por el usuario (ej. "Colegio Jesus Rey" o "Plaza Mayor").
6. Verifica el sistema: Si la estación dice "Metrocable Linea P", no digas que es "Metro" o "Metroplús".
7. TIEMPOS EXACTOS (SITVA): Para calcular la \`duration\` en minutos de cada paso en el sistema SITVA, debes usar la tabla de TIEMPOS DE DESPLAZAMIENTO. Suma el "tiempo_total_estimado_min" (movimiento + espera) de los segmentos involucrados y no inventes los tiempos.
8. TIEMPO DE CAMINATA REALISTA: Asume una velocidad de caminata urbana estándar de 4.5 a 5 km/h (aproximadamente 12 a 15 minutos por kilómetro). Al calcular el tiempo de caminar hasta una estación, utiliza las coordenadas y calcula la distancia realista (asumiendo cuadras urbanas, no línea recta). No subestimes el tiempo de caminar.
9. CÁLCULO DE COSTOS EXACTOS: El campo "cost" debe calcularse de forma precisa con el CSV. Si el viaje es solo dentro de la red (Metro, Tranvía, Metroplús, Cables -excepto Arví-) el costo inicial es la tarifa base frecuente (ej. 3820). Caminar y EnCicla tienen costo 0. Transbordos directos entre Metro/Tranvía/Cables/Metroplús son gratuitos según la "matriz_transbordos". REGLA DE METROPLÚS: El transbordo Metroplús -> Metro (o viceversa) es gratis, PERO si la ruta exige salir y volver a ingresar al mismo sistema (ej. Metroplús -> Metro -> Metroplús), se cobra nuevamente la tarifa base al reingresar, sumando otro pasaje. Si el viaje incluye Cable Arví, suma su tarifa especial.

INSTRUCCIONES DE RESPUESTA:
1. RESPONDE EN ESPAÑOL con tono amigable, preciso y breve.
2. Proceso:
   a) Identifica las estaciones de inicio y fin (usa la lista de RELEVANTES CERCANAS con prioridad).
   b) Traza la ruta usando las líneas del Metro y sus integraciones.
   c) DEBES buscar 2 o 3 opciones de ruta alternativas (ej. una más rápida en Metro, otra combinando con EnCicla) si es factible.
   d) Llama a 'render_route' con el JSON que contiene un ARRAY de TODAS las opciones de rutas válidas que encontraste. INCLUYE las coordenadas de CADA estación intermedia en cada paso (steps) para que se vean en el mapa.
3. Texto:
   - "¡Qué más! Te tengo estas opciones para tu ruta..."
   - Enumera las opciones brevemente.
   - Explica claramente y de forma breve dónde hacer transbordo (especialmente si cambia de sistema o línea).
   - NO muestres coordenadas numéricas en el texto para el usuario.

DATOS DE RED SITVA:
${grounding}`,
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
                // Verificamos que sea exactamente "L" o "Línea L" para evitar falsos positivos con "Línea A", etc.
                const isArviLine = step.line === 'L' || step.line === 'Línea L';
                const isArviStation = step.station?.name?.toLowerCase().includes('arví');

                if (isArviLine || isArviStation) {
                   step.cost = 11900;
                   totalCost += 11900; // Tarifa Cable Arví
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
                         // Reingreso a Metroplús agota integración
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
                      stepCost = 3820; // De Arví a Metro se paga de nuevo
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
                // Si hay pasos de transporte pero el costo quedó en 0,
                // asegurar que no se quede un costo alucinado por la IA
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

    return textResponse || "No estoy seguro de cómo ayudarte con eso. Intenta pedirme una ruta, por ejemplo, hacia el Parque Arví, o pregúntame por el estado del Metrocable Línea K.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Lo siento, tuve un problema conectándome al sistema. Intenta nuevamente en un momento.";
  }
}
