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
  return createPortal(<dialog ref={dialog} aria-label={`Información de ${details.stop.name}`} onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-24px)] max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl backdrop:bg-slate-950/40">
    <button ref={closeButton} type="button" onClick={onClose} className="mb-2 flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100" aria-label="Cerrar información de estación">← Volver al mapa</button>
    <StationDetails {...details} />
    {children}
  </dialog>, document.body);
}
