// tests/test_honesty.mjs
import { computeHonestyAssessment, ratioFor, isAnyUnsafe, PARTIAL_THRESHOLD, UNSAFE_DEGRADED_THRESHOLD } from './_honesty_impl.mjs';

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

console.log('isAnyUnsafe');
eq('null -> false', isAnyUnsafe(null), false);
eq('empty -> false', isAnyUnsafe([]), false);
eq('none unsafe -> false', isAnyUnsafe([{ validation: { unsafe: false } }]), false);
eq('one unsafe -> true', isAnyUnsafe([{ validation: { unsafe: false } }, { validation: { unsafe: true } }]), true);
eq('unsafe first -> true', isAnyUnsafe([{ validation: { unsafe: true } }, { validation: { unsafe: false } }]), true);

console.log('computeHonestyAssessment (unsafe)');
eq('any unsafe -> unsafe level', computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 0, unsafe: true } }]).level, 'unsafe');
eq('any unsafe mixed: confiable + unsafe -> unsafe wins', computeHonestyAssessment([
  { validation: { total: 5, degradedSteps: 0 } },
  { validation: { total: 5, degradedSteps: 0, unsafe: true } },
]).level, 'unsafe');
eq('unsafe label is Spanish', /No encontre rutas validas/.test(computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 0, unsafe: true } }]).label), true);
eq('UNSAFE threshold default', UNSAFE_DEGRADED_THRESHOLD, 0.5);

console.log('ratioFor');
eq('no validation -> 0', ratioFor({}), 0);
eq('total 0 -> 0', ratioFor({ validation: { total: 0, degradedSteps: 0 } }), 0);
eq('2/4 -> 0.5', ratioFor({ validation: { total: 4, degradedSteps: 2 } }), 0.5);
eq('0/5 -> 0', ratioFor({ validation: { total: 5, degradedSteps: 0 } }), 0);

console.log('computeHonestyAssessment');
eq('empty routes', computeHonestyAssessment([]).level, 'confiable');
eq('null routes', computeHonestyAssessment(null).level, 'confiable');
eq('all valid', computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 0 } }, { validation: { total: 3, degradedSteps: 0 } }]).level, 'confiable');
eq('one bus degraded 1/5 -> parcial', computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 1 } }]).level, 'parcial');
eq('boundary 2/5 -> parcial (strict)', computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 2 } }]).level, 'parcial');
eq('3/5 -> no_verificada', computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 3 } }]).level, 'no_verificada');
eq('mixed worst 60% -> no_verificada', computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 0 } }, { validation: { total: 5, degradedSteps: 3 } }]).level, 'no_verificada');
eq('aggregate totalDegraded', computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 2 } }, { validation: { total: 3, degradedSteps: 1 } }]).totalDegraded, 3);
tru('worstRatio is number', typeof computeHonestyAssessment([]).worstRatio === 'number', 'expected number');
tru('worstRatio in [0,1]', computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 3 } }]).worstRatio <= 1);
eq('missing validation field treated as 0', computeHonestyAssessment([{ steps: [] }]).level, 'confiable');
eq('total:0 treated as 0', computeHonestyAssessment([{ validation: { total: 0, degradedSteps: 5 } }]).level, 'confiable');
eq('non-empty Spanish label for confiable', /verificadas/.test(computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 0 } }]).label), true);
eq('non-empty Spanish label for parcial', /Algunas/.test(computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 1 } }]).label), true);
eq('non-empty Spanish label for no_verificada', /mayoria/.test(computeHonestyAssessment([{ validation: { total: 5, degradedSteps: 4 } }]).label), true);
eq('PARTIAL_THRESHOLD exported', PARTIAL_THRESHOLD, 0.41);

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass + fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass + fail)); for (const f of failures) console.log(' -', f.name, JSON.stringify(f)); process.exit(1); }
