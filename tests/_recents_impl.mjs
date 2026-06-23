// tests/_recents_impl.mjs
// Mirror of useRecentSearches logic.

export const RECENTS_KEY = 'metrobot.history.v1';
export const RECENTS_CAP = 10;

function makeMemoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

export function loadRecents(storage) {
  const s = storage || makeMemoryStorage();
  try {
    const raw = s.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.query === 'string' && typeof x.timestamp === 'number');
  } catch (e) {
    return [];
  }
}

export function saveRecents(storage, list) {
  const s = storage || makeMemoryStorage();
  try {
    s.setItem(RECENTS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

export function pushRecent(storage, query, opts) {
  const trimmed = (query || '').toString().trim();
  if (!trimmed) return loadRecents(storage);
  const o = opts || {};
  const list = loadRecents(storage).filter((x) => x.query.toLowerCase() !== trimmed.toLowerCase());
  const next = [
    { query: trimmed, timestamp: Date.now(), ...(o.coords ? { coords: o.coords } : {}) },
    ...list
  ].slice(0, RECENTS_CAP);
  const saved = saveRecents(storage, next);
  return saved ? next : list;
}
