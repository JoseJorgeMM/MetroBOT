// tests/test_sheet_drag.mjs
import { nextSnap } from './_sheet_drag_impl.mjs';

const SNAPS = [72, 320, 720];

let pass = 0, fail = 0;
const failures = [];
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ✓', name); }
  else { fail++; failures.push({ name, actual: a, expected: e }); console.log('  ✗', name, '\n      actual:', a, '\n      expected:', e); }
}

console.log('nextSnap');
eq('empty snaps -> 0', nextSnap(1, [], 0, 0), 0);
eq('no drag -> same', nextSnap(1, SNAPS, 0, 0), 1);
eq('tiny drag 2px -> same', nextSnap(1, SNAPS, 2, 0), 1);
eq('drag UP 200px from mid -> max', nextSnap(1, SNAPS, -200, 0), 2);
eq('drag DOWN 200px from max -> mid', nextSnap(2, SNAPS, 200, 0), 1);
eq('drag DOWN 600px from mid -> min', nextSnap(1, SNAPS, 600, 0), 0);
eq('fast flick DOWN v=0.8 from mid -> min', nextSnap(1, SNAPS, 0, 0.8), 0);
eq('fast flick UP v=-0.8 from min -> mid (one step)', nextSnap(0, SNAPS, 0, -0.8), 1);
eq('at min, drag DOWN -> min', nextSnap(0, SNAPS, 600, 0), 0);
eq('at max, drag UP -> max', nextSnap(2, SNAPS, -600, 0), 2);
eq('boundary clamping at min', nextSnap(-5, SNAPS, 600, 0), 0);
eq('boundary clamping at max', nextSnap(99, SNAPS, -600, 0), 2);
eq('mixed velocity+delta both negative -> up', nextSnap(1, SNAPS, -10, -0.5), 2);
eq('mixed velocity+delta both positive -> down', nextSnap(1, SNAPS, 10, 0.5), 0);
eq('just under threshold no snap', nextSnap(1, SNAPS, 7, 0), 1);
eq('at 8px exactly snaps up', nextSnap(1, SNAPS, -8, 0), 2);

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass + fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass + fail)); for (const f of failures) console.log(' -', f.name, JSON.stringify(f)); process.exit(1); }
