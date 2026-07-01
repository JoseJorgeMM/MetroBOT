// honesty.ts
// -----------------------------------------------------------------------------
// Honest UX layer. Aggregates per-route validation results into one of three
// levels so the chat UI can warn the user instead of showing confident cards.
// -----------------------------------------------------------------------------

export const PARTIAL_THRESHOLD = 0.41;

export type HonestyLevel = 'confiable' | 'parcial' | 'no_verificada';

export interface RouteValidationLike {
  validation?: { total?: number; degradedSteps?: number };
}

export interface HonestyAssessment {
  level: HonestyLevel;
  label: string;
  worstRatio: number;
  totalDegraded: number;
}

export function ratioFor(route: RouteValidationLike | null | undefined): number {
  const v = route && route.validation;
  if (!v || !v.total) return 0;
  if (typeof v.degradedSteps !== 'number') return 0;
  return v.degradedSteps / v.total;
}

export function computeHonestyAssessment(routes: RouteValidationLike[] | null | undefined): HonestyAssessment {
  if (!routes || routes.length === 0) {
    return { level: 'confiable', label: 'Sin rutas', worstRatio: 0, totalDegraded: 0 };
  }
  let worst = 0;
  let totalDeg = 0;
  for (const r of routes) {
    const ratio = ratioFor(r);
    if (ratio > worst) worst = ratio;
    totalDeg += (r && r.validation && r.validation.degradedSteps) || 0;
  }
  let level: HonestyLevel;
  let label: string;
  if (worst === 0) {
    level = 'confiable';
    label = 'Todas las paradas verificadas';
  } else if (worst < PARTIAL_THRESHOLD) {
    level = 'parcial';
    label = 'Algunas paradas no se pudieron verificar';
  } else {
    level = 'no_verificada';
    label = 'No se pudo verificar la mayoria del recorrido';
  }
  return { level, label, worstRatio: worst, totalDegraded: totalDeg };
}
