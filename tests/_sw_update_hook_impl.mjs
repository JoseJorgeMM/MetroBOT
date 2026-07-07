// tests/_sw_update_hook_impl.mjs
// Pure mirror of the no-reload contract in useServiceWorkerUpdate.ts.

export function shouldApplyUpdate(revision, storage) {
  if (typeof revision !== 'string' || !revision) return false;
  if (!storage) return true;
  try {
    const raw = storage.getItem('metrobot.sw.update.applied.v1');
    if (!raw) return true;
    return raw !== revision;
  } catch {
    return true;
  }
}

export function markUpdateApplied(storage, revision) {
  if (!storage) return false;
  if (typeof revision !== 'string' || !revision) return false;
  try {
    storage.setItem('metrobot.sw.update.applied.v1', revision);
    return true;
  } catch {
    return false;
  }
}