// useServiceWorkerUpdate.ts
// -----------------------------------------------------------------------------
// Listens for new service workers and lets the user dismiss the update notice.
// We intentionally DO NOT call window.location.reload() anywhere: the new SW
// activates via messageSkipWaiting() and applies silently on the next cold
// start. This is the fix for the Safari iOS mid-session reload bug.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getSeenUpdateRevision,
  markUpdateSeen,
  shouldShowUpdateToast,
} from '../lib/swUpdatePolicy';

interface WorkboxLike {
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  messageSkipWaiting: () => void;
  register: () => Promise<unknown>;
}

export interface UseServiceWorkerUpdateResult {
  hasUpdate: boolean;
  controlling: boolean;
  applyUpdate: () => void;
  consumeUpdate: () => void;
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

function currentBuildRevision(): string {
  // Vite injects this at build time. Default 'dev' so the policy still works
  // in dev where the plugin does not generate a real sw.js.
  try {
    return (import.meta as unknown as { env: { VITE_BUILD_ID?: string } }).env.VITE_BUILD_ID || 'dev';
  } catch {
    return 'dev';
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

      const revision = currentBuildRevision();
      const storage = (() => {
        try { return window.localStorage; } catch { return null; }
      })();

      const onWaiting = () => {
        if (shouldShowUpdateToast(storage, revision)) {
          setHasUpdate(true);
        } else {
          // Already seen recently. Apply silently without bothering the user.
          try { wb.messageSkipWaiting(); } catch { /* noop */ }
        }
      };
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
    if (!wb) return;
    try {
      wb.messageSkipWaiting();
    } catch {
      /* noop */
    }
    setControlling(true);
    // No window.location.reload() here, by design. The next navigation or
    // cold start picks up the new SW.
  }, []);

  const consumeUpdate = useCallback(() => {
    const storage = (() => {
      try { return window.localStorage; } catch { return null; }
    })();
    markUpdateSeen(storage, currentBuildRevision());
    setHasUpdate(false);
  }, []);

  return useMemo(
    () => ({ hasUpdate, controlling, applyUpdate, consumeUpdate, enabled }),
    [hasUpdate, controlling, applyUpdate, consumeUpdate, enabled],
  );
}