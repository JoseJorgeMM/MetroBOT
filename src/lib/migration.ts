// src/lib/migration.ts
// -----------------------------------------------------------------------------
// One-shot localStorage migrations, idempotent and safe against blocked storage
// (private mode, quota errors, SSR). Each migration bumps the flag key so it
// only runs once per browser.
// -----------------------------------------------------------------------------

export const MIGRATION_FLAG_KEY = 'metrobot.migrated.v2';

/** Storage keys that are no longer used and should be removed on first run. */
export const LEGACY_KEYS: readonly string[] = ['metrobot.history.v1'];

export interface RunMigrationsOptions {
  /** Override the flag key (used by tests). */
  flagKey?: string;
  /** Override the list of legacy keys (used by tests). */
  legacyKeys?: readonly string[];
}

/**
 * Run pending migrations. Returns the list of keys that were actually
 * removed on this invocation. A second call (with the flag already set)
 * is a no-op and returns `[]`.
 */
export function runMigrations(
  storage: Storage | null,
  opts: RunMigrationsOptions = {},
): string[] {
  const flag = opts.flagKey ?? MIGRATION_FLAG_KEY;
  const keys = opts.legacyKeys ?? LEGACY_KEYS;
  if (!storage) return [];
  try {
    if (storage.getItem(flag) === '1') return [];
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const k of keys) {
    try {
      if (storage.getItem(k) !== null) {
        storage.removeItem(k);
        removed.push(k);
      }
    } catch {
      /* ignore: storage may be readonly or blocked */
    }
  }
  try {
    storage.setItem(flag, '1');
  } catch {
    /* ignore quota */
  }
  return removed;
}