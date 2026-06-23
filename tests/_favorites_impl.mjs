// tests/_favorites_impl.mjs
// Mirror of useFavorites logic. Pure functions over a `storage` object so
// tests are deterministic. Defaults to a fake in-memory storage when no
// real localStorage is provided.

export const FAVORITES_KEY = 'metrobot.favorites.v1';
export const FAVORITES_CAP = 50;

function makeMemoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

export function loadFavorites(storage) {
  const s = storage || makeMemoryStorage();
  try {
    const raw = s.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x) => x && typeof x.id === 'string' && typeof x.name === 'string' &&
        typeof x.lat === 'number' && typeof x.lng === 'number'
    );
  } catch (e) {
    return [];
  }
}

export function saveFavorites(storage, list) {
  const s = storage || makeMemoryStorage();
  try {
    s.setItem(FAVORITES_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
}

export function addFavorite(storage, item) {
  if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' ||
      typeof item.lat !== 'number' || typeof item.lng !== 'number') {
    return loadFavorites(storage);
  }
  const list = loadFavorites(storage);
  const without = list.filter((x) => x.id !== item.id);
  const next = [item, ...without].slice(0, FAVORITES_CAP);
  const saved = saveFavorites(storage, next);
  return saved ? next : without;
}

export function removeFavorite(storage, id) {
  const list = loadFavorites(storage).filter((x) => x.id !== id);
  saveFavorites(storage, list);
  return list;
}

export function isFavorite(storage, id) {
  return loadFavorites(storage).some((x) => x.id === id);
}
