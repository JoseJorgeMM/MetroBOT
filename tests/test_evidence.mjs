// tests/test_evidence.mjs
import { computeEvidenceScore, missingEvidence } from './_evidence_impl.mjs';

let pass = 0, fail = 0;
const failures = [];
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ✓', name); }
  else { fail++; failures.push({ name, actual: a, expected: e }); console.log('  ✗', name, '\n      actual:', a, '\n      expected:', e); }
}

console.log('computeEvidenceScore');
eq('no bus steps -> 1', computeEvidenceScore({ steps: [{ mode: 'metro' }] }), 1);
eq('2 bus both with evidence -> 1', computeEvidenceScore({ steps: [{ mode: 'bus_articulado', _evidence: { sourceRouteId: 'C7-001', sourceStopName: 'Niquia' } }, { mode: 'bus_articulado', _evidence: { sourceRouteId: '142I', sourceStopName: 'Sur' } }] }), 1);
eq('2 bus one with evidence -> 0.5', computeEvidenceScore({ steps: [{ mode: 'bus_articulado', _evidence: { sourceRouteId: 'C7-001', sourceStopName: 'Niquia' } }, { mode: 'bus_articulado' }] }), 0.5);
eq('2 bus no evidence -> 0', computeEvidenceScore({ steps: [{ mode: 'bus_articulado' }, { mode: 'bus_articulado' }] }), 0);
eq('empty route -> 0', computeEvidenceScore({}), 0);
eq('null route -> 0', computeEvidenceScore(null), 0);
eq('incomplete _evidence -> 0', computeEvidenceScore({ steps: [{ mode: 'bus_articulado', _evidence: { sourceRouteId: 'X' } }, { mode: 'bus_articulado', _evidence: { sourceStopName: 'Y' } }] }), 0);

console.log('missingEvidence');
eq('returns instruction strings', missingEvidence({ steps: [{ mode: 'bus_articulado', instruction: 'Toma C7-001' }, { mode: 'bus_articulado', _evidence: { sourceRouteId: '142I', sourceStopName: 'Sur' } }] }), ['Toma C7-001']);
eq('empty route -> []', missingEvidence({}), []);
eq('null route -> []', missingEvidence(null), []);

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass + fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass + fail)); for (const f of failures) console.log(' -', f.name, JSON.stringify(f)); process.exit(1); }
