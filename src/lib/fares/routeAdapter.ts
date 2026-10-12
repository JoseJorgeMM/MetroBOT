import type { RouteOption } from '../routing';
import type { IntegratedRoute } from '../integratedRoutes';
import { calculateDistance, type Station } from '../stations';
import { matchStation } from '../routeStations';
import { calculateFare } from './engine';
import { fareConfig } from './config';
import type { FareProfile, FareSegment } from './types';
import { urbanBudget, type UrbanFares, type UrbanChoices } from './urbanFares';

export interface FareEvidence { stations?: Station[]; routes?: IntegratedRoute[]; urbanFares?:UrbanFares|null; urbanChoices?:UrbanChoices }
const normalizedLine = (value?: string) => (value || '').replace(/l[ií]nea\s*/gi, '').trim().toUpperCase();
const modeCodes: Record<string, string> = { metro:'METRO', metrocable:'CABLE', tranvia:'TRANVIA', metroplus:'METROPLUS', encicla:'ENCICLA', walk:'WALK' };
const normalizedStationName = (value?: string) => (value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const officialMetroAgency = (name: string) => /^(metro de medell[ií]n|empresa de transporte masivo del valle de aburr[aá])$/i.test(name.trim());

/** Google may add a destination suffix to the official stop name (for example, "Cisneros - Moda"). */
function resolveMetroplusStop(name: string, point: { lat: number; lng: number }, stations: Station[]): Station | undefined {
  const exact = matchStation(name, point, 'metroplus', stations);
  if (exact) return exact;
  const observed = normalizedStationName(name);
  const candidates = new Map<string, Station>();
  for (const station of stations) {
    const canonical = normalizedStationName(station.nombre);
    if (station.sistema !== 'MPLUS' || canonical.length < 5 || !observed.includes(canonical)) continue;
    if (calculateDistance(point.lat, point.lng, station.lat, station.lng) > 300) continue;
    candidates.set(`${canonical}:${normalizedLine(station.linea)}`, station);
  }
  return candidates.size === 1 ? [...candidates.values()][0] : undefined;
}

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
      const departure = resolveMetroplusStop(transit.departureStop || '', transit.departureLocation, evidence.stations || []);
      const arrival = resolveMetroplusStop(transit.arrivalStop || '', transit.arrivalLocation, evidence.stations || []);
      const metroAgency = transit.agencies.some(agency => officialMetroAgency(agency.name));
      if (metroAgency && departure && arrival && normalizedLine(departure.linea) === normalizedLine(arrival.linea)) {
        return { ...base, mode:'METROPLUS', evidence:'Operador oficial y ambas paradas coinciden en una misma línea Metroplús del catálogo local' };
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
  const segments = classifyRouteSegments(route, evidence);
  let fare = calculateFare(segments, profile);
  const providerFare = route.providerFare || (route.source === 'google' && !route.fare ? { amount: route.cost >= 0 ? route.cost : undefined, text: route.fareText } : undefined);
  // Only the structured provider total with an explicit currency is eligible.
  // Legacy cost/text alone is not proof of currency or of a complete fare.
  if (fare.total === null && route.source === 'google' && providerFare?.currency === 'COP' &&
    typeof providerFare.amount === 'number' && Number.isFinite(providerFare.amount) && providerFare.amount > 0) {
    fare = { ...fare, source:'google', total:providerFare.amount, status:'CONDICIONAL', profile:'no_informado',
      integrationApplied:false, withoutIntegration:null, savings:null,
      breakdown:fare.breakdown.map(row => ({...row, charge:row.mode === 'WALK' ? 0 : null, description:'Incluido en el total del proveedor; desglose no informado'})),
      warnings:['Total estimado informado por Google Maps. No confirma descuentos del perfil seleccionado ni condiciones de Cívica.'],
    };
  }
  if (fare.total === null && evidence.urbanFares && evidence.urbanChoices) {
    fare = urbanBudget(segments,profile,evidence.urbanFares,evidence.urbanChoices) ?? fare;
  }
  const steps = route.steps.map((step, i) => ({ ...step,
    mode: segments[i]?.mode === 'METROPLUS' ? 'metroplus' as const : step.mode,
    cost: fare.breakdown[i]?.charge ?? undefined,
  }));
  return { ...route, modes: steps.map(step => step.mode), fare, cost: fare.total ?? -1, fareText: undefined,
    providerFare,
    steps,
  };
}

/** Opt-in diagnostics; no raw locations, user names or persistence of Google itineraries. */
export function traceFare(route: RouteOption, enabled: boolean, logger: Pick<Console, 'debug'> = console) {
  if (!enabled || !route.fare) return;
  logger.debug('[TARIFA]', { perfil: route.fare.profile, estado: route.fare.status, total: route.fare.total,
    cadenas: route.fare.chains, pendientes: route.fare.unresolved });
}
