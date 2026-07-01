// tests/_evidence_impl.mjs
export function computeEvidenceScore(route) {
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

export function missingEvidence(route) {
  if (!route || !Array.isArray(route.steps)) return [];
  const out = [];
  for (const s of route.steps) {
    if (s.mode !== 'bus_articulado') continue;
    const ev = s._evidence;
    if (!(ev && ev.sourceRouteId && ev.sourceStopName)) {
      out.push(s.instruction || s.mode || 'bus_articulado');
    }
  }
  return out;
}
