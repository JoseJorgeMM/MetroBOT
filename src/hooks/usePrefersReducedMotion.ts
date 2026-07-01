// usePrefersReducedMotion.ts
// -----------------------------------------------------------------------------
// Live subscription to the prefers-reduced-motion media query. SSR-safe.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { matchesReducedMotion } from '../../tests/_reduced_motion_impl.mjs';

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(matchesReducedMotion(mq));
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches === true);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    const legacy = mq as unknown as { addListener?: (cb: (e: MediaQueryListEvent) => void) => void; removeListener?: (cb: (e: MediaQueryListEvent) => void) => void };
    if (typeof legacy.addListener === 'function') {
      legacy.addListener(handler);
      return () => { if (typeof legacy.removeListener === 'function') legacy.removeListener(handler); };
    }
    return;
  }, []);
  return reduced;
}
