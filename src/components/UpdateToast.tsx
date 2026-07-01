// UpdateToast.tsx
// -----------------------------------------------------------------------------
// Top-center toast for service worker updates.
// -----------------------------------------------------------------------------

import { RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';

export function UpdateToast() {
  const { hasUpdate, applyUpdate, enabled, controlling } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!enabled) return null;
  if (dismissed) return null;
  if (!hasUpdate && !controlling) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="update-toast"
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        data-testid="update-toast"
        className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 -translate-x-1/2 z-[1300] pointer-events-none"
      >
        <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 rounded-full bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 shadow-xl px-3.5 py-2 sm:py-2.5 border border-white/10 dark:border-slate-900/10">
          <RefreshCw className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm font-medium">
            {controlling ? 'Actualizando MetroBot...' : 'Nueva version disponible'}
          </span>
          <button
            type="button"
            onClick={applyUpdate}
            className="text-xs sm:text-sm font-semibold rounded-full bg-sitva-green hover:bg-sitva-green/90 text-white px-2.5 min-h-[28px] cursor-pointer"
          >
            Recargar
          </button>
          {!controlling && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Cerrar aviso de actualizacion"
              className="min-h-[28px] min-w-[28px] w-7 h-7 rounded-full text-white/70 hover:text-white dark:text-slate-700 dark:hover:text-slate-900 hover:bg-white/10 dark:hover:bg-slate-900/10 flex items-center justify-center cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
