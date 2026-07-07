// tests/_sw_update_policy_impl.mjs
// Pure logic for SW update visibility policy. No DOM, no React.

export const SW_UPDATE_SEEN_KEY = 'metrobot.sw.update.seen.v1';
export const SW_UPDATE_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getSeenUpdateRevision(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SW_UPDATE_SEEN_KEY);
    if (!raw) return null;
    return raw;
  } catch (e) {
    return null;
  }
}

export function markUpdateSeen(storage, revision, now) {
  if (!storage) return false;
  if (typeof revision !== 'string' || !revision) return false;
  try {
    const payload = JSON.stringify({ revision, ts: now || Date.now() });
    storage.setItem(SW_UPDATE_SEEN_KEY, payload);
    return true;
  } catch (e) {
    return false;
  }
}

export function shouldShowUpdateToast(storage, revision, now) {
  if (!revision) return false;
  const seen = getSeenUpdateRevision(storage);
  if (!seen) return true;
  try {
    const parsed = JSON.parse(seen);
    if (parsed && parsed.revision === revision && typeof parsed.ts === 'number') {
      return (now || Date.now()) - parsed.ts >= SW_UPDATE_DISMISS_DURATION_MS;
    }
  } catch (e) {
    return true;
  }
  return true;
}