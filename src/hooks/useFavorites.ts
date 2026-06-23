// useFavorites.ts
// -----------------------------------------------------------------------------
// Persistent list of favorite places (work, home, gym, etc). Backed by
// localStorage under 'metrobot.favorites.v1'. Cap 50, MRU order, dedup by id.
// Safe against quota errors, corrupt JSON, and SSR (no window).
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'metrobot.favorites.v1';
const CAP = 50;

export interface FavoritePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Optional address line, e.g. "Kr 45 #12-34". */
  address?: string;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeParse(raw: string | null): FavoritePlace[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x) =>
        x &&
        typeof x.id === 'string' &&
        typeof x.name === 'string' &&
        typeof x.lat === 'number' &&
        typeof x.lng === 'number'
    );
  } catch {
    return [];
  }
}

function load(storage: Storage | null): FavoritePlace[] {
  if (!storage) return [];
  try {
    return safeParse(storage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function save(storage: Storage | null, list: FavoritePlace[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function useFavorites() {
  const storageRef = useRef<Storage | null>(null);
  if (storageRef.current === null) storageRef.current = getStorage();
  const storage = storageRef.current;

  const [favorites, setFavorites] = useState<FavoritePlace[]>(() => load(storage));

  useEffect(() => {
    // Re-sync if storage appeared (e.g. after SSR hydration).
    setFavorites(load(storage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useCallback((item: FavoritePlace): boolean => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.lat !== 'number' ||
      typeof item.lng !== 'number'
    ) {
      return false;
    }
    setFavorites((prev) => {
      const without = prev.filter((x) => x.id !== item.id);
      const next = [item, ...without].slice(0, CAP);
      return save(storage, next) ? next : without;
    });
    return true;
  }, [storage]);

  const remove = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((x) => x.id !== id);
      save(storage, next);
      return next;
    });
  }, [storage]);

  const has = useCallback((id: string) => favorites.some((x) => x.id === id), [favorites]);

  return useMemo(
    () => ({ favorites, add, remove, has }),
    [favorites, add, remove, has],
  );
}
