// tests/test_reduced_motion.mjs
import { matchesReducedMotion } from './_reduced_motion_impl.mjs';

let pass = 0, fail = 0;
const failures = [];
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ✓', name); }
  else { fail++; failures.push({ name, actual: a, expected: e }); console.log('  ✗', name, '\n      actual:', a, '\n      expected:', e); }
}

console.log('matchesReducedMotion');
eq('null -> false', matchesReducedMotion(null), false);
eq('undefined -> false', matchesReducedMotion(undefined), false);
eq('matches:true -> true', matchesReducedMotion({ matches: true }), true);
eq('matches:false -> false', matchesReducedMotion({ matches: false }), false);
eq('truthy non-object -> false', matchesReducedMotion('yes'), false);
eq('throws on .matches access -> false', matchesReducedMotion({ get matches() { throw new Error('boom'); } }), false);

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass + fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass + fail)); for (const f of failures) console.log(' -', f.name, JSON.stringify(f)); process.exit(1); }
