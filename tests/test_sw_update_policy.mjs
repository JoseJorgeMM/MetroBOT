// tests/test_sw_update_policy.mjs
import {
  getSeenUpdateRevision,
  markUpdateSeen,
  shouldShowUpdateToast,
  SW_UPDATE_SEEN_KEY,
  SW_UPDATE_DISMISS_DURATION_MS,
} from './_sw_update_policy_impl.mjs';

let pass = 0, fail = 0;
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, '\n      actual:  ', a, '\n      expected:', e); }
}
function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const NOW = 1_700_000_000_000;

console.log('sw update policy: getSeenUpdateRevision');
assertEq('null storage -> null', getSeenUpdateRevision(null), null);
assertEq('empty storage -> null', getSeenUpdateRevision(makeStorage()), null);
assertEq('set value -> returns it raw', (() => {
  const s = makeStorage();
  markUpdateSeen(s, 'rev-1', NOW);
  return getSeenUpdateRevision(s);
})(), JSON.stringify({ revision: 'rev-1', ts: NOW }));

console.log('sw update policy: markUpdateSeen');
assertEq('null storage -> false', markUpdateSeen(null, 'rev-1', NOW), false);
assertEq('empty revision -> false', markUpdateSeen(makeStorage(), '', NOW), false);
assertEq('non-string revision -> false', markUpdateSeen(makeStorage(), 42, NOW), false);
{
  const s = makeStorage();
  assertEq('success -> true', markUpdateSeen(s, 'rev-1', NOW), true);
  const stored = JSON.parse(s.getItem(SW_UPDATE_SEEN_KEY));
  assertEq('stored.revision', stored.revision, 'rev-1');
  assertEq('stored.ts', stored.ts, NOW);
}

console.log('sw update policy: shouldShowUpdateToast');
assertEq('no revision -> false', shouldShowUpdateToast(makeStorage(), '', NOW), false);
{
  const s = makeStorage();
  assertEq('never seen -> true', shouldShowUpdateToast(s, 'rev-A', NOW), true);
}
{
  const s = makeStorage();
  markUpdateSeen(s, 'rev-A', NOW);
  assertEq('just seen (same rev) -> false', shouldShowUpdateToast(s, 'rev-A', NOW + 1), false);
  assertEq('different rev -> true', shouldShowUpdateToast(s, 'rev-B', NOW + 1), true);
  assertEq('same rev after 7 days -> true',
    shouldShowUpdateToast(s, 'rev-A', NOW + SW_UPDATE_DISMISS_DURATION_MS + 1), true);
}
{
  const s = makeStorage();
  s.setItem(SW_UPDATE_SEEN_KEY, 'not-json');
  assertEq('corrupt -> true', shouldShowUpdateToast(s, 'rev-A', NOW), true);
}
{
  const s = makeStorage();
  s.setItem(SW_UPDATE_SEEN_KEY, JSON.stringify({ revision: 'rev-A' }));
  assertEq('legacy (no ts) -> true', shouldShowUpdateToast(s, 'rev-A', NOW), true);
}
assertEq('null storage -> true (never seen)',
  shouldShowUpdateToast(null, 'rev-A', NOW), true);

console.log('sw update policy: blocked storage');
{
  const s = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {},
  };
  assertEq('blocked getItem -> null', getSeenUpdateRevision(s), null);
  assertEq('blocked setItem -> false', markUpdateSeen(s, 'rev', NOW), false);
  assertEq('blocked getItem for shouldShow -> true',
    shouldShowUpdateToast(s, 'rev', NOW), true);
}

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass + fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass + fail)); process.exit(1); }