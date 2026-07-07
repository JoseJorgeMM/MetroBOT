// src/lib/swUpdatePolicy.ts
// -----------------------------------------------------------------------------
// Pure helpers for the SW update visibility policy. Mirrors
// tests/_sw_update_policy_impl.mjs so the same logic is tested deterministically
// in Node and reused at runtime in the browser.
// -----------------------------------------------------------------------------

export const SW_UPDATE_SEEN_KEY = 'metrobot.sw.update.seen.v1';
export const SW_UPDATE_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function safeGet(storage: Storage | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(SW_UPDATE_SEEN_KEY);
  } catch {
    return null;
  }
}

export function getSeenUpdateRevision(storage: Storage | null): string | null {
  return safeGet(storage);
}

export function markUpdateSeen(
  storage: Storage | null,
  revision: string,
  now: number = Date.now(),
): boolean {
  if (!storage) return false;
  if (typeof revision !== 'string' || !revision) return false;
  try {
    storage.setItem(
      SW_UPDATE_SEEN_KEY,
      JSON.stringify({ revision, ts: now }),
    );
    return true;
  } catch {
    return false;
  }
}

export function shouldShowUpdateToast(
  storage: Storage | null,
  revision: string,
  now: number = Date.now(),
): boolean {
  if (!revision) return false;
  const seen = getSeenUpdateRevision(storage);
  if (!seen) return true;
  try {
    const parsed = JSON.parse(seen) as { revision?: string; ts?: number };
    if (
      parsed &&
      parsed.revision === revision &&
      typeof parsed.ts === 'number'
    ) {
      return now - parsed.ts >= SW_UPDATE_DISMISS_DURATION_MS;
    }
  } catch {
    return true;
  }
  return true;
}