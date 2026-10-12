import type { RouteOption } from '../routing';
import type { IntegratedRoute } from '../integratedRoutes';
import type { Station } from '../stations';
import { matchStation } from '../routeStations';
import { calculateFare } from './engine';
import { fareConfig } from './config';
import type { FareProfile, FareSegment } from './types';

export interface FareEvidence { stations?: Station[]; routes?: IntegratedRoute[] }
const normalizedLine = (value?: string) => (value || '').replace(/l[ií]nea\s*/gi, '').trim().toUpperCase();
const modeCodes: Record<string, string> = { metro:'METRO', metrocable:'CABLE', tranvia:'TRANVIA', metroplus:'METROPLUS', encicla:'ENCICLA', walk:'WALK' };

export function classifyRouteSegments(route: RouteOption, evidence: FareEvidence = {}): FareSegment[] {
  const segments = route.steps.map(step => {
    const base: FareSegment = { mode: modeCodes[step.mode] || 'TIPO_TRANSPORTE_NO_DETERMINADO', name: step.line || step.instruction,
      scheduledTime: step.transit?.departureTime, evidence: `Modo estructurado: ${step.mode}` };
    if (step.fareInput) return { ...base, ...step.fareInput };
    if (step.mode === 'metrocable' && normalizedLine(step.line) === 'L') return { ...base, mode: 'CABLE_ARVI', evidence: 'Línea L de Metrocable' };
    if (step.mode !== 'bus' && step.mode !== 'bus_articulado') return base;
    const matches = (evidence.routes || []).filter(item => item.id === step.line || item.name === step.line);
    if (matches.length === 1) {
      const basin = /^C([36])-/.exec(matches[0].id)?.[1];
      if (basin) return { ...base, mode:'ALIMENTADOR', basin, evidence:`Catálogo local: ${matches[0].id}` };
      // Catalog currently lacks an explicit bus/micro tariff class for other IDs.
      // A folder or a nearby municipality alone is not enough to select a fare.
    }
    const transit = step.transit;
    if (transit?.departureLocation && transit.arrivalLocation) {
      const departure = matchStation(transit.departureStop || '', transit.departureLocation, 'metroplus', evidence.stations || []);
      const arrival = matchStation(transit.arrivalStop || '', transit.arrivalLocation, 'metroplus', evidence.stations || []);
      const metroAgency = transit.agencies.some(agency => /^(metro de medell[ií]n|empresa de transporte masivo del valle de aburr[aá])$/i.test(agency.name.trim()));
      if (metroAgency && departure && arrival && normalizedLine(departure.linea) === normalizedLine(step.line) && normalizedLine(arrival.linea) === normalizedLine(step.line)) {
        return { ...base, mode:'METROPLUS', evidence:'Operador, línea y ambas estaciones coinciden con Metroplús en el catálogo local' };
      }
    }
    return { ...base, evidence:'El proveedor no identifica la categoría tarifaria del bus' };
  });
  const station = (value?: string) => (value || '').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/^estacion\s+/,'').replace(/\s+\(linea [ab]\)$/,'');
  for (let i = 1; i < segments.length; i++) {
    const current = route.steps[i];
    if (segments[i].mode !== 'METRO' || current.fareInput) continue;
    let previous = i - 1;
    let walking = 0;
    while (previous >= 0 && route.steps[previous].mode === 'walk') {
      const step = route.steps[previous];
      if (!Number.isFinite(step.duration) || step.duration < 0) break;
      walking += step.duration;
      previous--;
    }
    if (previous < 0 || walking > 3 || segments[previous].mode !== 'METRO') continue;
    const before = route.steps[previous];
    const connection = fareConfig.metroConnections.find(item =>
      item.lines.includes(normalizedLine(before.line)) && item.lines.includes(normalizedLine(current.line)) &&
      normalizedLine(before.line) !== normalizedLine(current.line) &&
      station(before.transit?.arrivalStop) === item.station && station(current.transit?.departureStop) === item.station);
    if (!connection) continue;
    const walks = route.steps.slice(previous + 1, i);
    if (walks.some(step => [step.station?.name,step.station?.nameRef,step.transit?.departureStop,step.transit?.arrivalStop]
      .some(name => name !== undefined && station(name) !== connection.station))) continue;
    segments[i] = {...segments[i], metroContinuation:'planned', evidence:'Conexión A/B prevista en San Antonio; permanencia en zona paga por confirmar'};
  }
  return segments;
}

export function priceRoute(route: RouteOption, profile: FareProfile = fareConfig.defaultProfile, evidence: FareEvidence = {}): RouteOption {
  const fare = calculateFare(classifyRouteSegments(route, evidence), profile);
  return { ...route, fare, cost: fare.total ?? -1, fareText: undefined,
    providerFare: route.providerFare || (route.source === 'google' && !route.fare ? { amount: route.cost >= 0 ? route.cost : undefined, text: route.fareText } : undefined),
    steps: route.steps.map((step, i) => ({ ...step, cost: fare.breakdown[i]?.charge ?? undefined })),
  };
}

/** Opt-in diagnostics; no raw locations, user names or persistence of Google itineraries. */
export function traceFare(route: RouteOption, enabled: boolean, logger: Pick<Console, 'debug'> = console) {
  if (!enabled || !route.fare) return;
  logger.debug('[TARIFA]', { perfil: route.fare.profile, estado: route.fare.status, total: route.fare.total,
    cadenas: route.fare.chains, pendientes: route.fare.unresolved });
}
