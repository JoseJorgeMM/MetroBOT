// InstallBanner.tsx
// -----------------------------------------------------------------------------
// In-app install banner for the MetroBot PWA.
// -----------------------------------------------------------------------------

import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export function InstallBanner() {
  const { canInstall, promptInstall, dismiss, dismissed, isStandalone } = usePwaInstall();

  if (isStandalone) return null;
  if (!canInstall) return null;

  const onInstall = async () => {
    const ok = await promptInstall();
    if (!ok) {
      dismiss();
    }
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="install-banner"
          role="dialog"
          aria-label="Instalar MetroBot"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          data-testid="install-banner"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-3 right-3 lg:right-[29rem] z-[1200] pointer-events-none"
        >
          <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border/40 bg-white/95 dark:bg-slate-900/95 shadow-xl backdrop-blur-md p-3 sm:p-3.5 flex items-start gap-3">
            <img
              src="/icon-192.png"
              alt="MetroBot"
              width="44"
              height="44"
              className="w-11 h-11 rounded-xl shadow-sm bg-white object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                Instala MetroBot
              </div>
              <p className="text-[12px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                Acceso rapido desde tu pantalla de inicio y uso sin conexion con datos guardados.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onInstall}
                  aria-label="Instalar MetroBot"
                  className="inline-flex items-center gap-1.5 rounded-full bg-sitva-green hover:bg-sitva-green/90 text-white text-xs font-semibold px-3 min-h-[36px] shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Instalar
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-[12px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 min-h-[36px] cursor-pointer"
                >
                  Ahora no
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Cerrar"
              className="min-h-[32px] min-w-[32px] w-8 h-8 rounded-full text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
