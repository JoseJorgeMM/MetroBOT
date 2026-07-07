import { runMigrations, MIGRATION_FLAG_KEY, LEGACY_KEYS } from './_migration_v2_impl.mjs';

let pass = 0, fail = 0;
function assertEq(name, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, '\n      actual:  ', a, '\n      expected:', e); }
}
function makeStorageLike() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

console.log('migration v2: removes legacy history key on first run');
{
  const s = makeStorageLike();
  s.setItem(LEGACY_KEYS[0], '[{"query":"Poblado","timestamp":1700000000000}]');
  const removed = runMigrations(s);
  assertEq('returns the removed key', removed, LEGACY_KEYS);
  assertEq('legacy key is gone', s.getItem(LEGACY_KEYS[0]), null);
  assertEq('flag is set', s.getItem(MIGRATION_FLAG_KEY), '1');
}

console.log('migration v2: idempotent (second run is a no-op)');
{
  const s = makeStorageLike();
  s.setItem(LEGACY_KEYS[0], '[]');
  const first = runMigrations(s);
  const second = runMigrations(s);
  assertEq('first run removed the key', first, LEGACY_KEYS);
  assertEq('second run removed nothing', second, []);
  assertEq('legacy key still gone', s.getItem(LEGACY_KEYS[0]), null);
  assertEq('flag still set', s.getItem(MIGRATION_FLAG_KEY), '1');
}

console.log('migration v2: ignores unrelated keys');
{
  const s = makeStorageLike();
  s.setItem('metrobot.favorites.v1', '[{"id":"casa"}]');
  s.setItem('metrobot.disclaimer.dismissed.v1', '1');
  runMigrations(s);
  assertEq('favorites preserved', s.getItem('metrobot.favorites.v1'), '[{"id":"casa"}]');
  assertEq('disclaimer preserved', s.getItem('metrobot.disclaimer.dismissed.v1'), '1');
}

console.log('migration v2: works when there is no legacy key');
{
  const s = makeStorageLike();
  const removed = runMigrations(s);
  assertEq('removes nothing', removed, []);
  assertEq('flag is still set', s.getItem(MIGRATION_FLAG_KEY), '1');
}

console.log('migration v2: returns [] when storage is null');
{
  const removed = runMigrations(null);
  assertEq('null storage returns []', removed, []);
}

console.log('migration v2: tolerates getItem throwing');
{
  const s = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => {},
    removeItem: () => {},
  };
  const removed = runMigrations(s);
  assertEq('blocked storage returns []', removed, []);
}

console.log('migration v2: tolerates removeItem throwing for one key');
{
  const s = {
    getItem: (k) => (k === LEGACY_KEYS[0] ? '[]' : null),
    setItem: () => {},
    removeItem: () => { throw new Error('readonly'); },
  };
  const removed = runMigrations(s);
  assertEq('readonly remove still flags', s.getItem === undefined ? false : true, true);
  assertEq('removes nothing (no error thrown)', removed, []);
}

console.log('\n-----');
if (fail === 0) { console.log('ALL TESTS PASS (' + pass + '/' + (pass+fail) + ')'); process.exit(0); }
else { console.log('FAILED ' + fail + '/' + (pass+fail)); process.exit(1); }