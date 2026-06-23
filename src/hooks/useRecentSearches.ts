// useRecentSearches.ts
// -----------------------------------------------------------------------------
// MRU list of recent search queries. Backed by localStorage under
// 'metrobot.history.v1'. Cap 10, dedup case-insensitive. Safe against quota
// errors, corrupt JSON, and SSR.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'metrobot.history.v1';
const CAP = 10;

export interface RecentEntry {
  query: string;
  timestamp: number;
  coords?: { lat: number; lng: number };
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function load(storage: Storage | null): RecentEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x) => x && typeof x.query === 'string' && typeof x.timestamp === 'number'
    );
  } catch {
    return [];
  }
}

function save(storage: Storage | null, list: RecentEntry[]): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function useRecentSearches() {
  const storageRef = useRef<Storage | null>(null);
  if (storageRef.current === null) storageRef.current = getStorage();
  const storage = storageRef.current;

  const [recents, setRecents] = useState<RecentEntry[]>(() => load(storage));

  useEffect(() => {
    setRecents(load(storage));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = useCallback(
    (query: string, opts?: { coords?: { lat: number; lng: number } }) => {
      const trimmed = (query || '').toString().trim();
      if (!trimmed) return recents;
      setRecents((prev) => {
        const without = prev.filter(
          (x) => x.query.toLowerCase() !== trimmed.toLowerCase(),
        );
        const next: RecentEntry[] = [
          { query: trimmed, timestamp: Date.now(), ...(opts?.coords ? { coords: opts.coords } : {}) },
          ...without,
        ].slice(0, CAP);
        return save(storage, next) ? next : without;
      });
      return recents;
    },
    [storage, recents],
  );

  return useMemo(() => ({ recents, push }), [recents, push]);
}
