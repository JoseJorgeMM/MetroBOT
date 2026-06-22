import { useState } from 'react';
import { Locate, LocateFixed, Navigation, AlertCircle } from 'lucide-react';

type Phase = 'idle' | 'locating' | 'follow' | 'error';

interface LocateControlProps {
  /** Called when the user requests "follow me" mode. Should pan to position. */
  onRequestLocation: (onFirstFix: (pos: { lat: number; lng: number }) => void) => void;
  /** Hide on desktop; this is a mobile-first control. */
  hidden?: boolean;
}

/**
 * Floating blue "My Location" button with three visual states:
 *  - idle: grey icon (Locate)
 *  - locating: spinner-blue
 *  - follow: filled blue (LocateFixed), panning follows the user
 *  - error: red, permission/fix denied
 */
export function LocateControl({ onRequestLocation, hidden }: LocateControlProps) {
  const [phase, setPhase] = useState<Phase>('idle');

  if (hidden) return null;

  const handleClick = () => {
    if (phase === 'follow') {
      // Tap again → exit follow.
      setPhase('idle');
      return;
    }
    setPhase('locating');
    onRequestLocation((pos) => {
      // First fix arrived — switch to follow.
      setPhase('follow');
    });
    // If nothing happens in 12s, mark error.
    setTimeout(() => {
      setPhase(prev => (prev === 'locating' ? 'error' : prev));
    }, 12000);
  };

  const base =
    'w-11 h-11 flex items-center justify-center rounded-2xl shadow-lg border pointer-events-auto transition-all active:scale-95 cursor-pointer backdrop-blur-md';
  const styles: Record<Phase, string> = {
    idle: 'bg-card/90 border-border/40 text-slate-600 dark:text-slate-300 hover:bg-card',
    locating: 'bg-blue-500 border-blue-400 text-white animate-pulse',
    follow: 'bg-blue-500 border-blue-400 text-white',
    error: 'bg-red-500 border-red-400 text-white',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${base} ${styles[phase]}`}
      title={phase === 'error' ? 'No se pudo obtener tu ubicación. Revisa los permisos.' : 'Mi ubicación'}
      aria-label="Mi ubicación"
    >
      {phase === 'idle' && <Locate className="w-5 h-5" />}
      {phase === 'locating' && <Navigation className="w-5 h-5" />}
      {phase === 'follow' && <LocateFixed className="w-5 h-5" />}
      {phase === 'error' && <AlertCircle className="w-5 h-5" />}
    </button>
  );
}
