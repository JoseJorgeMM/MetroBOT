import type { RouteOption, RouteStep, TransportMode } from './routing';

export type TripPoint = { lat: number; lng: number; name?: string };
export function validPoint(point: unknown): point is TripPoint {
  const p = point as TripPoint | null;
  return !!p && typeof p.lat === 'number' && typeof p.lng === 'number'
    && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/** Google encoded polyline, precision 5. Reject truncated or oversized input. */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  if (typeof encoded !== 'string' || encoded.length > 500_000) throw Error('INVALID_POLYLINE');
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0, lat = 0, lng = 0;
  const read = () => {
    let result = 0, shift = 0, byte: number;
    do {
      if (index >= encoded.length || shift > 30) throw Error('INVALID_POLYLINE');
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw Error('INVALID_POLYLINE');
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += read(); lng += read();
    const point = { lat: lat / 1e5, lng: lng / 1e5 };
    if (!validPoint(point)) throw Error('INVALID_POLYLINE');
    points.push(point);
  }
  return points;
}

type GoogleStep = {
  travelMode?: string; staticDuration?: string;
  navigationInstruction?: { instructions?: string };
  polyline?: { encodedPolyline?: string };
  transitDetails?: {
    headsign?: string; stopCount?: number;
    stopDetails?: { departureStop?: { name?: string }; arrivalStop?: { name?: string }; departureTime?: string; arrivalTime?: string };
    transitLine?: { name?: string; nameShort?: string; vehicle?: { type?: string; name?: { text?: string } }; agencies?: Array<{ name: string; uri?: string }> };
  };
};
export type GoogleResponse = { routes?: Array<{
  duration?: string; polyline?: { encodedPolyline?: string };
  legs?: Array<{ steps?: GoogleStep[] }>;
  travelAdvisory?: { transitFare?: { currencyCode?: string; units?: string; nanos?: number } };
  localizedValues?: { transitFare?: { text?: string } };
}> };

function minutes(duration?: string): number {
  return duration && /^\d+(\.\d+)?s$/.test(duration) ? Math.ceil(Number(duration.slice(0, -1)) / 60) : -1;
}
function stepMode(step: GoogleStep): TransportMode {
  if (step.travelMode === 'WALK') return 'walk';
  switch (step.transitDetails?.transitLine?.vehicle?.type) {
    case 'BUS': case 'INTERCITY_BUS': case 'TROLLEYBUS': return 'bus';
    case 'SUBWAY': case 'METRO_RAIL': return 'metro';
    case 'TRAM': case 'LIGHT_RAIL': return 'tranvia';
    case 'GONDOLA_LIFT': return 'metrocable';
    default: return 'transit';
  }
}

export function mapGoogleRoutes(data: GoogleResponse, origin: TripPoint, destination: TripPoint): RouteOption[] {
  if (!Array.isArray(data?.routes)) return [];
  return data.routes.slice(0, 4).flatMap((route, index): RouteOption[] => {
    const duration = minutes(route.duration);
    const polyline = route.polyline?.encodedPolyline;
    if (duration < 0 || !polyline || !Array.isArray(route.legs)) return [];
    try { if (decodePolyline(polyline).length < 2) return []; } catch { return []; }
    const rawSteps = route.legs.flatMap(leg => leg.steps || []);
    if (!rawSteps.length) return [];
    const steps: RouteStep[] = rawSteps.map(step => {
      const transit = step.transitDetails;
      const stops = transit?.stopDetails;
      const line = transit?.transitLine;
      if (line?.agencies !== undefined && (!Array.isArray(line.agencies) || line.agencies.some(agency =>
        !agency || typeof agency.name !== 'string' || (agency.uri !== undefined && typeof agency.uri !== 'string')))) {
        throw Error('INVALID_GOOGLE_RESPONSE');
      }
      return {
        mode: stepMode(step), duration: minutes(step.staticDuration),
        instruction: step.navigationInstruction?.instructions || (transit
          ? `Toma ${line?.nameShort || line?.name || 'el transporte'}${transit.headsign ? ` hacia ${transit.headsign}` : ''}, desde ${stops?.departureStop?.name || 'la parada indicada'} hasta ${stops?.arrivalStop?.name || 'la parada de llegada'}.`
          : 'Continúa a pie según el recorrido del mapa.'),
        line: line?.nameShort || line?.name,
        googlePolyline: step.polyline?.encodedPolyline,
        transit: transit ? {
          departureStop: stops?.departureStop?.name, arrivalStop: stops?.arrivalStop?.name,
          departureTime: stops?.departureTime, arrivalTime: stops?.arrivalTime,
          headsign: transit.headsign, stopCount: transit.stopCount,
          vehicleName: line?.vehicle?.name?.text, agencies: line?.agencies || [],
        } : undefined,
      };
    });
    const fare = route.travelAdvisory?.transitFare;
    const amount = fare ? Number(fare.units || 0) + (fare.nanos || 0) / 1e9 : -1;
    return [{
      id: `google-${index}`, source: 'google', googlePolyline: polyline,
      duration, steps, modes: steps.map(step => step.mode),
      transfers: Math.max(0, steps.filter(step => step.transit).length - 1),
      // Existing comparison expects a number; -1 is its unknown-price sentinel.
      cost: fare?.currencyCode === 'COP' && Number.isFinite(amount) && amount >= 0 ? amount : -1,
      fareText: route.localizedValues?.transitFare?.text,
      userOrigin: { ...origin, name: origin.name || 'Origen' },
      userDest: { ...destination, name: destination.name || 'Destino' },
    }];
  });
}

export function googleDirectionsUrl(origin: TripPoint, destination: TripPoint): string {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', origin: `${origin.lat},${origin.lng}`, destination: `${destination.lat},${destination.lng}`, travelmode: 'transit' })}`;
}
