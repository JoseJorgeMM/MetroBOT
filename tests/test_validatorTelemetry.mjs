// tests/test_validatorTelemetry.mjs
import { loadTelemetry, saveTelemetry, recordSession, summarizeTelemetry, KEY, CAP } from './_validatorTelemetry_impl.mjs';

let pass = 0, fail = 0;
const failures = [];
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ✓', name); }
  else { fail++; failures.push({ name, actual: a, expected: e }); console.log('  ✗', name, '\n      actual:', a, '\n      expected:', e); }
}
function tru(name, cond, hint) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; failures.push({ name, hint }); console.log('  ✗', name, hint ? '(' + hint + ')' : ''); }
}

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

console.log('loadTelemetry');
eq('empty -> []', loadTelemetry(fakeStorage()), []);
eq('null storage -> []', loadTelemetry(null), []);
eq('corrupt JSON -> []', loadTelemetry({ getItem: () => 'not-json', setItem: () => {} }), []);
eq('schema drop -> []', loadTelemetry({ getItem: () => JSON.stringify([{ ts: 'no', validated: 1 }]), setItem: () => {} }), []);

console.log('saveTelemetry');
eq('null storage -> false', saveTelemetry(null, []), false);
const s1 = fakeStorage();
eq('roundtrip ok', saveTelemetry(s1, [{ ts: 1, validated: 5, degraded: 0 }]), true);
eq('persisted', loadTelemetry(s1), [{ ts: 1, validated: 5, degraded: 0 }]);

console.log('recordSession');
eq('null storage -> false', recordSession(null, 5, 1, 100), false);
const s2 = fakeStorage();
eq('record + load', recordSession(s2, 3, 1, 1000) && JSON.stringify(loadTelemetry(s2)), JSON.stringify([{ ts: 1000, validated: 3, degraded: 1 }]));
eq('cap behavior 60 -> 50', (function () { const s = fakeStorage(); for (let i = 0; i < 60; i++) recordSession(s, 1, 0, i); return loadTelemetry(s).length === 50; })(), true);
eq('cap keeps most recent', (function () { const s = fakeStorage(); for (let i = 0; i < 60; i++) recordSession(s, 1, 0, i); return loadTelemetry(s)[49].ts === 59; })(), true);

console.log('summarizeTelemetry');
eq('empty', summarizeTelemetry(fakeStorage()).sessions, 0);
eq('empty ratio 0', summarizeTelemetry(fakeStorage()).ratio, 0);
const s3 = fakeStorage();
recordSession(s3, 4, 1, 100);
recordSession(s3, 2, 2, 200);
eq('mixed totals', summarizeTelemetry(s3).totalValidated, 6);
eq('mixed degraded', summarizeTelemetry(s3).totalDegraded, 3);
eq('mixed ratio approx 1/3', Math.round(summarizeTelemetry(s3).ratio * 1000), 333);
eq('mixed sessions count', summarizeTelemetry(s3).sessions, 2);

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass + fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass + fail)); for (const f of failures) console.log(' -', f.name, JSON.stringify(f)); process.exit(1); }
