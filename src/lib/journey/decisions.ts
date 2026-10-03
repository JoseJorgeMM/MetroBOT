import type { RouteOption, TransportMode } from '../routing';
import { walkingMinutes } from '../routeComparison';
import type { JourneyNeeds } from './types';

const known = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const metric = (value: unknown): number | null => known(value) ? value : null;

/** Stable identities from supplied transit steps, never inferred from instructions. */
export function serviceKeys(route: RouteOption): string[] {
  return [...new Set(route.steps
    .filter(step => step.mode !== 'walk' && step.mode !== 'encicla')
    .map(step => {
      const line = (step.line ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().replace(/\bLINEA\b/g, '').replace(/\s+/g, ' ').trim();
      return `${step.mode}:${line}`;
    }))];
}

const modeLabels: Record<TransportMode, string> = {
  metro: 'Metro', metrocable: 'Metrocable', tranvia: 'Tranvía', metroplus: 'Metroplús',
  bus: 'Bus', bus_articulado: 'Bus articulado', transit: 'Transporte público',
  walk: 'Caminata', encicla: 'EnCicla',
};

export function serviceLabel(key: string): string {
  const separator = key.indexOf(':');
  const mode = separator < 0 ? key : key.slice(0, separator);
  const line = separator < 0 ? '' : key.slice(separator + 1);
  return `${modeLabels[mode as TransportMode] ?? mode}${line ? ` · Línea ${line}` : ''}`;
}

interface Metrics {
  cost: number | null;
  duration: number | null;
  walking: number | null;
  transfers: number | null;
}

function metricsFor(route: RouteOption): Metrics {
  return {
    cost: route.fare && (route.fare.status === 'DETERMINADA' || route.fare.status === 'CONDICIONAL')
      ? metric(route.fare.total) : null,
    duration: metric(route.duration), walking: metric(walkingMinutes(route)), transfers: metric(route.transfers),
  };
}

export interface JourneyDecisionOption {
  index: number;
  route: RouteOption;
  violations: string[];
  unknowns: string[];
  conditional: boolean;
  eligible: boolean;
  pareto: boolean;
}

export interface JourneyEvaluation {
  options: JourneyDecisionOption[];
  recommendedIndex: number | null;
  services: string[];
  tradeoff: string | null;
}

/** Constraints are hard gates. Ranking never substitutes zero for missing data. */
export function evaluateJourneys(
  routes: RouteOption[], needs: JourneyNeeds, excludedService?: string,
): JourneyEvaluation {
  const metrics = routes.map(metricsFor);
  const keys = routes.map(serviceKeys);
  const primary = needs.priority === 'balanced' ? 'duration' : needs.priority;
  const primaryUnknownReasons: Record<keyof Metrics, string> = {
    cost: 'Costo: falta tarifa para comparar esta prioridad',
    duration: needs.priority === 'balanced'
      ? 'Duración: falta duración para comparar la prioridad equilibrada'
      : 'Duración: falta duración para comparar esta prioridad',
    walking: 'Caminata: falta tiempo a pie para comparar esta prioridad',
    transfers: 'Transbordos: falta cantidad de transbordos para comparar esta prioridad',
  };
  const constraints: Array<[keyof Metrics, number | null, string]> = [
    ['cost', needs.maxCost, 'Costo'], ['duration', needs.maxDurationMinutes, 'Duración'],
    ['walking', needs.maxWalkingMinutes, 'Caminata'], ['transfers', needs.maxTransfers, 'Transbordos'],
  ];
  const options: JourneyDecisionOption[] = routes.map((route, index) => {
    const violations: string[] = [];
    const unknowns = (needs.notes ?? []).map(note => `Necesidad pendiente de verificar: ${note}`);
    if (metrics[index][primary] === null) unknowns.push(primaryUnknownReasons[primary]);
    for (const [name, limit, label] of constraints) {
      if (limit == null) continue;
      if (!known(limit)) {
        violations.push(`${label}: límite inválido`);
      } else if (metrics[index][name] === null) {
        unknowns.push(`${label}: sin datos suficientes para comprobar el límite`);
      } else if (metrics[index][name]! > limit) {
        violations.push(`${label}: supera el límite de ${limit}`);
      }
    }
    if (excludedService && keys[index].includes(excludedService)) {
      violations.push(`Usa el servicio excluido: ${serviceLabel(excludedService)}`);
    }
    // Runtime provider validation has this flag even though RouteOption omits it.
    const validation = route.validation as (RouteOption['validation'] & { unsafe?: boolean }) | undefined;
    if (validation?.unsafe === true) violations.push('Ruta marcada como insegura por la validación');
    else if (validation?.ok === false) violations.push('Ruta sin validación satisfactoria');
    return {
      index, route, violations, unknowns, conditional: route.fare?.status === 'CONDICIONAL',
      eligible: !violations.length && !unknowns.length, pareto: false,
    };
  });
  const eligible = options.filter(option => option.eligible);
  const dimensions: Array<keyof Metrics> = ['cost', 'duration', 'walking', 'transfers'];
  const complete = eligible.filter(option => dimensions.every(name => metrics[option.index][name] !== null));
  for (const option of complete) {
    const values = metrics[option.index];
    option.pareto = !complete.some(other => {
      const candidate = metrics[other.index];
      return dimensions.every(name => candidate[name]! <= values[name]!) &&
        dimensions.some(name => candidate[name]! < values[name]!);
    });
  }

  // Dense ordinal ranks: equal values share a rank; missing values rank after all
  // known values. Balanced sums the three travel ranks with equal weight. An
  // entirely unavailable dimension contributes equally to every candidate.
  const travelDimensions = ['duration', 'walking', 'transfers'] as const;
  const ranks = travelDimensions.map(name => [...new Set(eligible
    .map(option => metrics[option.index][name]).filter(known))].sort((a, b) => a - b));
  const score = (option: JourneyDecisionOption): number => {
    if (needs.priority !== 'balanced') return metrics[option.index][needs.priority] ?? Infinity;
    return travelDimensions.reduce((sum, name, i) => {
      const value = metrics[option.index][name];
      return sum + (value === null ? ranks[i].length : ranks[i].indexOf(value));
    }, 0);
  };
  const recommended = [...eligible].sort((a, b) => score(a) - score(b) || a.index - b.index)[0];
  const fastest = eligible.filter(option => metrics[option.index].duration !== null)
    .sort((a, b) => metrics[a.index].duration! - metrics[b.index].duration! || a.index - b.index)[0];
  const differences: string[] = [];
  if (recommended && fastest) {
    const chosen = metrics[recommended.index];
    const baseline = metrics[fastest.index];
    for (const [name, label] of [['duration', 'de viaje'], ['walking', 'a pie']] as const) {
      const value = chosen[name];
      const reference = baseline[name];
      if (value !== null && reference !== null && value !== reference) {
        const difference = Number(Math.abs(value - reference).toPrecision(12));
        differences.push(`${difference} min ${value > reference ? 'más' : 'menos'} ${label}`);
      }
    }
  }
  return {
    options, recommendedIndex: recommended?.index ?? null,
    services: [...new Set(keys.flat())], tradeoff: differences.length ? differences.join('; ') : null,
  };
}
