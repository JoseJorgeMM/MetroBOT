import { loadRecents, pushRecent, RECENTS_KEY, RECENTS_CAP } from './_recents_impl.mjs';

let pass = 0, fail = 0;
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  \u2713', name); }
  else { fail++; console.log('  \u2717', name, '\n      actual:', a, '\n      expected:', e); }
}
function makeStorage() { return new Map(); }
function makeStorageLike() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

console.log('recents: empty');
const s1 = makeStorageLike();
assertEq('empty', loadRecents(s1), []);

console.log('recents: push adds entry with timestamp');
const s2 = makeStorageLike();
const r1 = pushRecent(s2, 'Poblado');
assertEq('size 1', r1.length, 1);
assertEq('query preserved', r1[0].query, 'Poblado');
assertEq('timestamp number', typeof r1[0].timestamp, 'number');

console.log('recents: push same query moves to top (MRU)');
const s3 = makeStorageLike();
pushRecent(s3, 'A');
pushRecent(s3, 'B');
pushRecent(s3, 'A');
const r2 = loadRecents(s3).map(x => x.query);
assertEq('A is now first', r2, ['A', 'B']);
assertEq('A appears only once', r2.filter(q => q === 'A').length, 1);

console.log('recents: cap at 10');
const s4 = makeStorageLike();
for (let i = 0; i < 15; i++) pushRecent(s4, 'q' + i);
const r3 = loadRecents(s4);
assertEq('size capped at ' + RECENTS_CAP, r3.length, RECENTS_CAP);
assertEq('most recent (q14) first', r3[0].query, 'q14');
assertEq('oldest (q5) last', r3[r3.length - 1].query, 'q5');

console.log('recents: case-insensitive dedup');
const s5 = makeStorageLike();
pushRecent(s5, 'Poblado');
pushRecent(s5, 'poblado');
pushRecent(s5, 'POBLADO');
assertEq('dedup case-insensitive', loadRecents(s5).length, 1);

console.log('recents: empty / whitespace ignored');
const s6 = makeStorageLike();
pushRecent(s6, '');
pushRecent(s6, '   ');
const r4 = loadRecents(s6);
assertEq('empty/whitespace ignored', r4.length, 0);

console.log('recents: corrupt JSON -> empty');
const s7 = makeStorageLike();
s7.setItem(RECENTS_KEY, 'not-json');
assertEq('corrupt', loadRecents(s7), []);

console.log('recents: quota error -> keep existing');
const s8 = {
  getItem: () => '[]',
  setItem: () => { throw new Error('quota'); },
  removeItem: () => {}
};
// Pre-load is '[]'; pushRecent returns the unchanged list because save fails.
const r5 = pushRecent(s8, 'X');
assertEq('quota keeps empty list', r5, []);

console.log('recents: push carries coords');
const s9 = makeStorageLike();
const r6 = pushRecent(s9, 'Poblado', { coords: { lat: 6.21, lng: -75.57 } });
assertEq('coords attached', r6[0].coords, { lat: 6.21, lng: -75.57 });

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass+fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass+fail)); process.exit(1); }
