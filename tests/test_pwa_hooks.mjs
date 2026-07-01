// tests/test_pwa_hooks.mjs
import { isDismissedRecently, markDismissed, shouldOfferInstall, DISMISS_KEY } from './_pwa_hooks_impl.mjs';

let pass = 0, fail = 0;
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  \u2713', name); }
  else { fail++; console.log('  \u2717', name, '\n      actual:', a, '\n      expected:', e); }
}
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const fakeEvent = { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) };

console.log('isDismissedRecently');
const s = fakeStorage();
assertEq('empty -> false', isDismissedRecently(s, 1_000_000), false);
markDismissed(s, 1_000_000);
assertEq('just dismissed -> true', isDismissedRecently(s, 1_000_000 + 1), true);
assertEq('after 8 days -> false', isDismissedRecently(s, 1_000_000 + DISMISS_KEY ? 8 * 24 * 3600 * 1000 : 8 * 24 * 3600 * 1000 + 100), false);
assertEq('after 3 days -> true', isDismissedRecently(s, 1_000_000 + 3 * 24 * 3600 * 1000 + 1000), true);
assertEq('corrupt -> false', isDismissedRecently({ getItem: () => 'not-a-number', setItem: () => {} }, 1_000_000), false);

console.log('shouldOfferInstall');
assertEq('no event', shouldOfferInstall(null, false, false), false);
assertEq('event but standalone', shouldOfferInstall(fakeEvent, true, false), false);
assertEq('event but dismissed', shouldOfferInstall(fakeEvent, false, true), false);
assertEq('eligible', shouldOfferInstall(fakeEvent, false, false), true);

console.log('markDismissed');
const s2 = fakeStorage();
assertEq('returns true on success', markDismissed(s2, 12345), true);
assertEq('persists numeric value', s2.getItem(DISMISS_KEY), '12345');

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass+fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass+fail)); process.exit(1); }
