import { Station, loadStations, calculateDistance } from './stations';
import { RouteOption, RouteStep } from './routing';

interface GraphEdge {
  targetId: string;
  weight: number; // in minutes
  mode: 'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk';
  line?: string;
  distance: number; // in meters
}

interface GraphNode {
  station: Station;
  edges: GraphEdge[];
}

// Global cache to avoid rebuilding the graph on every query
let localGraphCache: Map<string, GraphNode> | null = null;
let allStationsCache: Station[] = [];

// Helper to normalize station names for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Map CSV modes to our router modes
function mapMode(csvMode: string): 'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk' {
  const m = csvMode.toLowerCase();
  if (m.includes('metroplus')) return 'metroplus';
  if (m.includes('metrocable') || m.includes('cable')) return 'metrocable';
  if (m.includes('tranvia') || m.includes('tranvía')) return 'tranvia';
  if (m.includes('metro')) return 'metro';
  return 'walk';
}

async function buildGraph(): Promise<Map<string, GraphNode>> {
  if (localGraphCache) return localGraphCache;

  const stations = await loadStations();
  allStationsCache = stations;
  const graph = new Map<string, GraphNode>();

  // Initialize all nodes
  stations.forEach(s => {
    graph.set(s.id, {
      station: s,
      edges: []
    });
  });

  // Load times CSV to build transit edges
  try {
    const res = await fetch('/tiempos_desplazamiento_multimodal.csv');
    if (res.ok) {
      const text = await res.text();
      const rows = text.trim().split('\n').slice(1);

      rows.forEach(row => {
        const cols = row.split(',');
        if (cols.length < 6) return;

        const csvMode = cols[0];
        const linea = cols[1];
        const origenName = cols[3].trim();
        const destinoName = cols[4].trim();
        const movementTime = parseFloat(cols[5]) || 2.0;

        const mode = mapMode(csvMode);

        // Find candidate station nodes matching originName and destinoName
        const origNorm = normalizeName(origenName);
        const destNorm = normalizeName(destinoName);

        const originStations = stations.filter(s => normalizeName(s.nombre) === origNorm && (s.linea === linea || s.sistema.toLowerCase().includes(csvMode.toLowerCase().slice(0, 4))));
        const destStations = stations.filter(s => normalizeName(s.nombre) === destNorm && (s.linea === linea || s.sistema.toLowerCase().includes(csvMode.toLowerCase().slice(0, 4))));

        // Fallback to name match only if line-specific match fails
        const finalOrigs = originStations.length > 0 ? originStations : stations.filter(s => normalizeName(s.nombre) === origNorm);
        const finalDests = destStations.length > 0 ? destStations : stations.filter(s => normalizeName(s.nombre) === destNorm);

        finalOrigs.forEach(origNode => {
          finalDests.forEach(destNode => {
            const distance = calculateDistance(origNode.lat, origNode.lng, destNode.lat, destNode.lng);
            // Add bidirectional transit edge
            const origGraphNode = graph.get(origNode.id);
            const destGraphNode = graph.get(destNode.id);

            if (origGraphNode) {
              origGraphNode.edges.push({
                targetId: destNode.id,
                weight: movementTime,
                mode,
                line: linea ? `Línea ${linea}` : undefined,
                distance
              });
            }
            if (destGraphNode) {
              destGraphNode.edges.push({
                targetId: origNode.id,
                weight: movementTime,
                mode,
                line: linea ? `Línea ${linea}` : undefined,
                distance
              });
            }
          });
        });
      });
    }
  } catch (error) {
    console.error("Error reading tiempos CSV in localRouter:", error);
  }

  // Add transfer edges between stations of same/close name or close coordinates
  const stationArray = Array.from(graph.values());
  for (let i = 0; i < stationArray.length; i++) {
    const nodeA = stationArray[i];
    for (let j = i + 1; j < stationArray.length; j++) {
      const nodeB = stationArray[j];
      const sameName = normalizeName(nodeA.station.nombre) === normalizeName(nodeB.station.nombre);
      const distance = calculateDistance(nodeA.station.lat, nodeA.station.lng, nodeB.station.lat, nodeB.station.lng);

      // If they are transfer stations (e.g. San Antonio lines A, B and Tranvía, or nearby stations < 200m)
      if (sameName || (distance < 200 && nodeA.station.sistema !== 'EnCicla' && nodeB.station.sistema !== 'EnCicla')) {
        const transferWeight = sameName ? 2.5 : 3.5; // transfer walk/wait penalty
        nodeA.edges.push({
          targetId: nodeB.station.id,
          weight: transferWeight,
          mode: 'walk',
          distance
        });
        nodeB.edges.push({
          targetId: nodeA.station.id,
          weight: transferWeight,
          mode: 'walk',
          distance
        });
      }

      // Connect EnCicla to nearest Metro/SITVA station if they are close (< 250m)
      if (distance < 250 && ((nodeA.station.sistema === 'EnCicla' && nodeB.station.sistema !== 'EnCicla') || (nodeA.station.sistema !== 'EnCicla' && nodeB.station.sistema === 'EnCicla'))) {
        const walkWeight = distance / 80.0; // walking at 80m/min
        nodeA.edges.push({
          targetId: nodeB.station.id,
          weight: walkWeight,
          mode: 'walk',
          distance
        });
        nodeB.edges.push({
          targetId: nodeA.station.id,
          weight: walkWeight,
          mode: 'walk',
          distance
        });
      }

      // Connect EnCicla to other EnCicla stations that are relatively close (< 1500m)
      if (nodeA.station.sistema === 'EnCicla' && nodeB.station.sistema === 'EnCicla' && distance < 1500) {
        const cycleWeight = distance / 200.0; // cycling at 200m/min (12 km/h)
        nodeA.edges.push({
          targetId: nodeB.station.id,
          weight: cycleWeight,
          mode: 'encicla',
          line: 'EnCicla',
          distance
        });
        nodeB.edges.push({
          targetId: nodeA.station.id,
          weight: cycleWeight,
          mode: 'encicla',
          line: 'EnCicla',
          distance
        });
      }
    }
  }

  localGraphCache = graph;
  return graph;
}

// Dijkstra Algorithm implementation
interface DijkstraResult {
  distances: Map<string, number>;
  previous: Map<string, { nodeId: string; edge: GraphEdge } | null>;
}

function runDijkstra(
  graph: Map<string, GraphNode>,
  startId: string,
  endId: string,
  weights: {
    walkMultiplier: number;
    enciclaMultiplier: number;
    transitMultiplier: number;
    transferPenalty: number;
  }
): DijkstraResult {
  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge: GraphEdge } | null>();
  const queue = new Set<string>();

  // Initialize
  graph.forEach((_, id) => {
    distances.set(id, Infinity);
    previous.set(id, null);
    queue.add(id);
  });
  distances.set(startId, 0);

  while (queue.size > 0) {
    // Get node with minimum distance
    let minNodeId: string | null = null;
    let minDistance = Infinity;

    queue.forEach(id => {
      const dist = distances.get(id) ?? Infinity;
      if (dist < minDistance) {
        minDistance = dist;
        minNodeId = id;
      }
    });

    if (minNodeId === null || minNodeId === endId || minDistance === Infinity) {
      break;
    }

    queue.delete(minNodeId);
    const currNode = graph.get(minNodeId);
    if (!currNode) continue;

    const currentDist = distances.get(minNodeId) ?? 0;

    currNode.edges.forEach(edge => {
      if (!queue.has(edge.targetId)) return;

      // Calculate edge weight based on preferences
      let edgeWeight = edge.weight;
      if (edge.mode === 'walk') {
        edgeWeight *= weights.walkMultiplier;
      } else if (edge.mode === 'encicla') {
        edgeWeight *= weights.enciclaMultiplier;
      } else {
        edgeWeight *= weights.transitMultiplier;
      }

      // Check if this edge is a transfer from previous mode
      const prevInfo = previous.get(minNodeId!);
      if (prevInfo && prevInfo.edge.mode !== edge.mode) {
        edgeWeight += weights.transferPenalty;
      }

      const alt = currentDist + edgeWeight;
      if (alt < (distances.get(edge.targetId) ?? Infinity)) {
        distances.set(edge.targetId, alt);
        previous.set(edge.targetId, { nodeId: minNodeId!, edge });
      }
    });
  }

  return { distances, previous };
}

// Build the route steps list from the previous pointers map
function reconstructPath(
  graph: Map<string, GraphNode>,
  previous: Map<string, { nodeId: string; edge: GraphEdge } | null>,
  startId: string,
  endId: string
): { steps: RouteStep[]; duration: number } {
  const pathEdges: { fromId: string; toId: string; edge: GraphEdge }[] = [];
  let currId: string | null = endId;

  while (currId && currId !== startId) {
    const prevInfo = previous.get(currId);
    if (!prevInfo) break;
    pathEdges.unshift({
      fromId: prevInfo.nodeId,
      toId: currId,
      edge: prevInfo.edge
    });
    currId = prevInfo.nodeId;
  }

  if (pathEdges.length === 0) return { steps: [], duration: 0 };

  const steps: RouteStep[] = [];
  let totalDuration = 0;

  // Group contiguous segments of the same mode and line to make clean directions
  let currentGroup: {
    mode: 'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk';
    line?: string;
    stations: Station[];
    duration: number;
  } | null = null;

  pathEdges.forEach(item => {
    const fromStation = graph.get(item.fromId)!.station;
    const toStation = graph.get(item.toId)!.station;
    const edge = item.edge;

    if (currentGroup && currentGroup.mode === edge.mode && currentGroup.line === edge.line) {
      currentGroup.stations.push(toStation);
      currentGroup.duration += edge.weight;
    } else {
      if (currentGroup) {
        // commit last group
        steps.push(formatGroupToStep(currentGroup));
      }
      currentGroup = {
        mode: edge.mode,
        line: edge.line,
        stations: [fromStation, toStation],
        duration: edge.weight
      };
    }
    totalDuration += edge.weight;
  });

  if (currentGroup) {
    steps.push(formatGroupToStep(currentGroup));
  }

  return { steps, duration: Math.ceil(totalDuration) };
}

function formatGroupToStep(group: {
  mode: 'metro' | 'metrocable' | 'tranvia' | 'metroplus' | 'encicla' | 'walk';
  line?: string;
  stations: Station[];
  duration: number;
}): RouteStep {
  const roundedDuration = Math.ceil(group.duration);
  const originStation = group.stations[0];
  const destStation = group.stations[group.stations.length - 1];

  let instruction = '';
  switch (group.mode) {
    case 'walk':
      instruction = `Camina desde ${originStation.nombre} hasta ${destStation.nombre}`;
      break;
    case 'encicla':
      instruction = `Toma una bicicleta en la estación EnCicla ${originStation.nombre} y viaja hasta ${destStation.nombre}`;
      break;
    case 'metro':
      instruction = `Toma el Metro en ${originStation.nombre} hacia ${destStation.nombre}`;
      break;
    case 'metrocable':
      instruction = `Toma el Metrocable en ${originStation.nombre} hacia ${destStation.nombre}`;
      break;
    case 'tranvia':
      instruction = `Toma el Tranvía en ${originStation.nombre} hacia ${destStation.nombre}`;
      break;
    case 'metroplus':
      instruction = `Toma el Metroplús en ${originStation.nombre} hacia ${destStation.nombre}`;
      break;
    default:
      instruction = `Desplázate de ${originStation.nombre} a ${destStation.nombre}`;
  }

  return {
    instruction,
    mode: group.mode,
    duration: roundedDuration,
    line: group.line,
    station: {
      name: destStation.nombre,
      lat: destStation.lat,
      lng: destStation.lng
    }
  };
}

// Programmatic cost calculator matching our gemini.ts rules
function calculateRouteCosts(steps: RouteStep[]): { totalCost: number; stepsWithCosts: RouteStep[] } {
  let totalCost = 0;
  let hasUsedMetroplus = false;
  let currentSystem = '';

  const stepsWithCosts = steps.map(step => {
    const mode = (step.mode || '').toLowerCase();
    if (mode === 'walk' || mode === 'encicla') {
      return { ...step, cost: 0 };
    }

    const isArviLine = step.line === 'L' || step.line === 'Línea L' || step.line === 'Línea Línea L';
    const isArviStation = step.station?.name?.toLowerCase().includes('arví');

    if (isArviLine || isArviStation) {
      totalCost += 11900;
      currentSystem = 'arvi';
      return { ...step, cost: 11900 };
    }

    if (mode === 'metroplus' || step.line === 'O' || step.line === 'Línea O' || step.line === 'Línea 1' || step.line === 'Línea 2') {
      let stepCost = 0;
      if (currentSystem !== 'metroplus') {
        if (!hasUsedMetroplus) {
          stepCost = (totalCost === 0) ? 3820 : 0;
          hasUsedMetroplus = true;
        } else {
          stepCost = 3820;
        }
      }
      totalCost += stepCost;
      currentSystem = 'metroplus';
      return { ...step, cost: stepCost };
    } else if (['metro', 'metrocable', 'tranvia'].includes(mode)) {
      let stepCost = 0;
      if (totalCost === 0) {
        stepCost = 3820;
      } else if (currentSystem === 'arvi') {
        stepCost = 3820;
      }
      totalCost += stepCost;
      currentSystem = 'metro';
      return { ...step, cost: stepCost };
    }

    return { ...step, cost: 0 };
  });

  // Ensure default cost if total is 0 but they took transit
  if (totalCost === 0) {
    const transitSteps = stepsWithCosts.filter(s => ['metro', 'metrocable', 'tranvia', 'metroplus'].includes(s.mode));
    if (transitSteps.length > 0) {
      totalCost = 3820;
      let first = true;
      stepsWithCosts.forEach(s => {
        if (['metro', 'metrocable', 'tranvia', 'metroplus'].includes(s.mode)) {
          s.cost = first ? 3820 : 0;
          first = false;
        }
      });
    }
  }

  return { totalCost, stepsWithCosts };
}

export async function getLocalOfflineRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteOption[]> {
  const graph = await buildGraph();
  const stations = allStationsCache;

  if (stations.length === 0) {
    return [];
  }

  // Find nearest stations to origin and destination
  const getNearestStations = (lat: number, lng: number, count: number = 5) => {
    return stations
      .map(s => ({ s, distance: calculateDistance(lat, lng, s.lat, s.lng) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, count);
  };

  const nearestOrigin = getNearestStations(originLat, originLng, 4);
  const nearestDest = getNearestStations(destLat, destLng, 4);

  // Add virtual START and END nodes to the graph
  const startId = 'VIRTUAL_START';
  const endId = 'VIRTUAL_END';

  const virtualStartNode: GraphNode = {
    station: { id: startId, lat: originLat, lng: originLng, sistema: 'Walk', nombre: 'Punto de Inicio', linea: '' },
    edges: nearestOrigin.map(item => ({
      targetId: item.s.id,
      weight: item.distance / 80.0, // walking at 80m/min
      mode: 'walk',
      distance: item.distance
    }))
  };

  const virtualEndNode: GraphNode = {
    station: { id: endId, lat: destLat, lng: destLng, sistema: 'Walk', nombre: 'Destino', linea: '' },
    edges: []
  };

  // Add incoming edges to VIRTUAL_END from nearest destination stations
  nearestDest.forEach(item => {
    const destNode = graph.get(item.s.id);
    if (destNode) {
      // Connect transit station to virtual end
      destNode.edges.push({
        targetId: endId,
        weight: item.distance / 80.0,
        mode: 'walk',
        distance: item.distance
      });
    }
  });

  // Temporarily insert virtual nodes into the graph
  graph.set(startId, virtualStartNode);
  graph.set(endId, virtualEndNode);

  const routeOptions: RouteOption[] = [];

  // Generate Route Option 1: Fast Transit (penalize walking and EnCicla)
  const weightsFast = {
    walkMultiplier: 3.5,
    enciclaMultiplier: 10.0,
    transitMultiplier: 1.0,
    transferPenalty: 3.0
  };

  // Generate Route Option 2: Active Mobility (EnCicla integrated)
  const weightsActive = {
    walkMultiplier: 1.5,
    enciclaMultiplier: 1.0,
    transitMultiplier: 1.2,
    transferPenalty: 1.0
  };

  // Generate Route Option 3: Min Walk (heavily penalize walking)
  const weightsMinWalk = {
    walkMultiplier: 10.0,
    enciclaMultiplier: 8.0,
    transitMultiplier: 1.0,
    transferPenalty: 2.0
  };

  const configurations = [
    { name: 'Ruta Rápida (SITVA)', weights: weightsFast, id: 'offline-fast' },
    { name: 'Ruta Activa (EnCicla + Metro)', weights: weightsActive, id: 'offline-active' },
    { name: 'Ruta de Mínimo Esfuerzo', weights: weightsMinWalk, id: 'offline-minwalk' }
  ];

  configurations.forEach(cfg => {
    const result = runDijkstra(graph, startId, endId, cfg.weights);
    const { steps, duration } = reconstructPath(graph, result.previous, startId, endId);

    if (steps.length > 0) {
      // Clean up first and last step coordinates
      const cleanSteps = steps.map((step, idx) => {
        if (idx === 0) {
          // Walk to first station
          return {
            ...step,
            instruction: `Camina desde el punto de origen hasta ${step.station?.name || 'la estación'}`
          };
        }
        if (idx === steps.length - 1 && step.mode === 'walk') {
          return {
            ...step,
            instruction: 'Camina hasta tu destino'
          };
        }
        return step;
      });

      const firstStation = graph.get(nearestOrigin[0].s.id)!.station;
      const lastStation = graph.get(nearestDest[0].s.id)!.station;

      const { totalCost, stepsWithCosts } = calculateRouteCosts(cleanSteps);

      const uniqueModes = Array.from(new Set(cleanSteps.map(s => s.mode)));

      routeOptions.push({
        id: `${cfg.id}-${Date.now()}`,
        modes: uniqueModes,
        duration,
        cost: totalCost,
        transfers: cleanSteps.filter(s => ['metro', 'metrocable', 'tranvia', 'metroplus'].includes(s.mode)).length - 1,
        originStation: {
          name: firstStation.nombre,
          lat: firstStation.lat,
          lng: firstStation.lng
        },
        destinationStation: {
          name: lastStation.nombre,
          lat: lastStation.lat,
          lng: lastStation.lng
        },
        userOrigin: {
          name: 'Punto de Inicio',
          lat: originLat,
          lng: originLng
        },
        userDest: {
          name: 'Destino',
          lat: destLat,
          lng: destLng
        },
        steps: stepsWithCosts
      });
    }
  });

  // Clean up virtual nodes from graph to restore state
  graph.delete(startId);
  graph.delete(endId);
  nearestDest.forEach(item => {
    const destNode = graph.get(item.s.id);
    if (destNode) {
      destNode.edges = destNode.edges.filter(edge => edge.targetId !== endId);
    }
  });

  // Deduplicate and filter options that are identical
  const uniqueRoutes: RouteOption[] = [];
  routeOptions.forEach(opt => {
    const isDuplicate = uniqueRoutes.some(existing => 
      existing.duration === opt.duration && 
      existing.cost === opt.cost &&
      existing.steps.length === opt.steps.length &&
      existing.steps[0].instruction === opt.steps[0].instruction
    );
    if (!isDuplicate) {
      uniqueRoutes.push(opt);
    }
  });

  return uniqueRoutes;
}
