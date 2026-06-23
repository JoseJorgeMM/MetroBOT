import { addFavorite, removeFavorite, isFavorite, loadFavorites, saveFavorites, FAVORITES_KEY, FAVORITES_CAP } from './_favorites_impl.mjs';

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
function item(id, name) { return { id, name, lat: 6.2, lng: -75.5 }; }

console.log('favorites: empty');
const s1 = makeStorageLike();
assertEq('empty', loadFavorites(s1), []);

console.log('favorites: add');
const s2 = makeStorageLike();
const r1 = addFavorite(s2, item('casa', 'Casa'));
assertEq('add new', r1.length, 1);
assertEq('add persists', loadFavorites(s2).length, 1);
assertEq('isFavorite yes', isFavorite(s2, 'casa'), true);
assertEq('isFavorite no', isFavorite(s2, 'trabajo'), false);

console.log('favorites: add duplicate');
const r2 = addFavorite(s2, item('casa', 'CasaDup'));
assertEq('duplicate moves to top', r2[0].name, 'CasaDup');
assertEq('list size unchanged', r2.length, 1);

console.log('favorites: cap at 50');
const s3 = makeStorageLike();
for (let i = 0; i < 60; i++) addFavorite(s3, item('id' + i, 'Name ' + i));
assertEq('cap enforced', loadFavorites(s3).length, FAVORITES_CAP);
assertEq('most recent first', loadFavorites(s3)[0].id, 'id59');

console.log('favorites: remove');
const s4 = makeStorageLike();
addFavorite(s4, item('a', 'A'));
addFavorite(s4, item('b', 'B'));
addFavorite(s4, item('c', 'C'));
const r3 = removeFavorite(s4, 'b');
// After add a,b,c the list is [c,b,a]. Removing b yields [c,a]. Order preserved.
assertEq('remove by id', r3.map(x => x.id), ['c', 'a']);

console.log('favorites: corrupt JSON');
const s5 = makeStorageLike();
s5.setItem(FAVORITES_KEY, 'not-json{');
assertEq('corrupt JSON -> empty', loadFavorites(s5), []);

console.log('favorites: storage throws');
const s6 = {
  getItem: () => { throw new Error('quota'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => {},
};
const r4 = addFavorite(s6, item('x', 'X'));
assertEq('quota error -> empty', r4, []);

console.log('favorites: invalid item ignored');
const s7 = makeStorageLike();
addFavorite(s7, null);
addFavorite(s7, { id: 42 });
addFavorite(s7, { id: 'a', name: 'A' }); // missing lat/lng
const r5 = loadFavorites(s7);
assertEq('invalid items ignored', r5, []);

console.log('favorites: reorder on re-add');
const s8 = makeStorageLike();
addFavorite(s8, item('a', 'A'));
addFavorite(s8, item('b', 'B'));
addFavorite(s8, item('a', 'A')); // duplicate -> moves to top
assertEq('re-add moves to top', loadFavorites(s8).map(x => x.id), ['a', 'b']);

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass+fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass+fail)); process.exit(1); }
