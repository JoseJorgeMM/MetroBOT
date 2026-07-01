// evidence.ts
// -----------------------------------------------------------------------------
// Compute evidence score per route based on _evidence citations provided by
// the LLM. Used for telemetry + UI badges.
// -----------------------------------------------------------------------------

export function computeEvidenceScore(route: { steps?: Array<{ mode?: string; _evidence?: { sourceRouteId?: string; sourceStopName?: string } }> } | null | undefined): number {
  if (!route || !Array.isArray(route.steps)) return 0;
  let total = 0;
  let scored = 0;
  for (const s of route.steps) {
    if (s.mode !== 'bus_articulado') continue;
    total++;
    const ev = s._evidence;
    if (ev && ev.sourceRouteId && ev.sourceStopName) scored++;
  }
  if (total === 0) return 1;
  return scored / total;
}

export function missingEvidence(route: { steps?: Array<{ mode?: string; instruction?: string; _evidence?: { sourceRouteId?: string; sourceStopName?: string } }> } | null | undefined): string[] {
  if (!route || !Array.isArray(route.steps)) return [];
  const out: string[] = [];
  for (const s of route.steps) {
    if (s.mode !== 'bus_articulado') continue;
    const ev = s._evidence;
    if (!(ev && ev.sourceRouteId && ev.sourceStopName)) {
      out.push(s.instruction || s.mode || 'bus_articulado');
    }
  }
  return out;
}
