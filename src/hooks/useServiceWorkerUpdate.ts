// useServiceWorkerUpdate.ts
// -----------------------------------------------------------------------------
// Listens to Workbox events to detect when a new service worker is waiting and
// exposes an applyUpdate() helper that activates it and reloads the page.
// In dev mode (or when workbox-window is unavailable) this hook is a no-op.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface WorkboxLike {
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  messageSkipWaiting: () => void;
  register: () => Promise<unknown>;
}

export interface UseServiceWorkerUpdateResult {
  hasUpdate: boolean;
  controlling: boolean;
  applyUpdate: () => void;
  enabled: boolean;
}

async function loadWorkbox(): Promise<{ new (url: string): WorkboxLike } | null> {
  if (typeof window === 'undefined') return null;
  try {
    const mod = await import('workbox-window');
    const W = (mod as unknown as { Workbox?: new (url: string) => WorkboxLike }).Workbox;
    return W || null;
  } catch {
    return null;
  }
}

export function useServiceWorkerUpdate(swUrl = '/sw.js'): UseServiceWorkerUpdateResult {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [controlling, setControlling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const wbRef = useRef<WorkboxLike | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined') return;
    if (!import.meta.env.PROD) {
      setEnabled(false);
      return;
    }
    if (!('serviceWorker' in navigator)) {
      setEnabled(false);
      return;
    }

    (async () => {
      const WB = await loadWorkbox();
      if (cancelled || !WB) return;
      const wb = new WB(swUrl);
      wbRef.current = wb;

      const onWaiting = () => setHasUpdate(true);
      const onControlling = () => setControlling(true);

      try {
        wb.addEventListener('waiting', onWaiting);
        wb.addEventListener('controlling', onControlling);
        await wb.register();
        if (!cancelled) setEnabled(true);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [swUrl]);

  const applyUpdate = useCallback(() => {
    const wb = wbRef.current;
    if (!wb) {
      if (typeof window !== 'undefined') window.location.reload();
      return;
    }
    try {
      wb.messageSkipWaiting();
    } catch {
      /* noop */
    }
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        try {
          window.location.reload();
        } catch {
          /* noop */
        }
      }, 250);
    }
  }, []);

  return useMemo(
    () => ({ hasUpdate, controlling, applyUpdate, enabled }),
    [hasUpdate, controlling, applyUpdate, enabled],
  );
}
