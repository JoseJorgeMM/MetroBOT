import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { StationDetails } from './StationDetails';

/** Native modal escapes map panes and bottom sheets; keyboard focus stays inside. */
export function StationDialog({ onClose, children, ...details }: ComponentProps<typeof StationDetails> & { onClose: () => void; children?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => { closeButton.current?.focus(); }, [details.stop]);
  if (typeof document === 'undefined') return null;
  return createPortal(<dialog ref={dialog} aria-label={`Información de ${details.stop.name}`} onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-24px)] max-w-sm overflow-y-auto rounded-2xl border border-border bg-card p-4 text-foreground shadow-xl backdrop:bg-black/60">
    <button ref={closeButton} type="button" onClick={onClose} className="mb-2 flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar información de estación">← Volver al mapa</button>
    <StationDetails {...details} />
    {children}
  </dialog>, document.body);
}
