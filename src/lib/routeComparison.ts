import type { RouteOption } from './routing';

export type RoutePriority = 'duration' | 'cost' | 'walking' | 'transfers';
const known = (value: number) => Number.isFinite(value) && value >= 0;

export function walkingMinutes(route: RouteOption): number | null {
  const allSteps = Array.isArray(route.steps) ? route.steps : [];
  const steps = allSteps.filter(step => step.mode === 'walk');
  if (!steps.length) return route.modes?.includes('walk') || !allSteps.length ? null : 0;
  if (steps.some(step => !known(step.duration))) return null;
  return steps.reduce((sum, step) => sum + step.duration, 0);
}

export function rankRoutes(routes: RouteOption[], priority: RoutePriority) {
  const score = (route: RouteOption) => {
    const value = priority === 'walking' ? walkingMinutes(route) : route[priority];
    return value !== null && known(value) ? value : Infinity;
  };
  return routes.map((route, index) => ({ route, index })).sort((a, b) =>
    (score(a.route) - score(b.route)) ||
    ((known(a.route.duration) ? a.route.duration : Infinity) - (known(b.route.duration) ? b.route.duration : Infinity)) ||
    a.index - b.index,
  );
}

export function timeTradeoff(route: RouteOption, routes: RouteOption[]): number | null {
  const durations = routes.map(item => item.duration).filter(known);
  return known(route.duration) && durations.length ? Math.max(0, route.duration - Math.min(...durations)) : null;
}
