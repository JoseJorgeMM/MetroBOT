// tests/_honesty_impl.mjs
// Pure logic mirror of src/lib/honesty.ts.

export const PARTIAL_THRESHOLD = 0.41;

export function ratioFor(route) {
  const v = route && route.validation;
  if (!v || !v.total) return 0;
  if (typeof v.degradedSteps !== 'number') return 0;
  return v.degradedSteps / v.total;
}

export function computeHonestyAssessment(routes) {
  if (!routes || routes.length === 0) {
    return { level: 'confiable', label: 'Sin rutas', worstRatio: 0, totalDegraded: 0 };
  }
  let worst = 0;
  let totalDeg = 0;
  for (const r of routes) {
    const ratio = ratioFor(r);
    if (ratio > worst) worst = ratio;
    totalDeg += ((r && r.validation && r.validation.degradedSteps) || 0);
  }
  let level;
  let label;
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
  return { level: level, label: label, worstRatio: worst, totalDegraded: totalDeg };
}
