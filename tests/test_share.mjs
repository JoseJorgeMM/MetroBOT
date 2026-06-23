import { buildShareText, tryShare } from './_share_impl.mjs';

let pass = 0, fail = 0;
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  \u2713', name); }
  else { fail++; console.log('  \u2717', name, '\n      actual:', a, '\n      expected:', e); }
}

console.log('buildShareText');
const t1 = buildShareText({ duration: 25, cost: 3430, transfers: 1 }, 'Casa', 'Trabajo');
assertEq('happy path contains origin + dest', t1.indexOf('Casa') !== -1 && t1.indexOf('Trabajo') !== -1, true);
assertEq('happy path contains duration', t1.indexOf('25 min') !== -1, true);
assertEq('happy path contains cost formatted', t1.indexOf('$3.430') !== -1, true);
assertEq('happy path contains transfers', t1.indexOf('1 transbordos') !== -1, true);

const t2 = buildShareText({}, null, null);
assertEq('null names fall back to origen/destino', t2.indexOf('origen') !== -1 && t2.indexOf('destino') !== -1, true);
assertEq('null route fields fall back to ?', t2.indexOf('? min') !== -1 && t2.indexOf('$?') !== -1, true);

const t3 = buildShareText(null, 'A', 'B');
assertEq('null route also handled', t3.indexOf('A -> B') !== -1 && t3.indexOf('? min') !== -1, true);

console.log('tryShare');
async function runShareTests() {
  // 1) navigator.share succeeds -> 'shared'
  let shareCalled = false;
  const r1 = await tryShare('hello', 't', { share: async () => { shareCalled = true; } });
  assertEq('share path returns shared', r1, 'shared');
  assertEq('share was invoked', shareCalled, true);

  // 2) navigator.share throws -> falls back to clipboard -> 'copied'
  let copyCalled = false;
  const r2 = await tryShare('hello', 't', {
    share: async () => { throw new Error('user dismissed'); },
    clipboard: { writeText: async (s) => { copyCalled = (s === 'hello'); } }
  });
  assertEq('share rejection falls back to clipboard', r2, 'copied');
  assertEq('clipboard got the text', copyCalled, true);

  // 3) No share, clipboard OK -> 'copied'
  const r3 = await tryShare('hello', 't', { clipboard: { writeText: async () => {} } });
  assertEq('no share API -> copied', r3, 'copied');

  // 4) No share, no clipboard -> 'failed'
  const r4 = await tryShare('hello', 't', {});
  assertEq('neither api -> failed', r4, 'failed');

  // 5) Share throws AND clipboard throws -> 'failed'
  const r5 = await tryShare('hello', 't', {
    share: async () => { throw new Error('dismissed'); },
    clipboard: { writeText: async () => { throw new Error('denied'); } }
  });
  assertEq('both fail -> failed', r5, 'failed');

  console.log('\n-----');
  if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass+fail) + ')'); process.exit(0); }
  else { console.log('FAILED ' + fail + '/' + (pass+fail)); process.exit(1); }
}

runShareTests();
