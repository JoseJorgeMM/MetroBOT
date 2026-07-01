// tests/_pwa_hooks_impl.mjs
// Pure logic for the PWA hooks. No DOM, no React.

export const DISMISS_KEY = 'metrobot.install.dismissed.v1';
export const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isDismissedRecently(storage, now) {
  if (!storage) return false;
  try {
    const raw = storage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return (now || Date.now()) - ts < DISMISS_DURATION_MS;
  } catch (e) {
    return false;
  }
}

export function markDismissed(storage, now) {
  if (!storage) return false;
  try {
    storage.setItem(DISMISS_KEY, String(now || Date.now()));
    return true;
  } catch (e) {
    return false;
  }
}

// Constructs the BeforeInstallPromptEvent-like shape we capture in the hook.
export function shouldOfferInstall(event, isStandalone, dismissed) {
  if (!event) return false;
  if (isStandalone) return false;
  if (dismissed) return false;
  return true;
}
