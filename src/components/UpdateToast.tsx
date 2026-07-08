// UpdateToast.tsx
// -----------------------------------------------------------------------------
// Discreet bottom strip informing the user that a new SW build is available.
// We do NOT offer a "Recargar" button: the new SW applies silently on the
// next cold start, by design. The user can dismiss the toast for the current
// build; it will not reappear for the same build within 7 days.
// -----------------------------------------------------------------------------

import { ArrowUpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { useServiceWorkerUpdate } from '../hooks/useServiceWorkerUpdate';

export function UpdateToast() {
  const { hasUpdate, consumeUpdate, enabled } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!enabled) return null;
  if (dismissed) return null;
  if (!hasUpdate) return null;

  const onDismiss = () => {
    setDismissed(true);
    consumeUpdate();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="update-toast"
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        data-testid="update-toast"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 right-3 lg:right-[29rem] z-[1100] pointer-events-none"
      >
        <div className="pointer-events-auto mx-auto max-w-md rounded-full bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 shadow-lg border border-white/10 dark:border-slate-900/10 px-3.5 py-2 flex items-center gap-2.5 backdrop-blur-md">
          <ArrowUpCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm font-medium flex-1 min-w-0 truncate">
            Hay una version nueva. Se aplicara al reiniciar.
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar aviso de actualizacion"
            className="min-h-[28px] min-w-[28px] w-7 h-7 rounded-full text-white/70 hover:text-white dark:text-slate-700 dark:hover:text-slate-900 hover:bg-white/10 dark:hover:bg-slate-900/10 flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}