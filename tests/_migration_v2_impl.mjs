// tests/_migration_v2_impl.mjs
// Pure helpers for one-shot localStorage migrations. Mirrored from App.tsx
// boot logic so we can test it deterministically without React or a browser.

export const MIGRATION_FLAG_KEY = 'metrobot.migrated.v2';
export const LEGACY_KEYS = ['metrobot.history.v1'];

/**
 * Run pending migrations. Idempotent: if the flag is already set, the legacy
 * keys are left untouched. Returns the list of keys that were actually
 * removed on this run.
 */
export function runMigrations(storage, opts) {
  const flag = (opts && opts.flagKey) || MIGRATION_FLAG_KEY;
  const keys = (opts && opts.legacyKeys) || LEGACY_KEYS;
  if (!storage) return [];
  try {
    if (storage.getItem(flag) === '1') return [];
  } catch {
    return [];
  }
  const removed = [];
  for (const k of keys) {
    try {
      if (storage.getItem(k) !== null) {
        storage.removeItem(k);
        removed.push(k);
      }
    } catch {
      /* ignore */
    }
  }
  try {
    storage.setItem(flag, '1');
  } catch {
    /* ignore quota */
  }
  return removed;
}