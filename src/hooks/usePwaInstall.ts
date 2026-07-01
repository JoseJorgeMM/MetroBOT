// usePwaInstall.ts
// -----------------------------------------------------------------------------
// Captures the BeforeInstallPromptEvent fired by the browser so we can show an
// in-app install banner. Persists a dismiss timestamp for 7 days so the banner
// is not annoying. All side effects are SSR-safe.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DISMISS_KEY,
  DISMISS_DURATION_MS,
  isDismissedRecently,
  markDismissed,
  shouldOfferInstall,
} from '../../tests/_pwa_hooks_impl.mjs';

interface BeforeInstallPromptEventLike extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
  } catch {
    /* noop */
  }
  const navAny = typeof navigator !== 'undefined' ? (navigator as unknown as { standalone?: boolean }) : null;
  return Boolean(navAny && navAny.standalone);
}

export interface UsePwaInstallResult {
  canInstall: boolean;
  promptInstall: () => Promise<boolean>;
  dismissed: boolean;
  isStandalone: boolean;
  dismiss: () => void;
  isSecureContext: boolean;
}

export function usePwaInstall(): UsePwaInstallResult {
  const storageRef = useRef<Storage | null>(null);
  if (storageRef.current === null) storageRef.current = getStorage();
  const storage = storageRef.current;

  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissedRecently(storage, Date.now()));
  const [event, setEvent] = useState<BeforeInstallPromptEventLike | null>(null);
  const [isSecureContext, setIsSecureContext] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsStandalone(detectStandalone());
    setIsSecureContext(Boolean((window as unknown as { isSecureContext?: boolean }).isSecureContext));
    try {
      setDismissed(isDismissedRecently(storage, Date.now()));
    } catch {
      /* noop */
    }

    const handler = (e: Event) => {
      try {
        e.preventDefault();
      } catch {
        /* noop */
      }
      setEvent(e as BeforeInstallPromptEventLike);
    };

    const installedHandler = () => {
      setEvent(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!event) return false;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setEvent(null);
      return choice && choice.outcome === 'accepted';
    } catch {
      setEvent(null);
      return false;
    }
  }, [event]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    markDismissed(storage, Date.now());
  }, [storage]);

  const canInstall = useMemo(
    () => shouldOfferInstall(event, isStandalone, dismissed),
    [event, isStandalone, dismissed],
  );

  return useMemo(
    () => ({
      canInstall,
      promptInstall,
      dismissed,
      dismiss,
      isStandalone,
      isSecureContext,
    }),
    [canInstall, promptInstall, dismissed, dismiss, isStandalone, isSecureContext],
  );
}

export const PWA_DISMISS_KEY = DISMISS_KEY;
export const PWA_DISMISS_DURATION_MS = DISMISS_DURATION_MS;
