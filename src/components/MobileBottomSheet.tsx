import { useId, type CSSProperties, type PropsWithChildren } from 'react';
import type { SheetPresentation } from '../lib/mobileSurface';

type MobileBottomSheetProps = PropsWithChildren<{
  presentation: SheetPresentation;
  title: string;
  titleVisuallyHidden?: boolean;
  resizable?: boolean;
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
  expanded: 'compact',
};

export function nextSheetPresentation(presentation: SheetPresentation): SheetPresentation {
  return nextPresentation[presentation];
}

export function MobileBottomSheet({
  presentation,
  title,
  titleVisuallyHidden = false,
  resizable = true,
  onPresentationChange,
  children,
}: MobileBottomSheetProps) {
  const titleId = useId();

  return (
    <section
      role="region"
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-30 flex h-[var(--mobile-sheet-height)] flex-col overflow-hidden rounded-t-3xl bg-card text-foreground shadow-[0_-8px_24px_rgba(15,23,42,0.12)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-[28rem] lg:rounded-none"
      style={{
        '--mobile-sheet-height': sheetHeights[presentation],
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
      } as CSSProperties}
    >
      <button
        type="button"
        aria-label={resizable ? 'Cambiar tamaño del panel' : 'Tamaño del panel fijo'}
        aria-expanded={presentation !== 'compact'}
        disabled={!resizable}
        className="mx-auto flex min-h-12 min-w-12 items-center justify-center"
        onClick={() => onPresentationChange(nextSheetPresentation(presentation))}
      >
        <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
      </button>
      <div data-mobile-sheet-scroll-owner="true" className="mobile-sheet-scroll min-h-0 flex-1 overflow-y-auto px-4">
        <h2 id={titleId} className={titleVisuallyHidden ? 'sr-only' : 'text-lg font-semibold text-foreground'}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
