
export async function getRouteGeometry(points: [number, number][], profile: 'foot' | 'car' | 'bike' = 'foot'): Promise<[number, number][]> {
  if (points.length < 2) return points;

  // OSRM expects coordinates as lng,lat
  const coords = points.map(p => `${p[1]},${p[0]}`).join(';');

  let baseUrl = '';
  if (profile === 'foot') {
    baseUrl = 'https://routing.openstreetmap.de/routed-foot/route/v1/walking';
  } else if (profile === 'bike') {
    baseUrl = 'https://routing.openstreetmap.de/routed-bike/route/v1/cycling';
  } else {
    baseUrl = `https://router.project-osrm.org/route/v1/driving`;
  }

  const url = `${baseUrl}/${coords}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM request failed');
    const data = await res.json();

    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
      // Map back to lat,lng
      return data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
    }
  } catch (e) {
    console.warn("OSRM routing failed, falling back to straight lines:", e);
  }
  return points;
}

// ---------------------------------------------------------------------------
// Turn-by-turn walking navigation
// ---------------------------------------------------------------------------

/** A single, human-readable walking maneuver step (turn-by-turn). */
export interface WalkStep {
  /** Spanish instruction, e.g. "Gira a la derecha en Calle 50". */
  instruction: string;
  /** Raw OSRM maneuver type: 'turn' | 'new name' | 'continue' | 'arrive' | 'merge' | 'on ramp' | 'off ramp' | 'fork' | 'roundabout' | 'rotary' | 'end of road' | 'depart'. */
  maneuverType: string;
  /** Raw OSRM modifier: 'uturn' | 'sharp right' | 'right' | 'slight right' | 'straight' | 'slight left' | 'left' | 'sharp left'. */
  modifier?: string;
  /** Street / way name for this segment. */
  name: string;
  /** Distance of this segment, in meters. */
  distance: number;
  /** Estimated duration of this segment, in seconds. */
  duration: number;
  /** Polyline of this segment as [lat, lng]. */
  coordinates: [number, number][];
}

function osrmBaseUrl(profile: 'foot' | 'car' | 'bike'): string {
  if (profile === 'foot') return 'https://routing.openstreetmap.de/routed-foot/route/v1/walking';
  if (profile === 'bike') return 'https://routing.openstreetmap.de/routed-bike/route/v1/cycling';
  return 'https://router.project-osrm.org/route/v1/driving';
}

/** Map OSRM maneuver + modifier into a Spanish instruction. */
function maneuverToSpanish(maneuver: string, modifier: string | undefined, name: string, exit?: number): string {
  const en = name?.trim();
  const calle = en ? ` en ${en}` : '';
  switch (maneuver) {
    case 'depart':
      return en ? `Comienza tu recorrido por ${en}` : 'Comienza tu recorrido';
    case 'arrive':
      return en ? `Llega a tu destino: ${en}` : 'Llega a tu destino';
    case 'turn': {
      const dir = modifier === 'left' ? 'a la izquierda'
        : modifier === 'right' ? 'a la derecha'
        : modifier === 'slight left' ? 'ligeramente a la izquierda'
        : modifier === 'slight right' ? 'ligeramente a la derecha'
        : modifier === 'sharp left' ? 'totalmente a la izquierda'
        : modifier === 'sharp right' ? 'totalmente a la derecha'
        : modifier === 'uturn' ? 'en U (regresa)'
        : 'en la dirección indicada';
      return `Gira ${dir}${calle}`;
    }
    case 'continue':
    case 'new name': {
      const dir = modifier === 'slight left' ? 'ligeramente a la izquierda'
        : modifier === 'slight right' ? 'ligeramente a la derecha'
        : modifier === 'left' ? 'a la izquierda'
        : modifier === 'right' ? 'a la derecha'
        : '';
      return dir ? `Continúa ${dir}${calle}` : (en ? `Continúa por ${en}` : 'Continúa recto');
    }
    case 'merge': {
      const dir = modifier === 'left' ? 'a la izquierda' : modifier === 'right' ? 'a la derecha' : 'al centro';
      return `Incorpórate ${dir}${calle}`;
    }
    case 'on ramp':
      return `Toma la rampa${modifier === 'left' ? ' a la izquierda' : modifier === 'right' ? ' a la derecha' : ''}${calle}`;
    case 'off ramp':
      return `Toma la salida${modifier === 'left' ? ' a la izquierda' : modifier === 'right' ? ' a la derecha' : ''}${calle}`;
    case 'fork': {
      const dir = modifier === 'left' ? 'de la izquierda' : modifier === 'right' ? 'de la derecha' : 'del centro';
      return `Mantén el carril ${dir}${calle}`;
    }
    case 'roundabout':
    case 'rotary': {
      const exitNum = exit && exit > 0 ? exit : 1;
      const ord = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta'][Math.min(exitNum - 1, 5)] || `${exitNum}ª`;
      return `En la glorieta toma la ${ord} salida${calle}`;
    }
    case 'end of road': {
      const dir = modifier === 'left' ? 'a la izquierda' : 'a la derecha';
      return `Al final de la vía gira ${dir}${calle}`;
    }
    default:
      return en ? `Continúa por ${en}` : 'Continúa';
  }
}

/**
 * Fetch turn-by-turn walking steps from OSRM (with `steps=true`).
 * Falls back to a single synthetic step if the network fails, so the
 * caller's navigation never dead-ends on a flaky mobile connection.
 */
export async function getWalkSteps(
  points: [number, number][],
  profile: 'foot' | 'car' | 'bike' = 'foot'
): Promise<WalkStep[]> {
  if (points.length < 2) return [];

  const coords = points.map(p => `${p[1]},${p[0]}`).join(';');
  const baseUrl = osrmBaseUrl(profile);
  const url = `${baseUrl}/${coords}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM steps request failed');
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.legs) throw new Error('OSRM no route');

    const steps: WalkStep[] = [];
    for (const leg of data.routes[0].legs) {
      for (const s of leg.steps) {
        const m = s.maneuver || {};
        steps.push({
          instruction: maneuverToSpanish(m.type, m.modifier, s.name, m.exit),
          maneuverType: m.type || 'continue',
          modifier: m.modifier,
          name: s.name || '',
          distance: s.distance || 0,
          duration: s.duration || 0,
          coordinates: (s.geometry?.coordinates || []).map((c: any) => [c[1], c[0]] as [number, number]),
        });
      }
    }
    return steps;
  } catch (e) {
    console.warn("OSRM steps failed, synthesizing fallback step:", e);
    // Synthetic fallback: one straight-line "go to destination" step.
    return [{
      instruction: `Dirígete a tu destino`,
      maneuverType: 'depart',
      name: '',
      distance: 0,
      duration: 0,
      coordinates: points,
    }];
  }
}
