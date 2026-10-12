import type { RouteOption } from './routing';
import { classifyRouteSegments, type FareEvidence } from './fares/routeAdapter';

export type RoutePriority = 'duration' | 'cost' | 'walking' | 'transfers';
const known = (value: number) => Number.isFinite(value) && value >= 0;

export const routeSystemLabels = [
  'Sistema Metro',
  'Alimentadores y buses integrados',
  'A pie y EnCicla',
  'Buses convencionales o transporte sin confirmar',
] as const;
const metroModes = new Set(['METRO','CABLE','CABLE_ARVI','TRANVIA','METROPLUS']);
const integratedModes = new Set(['ALIMENTADOR','BUS_INTEGRADO','MICRO_INTEGRADO']);

/** Transport identity is independent of fare availability and the provider. */
export function getRouteSystemGroup(route: RouteOption, evidence: FareEvidence = {}): 0|1|2|3 {
  const segments = classifyRouteSegments(route, evidence);
  if (!segments.length) return 3;
  let metro = false, integrated = false;
  for (const {mode} of segments) {
    if (mode === 'WALK' || mode === 'ENCICLA') continue;
    if (metroModes.has(mode)) metro = true;
    else if (integratedModes.has(mode)) integrated = true;
    else return 3; // One conventional/unknown leg makes the entire chain last.
  }
  return integrated ? 1 : metro ? 0 : 2;
}

export function walkingMinutes(route: RouteOption): number | null {
  const allSteps = Array.isArray(route.steps) ? route.steps : [];
  const steps = allSteps.filter(step => step.mode === 'walk');
  if (!steps.length) return route.modes?.includes('walk') || !allSteps.length ? null : 0;
  if (steps.some(step => !known(step.duration))) return null;
  return steps.reduce((sum, step) => sum + step.duration, 0);
}

export function rankRoutes(routes: RouteOption[], priority: RoutePriority, evidence: FareEvidence = {}) {
  const score = (route: RouteOption) => {
    const value = priority === 'walking' ? walkingMinutes(route) : route[priority];
    return value !== null && known(value) ? value : Infinity;
  };
  return routes.map((route, index) => ({ route, index, group:getRouteSystemGroup(route,evidence) })).sort((a, b) =>
    a.group - b.group ||
    (score(a.route) - score(b.route)) ||
    ((known(a.route.duration) ? a.route.duration : Infinity) - (known(b.route.duration) ? b.route.duration : Infinity)) ||
    a.index - b.index,
  );
}

export function timeTradeoff(route: RouteOption, routes: RouteOption[]): number | null {
  const durations = routes.map(item => item.duration).filter(known);
  return known(route.duration) && durations.length ? Math.max(0, route.duration - Math.min(...durations)) : null;
}
