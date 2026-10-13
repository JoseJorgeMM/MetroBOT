import type { RouteOption } from '../routing';

/** Product heuristics, not official thresholds or a calibrated probability. */
export const connectionRules = { version: '1', tightBelowMinutes: 3, longWalkFromMinutes: 10 } as const;
export interface ConnectionAssessment {
  fromIndex: number;
  toIndex: number;
  from: string;
  to: string;
  walking: number | null;
  margin: number | null;
  adjustedMargin: number | null;
  longWalk: boolean;
  status: 'unknown' | 'insufficient' | 'tight' | 'available';
}

export function assessConnections(route: RouteOption, delayMinutes = 0): ConnectionAssessment[] {
  if (!Number.isFinite(delayMinutes) || delayMinutes < 0) throw new RangeError('Invalid delay');
  const steps = Array.isArray(route.steps) ? route.steps : [];
  const result: ConnectionAssessment[] = [];
  let previous: number | undefined;
  steps.forEach((step, index) => {
    if (step.mode === 'walk' || step.mode === 'encicla') return;
    if (previous !== undefined) {
      const before = steps[previous];
      const between = steps.slice(previous + 1, index);
      const sum = between.reduce((total, item) => total + item.duration, 0);
      const walking = between.every(item => item.mode === 'walk' && Number.isFinite(item.duration) && item.duration >= 0)
        && Number.isFinite(sum) ? sum : null;
      const arrival = Date.parse(before.transit?.arrivalTime || '');
      const departure = Date.parse(step.transit?.departureTime || '');
      const chronological = Number.isFinite(arrival) && Number.isFinite(departure) && departure >= arrival;
      const margin = chronological && walking !== null ? (departure - arrival) / 60000 - walking : null;
      const adjustedMargin = margin === null ? null : margin - delayMinutes;
      result.push({
        fromIndex: previous, toIndex: index,
        from: before.transit?.arrivalStop || before.station?.name || 'Llegada anterior',
        to: step.transit?.departureStop || step.station?.name || 'Siguiente embarque',
        walking, margin, adjustedMargin,
        longWalk: walking !== null && walking >= connectionRules.longWalkFromMinutes,
        status: adjustedMargin === null ? 'unknown' : adjustedMargin < 0 ? 'insufficient'
          : adjustedMargin < connectionRules.tightBelowMinutes ? 'tight' : 'available',
      });
    }
    previous = index;
  });
  return result;
}
