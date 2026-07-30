import type { PropsWithChildren } from 'react';
import type { SheetPresentation } from '../lib/mobileSurface';

type MobileBottomSheetProps = PropsWithChildren<{
  presentation: SheetPresentation;
  title: string;
  onPresentationChange: (presentation: SheetPresentation) => void;
}>;

const sheetHeights: Record<SheetPresentation, string> = {
  compact: '112px',
  medium: 'min(68dvh, 640px)',
  expanded: 'calc(100dvh - env(safe-area-inset-top) - 12px)',
};

const nextPresentation: Record<SheetPresentation, SheetPresentation> = {
  compact: 'medium',
  medium: 'expanded',
  expanded: 'medium',
};

export function MobileBottomSheet({
  presentation,
  title,
  onPresentationChange,
  children,
}: MobileBottomSheetProps) {
  return (
    <section
      role="region"
      aria-labelledby="mobile-sheet-title"
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.12)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-[28rem] lg:rounded-none"
      style={{
        height: sheetHeights[presentation],
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
      }}
    >
      <button
        type="button"
        aria-label="Cambiar tamaño del panel"
        aria-expanded={presentation !== 'compact'}
        className="mx-auto flex min-h-12 min-w-12 items-center justify-center"
        onClick={() => onPresentationChange(nextPresentation[presentation])}
      >
        <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-slate-300" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <h2 id="mobile-sheet-title" className="text-lg font-semibold text-slate-950">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
