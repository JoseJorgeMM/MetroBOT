import { ChevronUp, CornerDownLeft, CornerDownRight, CornerUpLeft, CornerUpRight, Flag, Merge, Navigation2, Radio, Volume2, VolumeX, X, CircleDot, TriangleAlert, Footprints } from 'lucide-react';
import type { NavigationContext } from '../../hooks/useNavigation';
import { formatDistance, formatDuration } from '../../lib/geo';

/** Pick a lucide icon for the upcoming maneuver. */
function maneuverIcon(cue: NavigationContext['cue']): typeof Navigation2 {
  if (!cue) return Navigation2;
  const txt = cue.instruction.toLowerCase();
  if (txt.includes('destino') || txt.includes('llega')) return Flag;
  if (txt.includes('glorieta')) return CircleDot;
  if (txt.includes('incorp')) return Merge;
  if (txt.includes('totalmente a la derecha') || txt.includes('sharp right')) return CornerUpRight;
  if (txt.includes('totalmente a la izquierda') || txt.includes('sharp left')) return CornerUpLeft;
  if (txt.includes('ligeramente a la derecha') || txt.includes('slight right')) return ChevronUp;
  if (txt.includes('ligeramente a la izquierda') || txt.includes('slight left')) return ChevronUp;
  if (txt.includes('derecha')) return CornerDownRight;
  if (txt.includes('izquierda')) return CornerDownLeft;
  if (txt.includes('recto') || txt.includes('contin')) return Navigation2;
  return Navigation2;
}

interface NavigationOverlayProps {
  nav: NavigationContext;
}

/**
 * Top navigation banner (Google-Maps style). Shows the upcoming maneuver with
 * distance, ETA, mute toggle and a stop button. While paused at a boarding
 * point it shows the "Sube al …" banner instead.
 */
export function NavigationOverlay({ nav }: NavigationOverlayProps) {
  if (nav.state === 'idle' || nav.state === 'arrived') {
    if (nav.state === 'arrived') {
      return (
        <Banner>
          <div className="flex items-center gap-3 px-4 py-3">
            <Flag className="w-7 h-7 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-foreground">Has llegado a tu destino</div>
              <div className="text-[12px] text-slate-600 dark:text-slate-300">Fin de la navegación</div>
            </div>
            <button onClick={nav.stop} className="px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-sm font-semibold text-foreground active:scale-95">Cerrar</button>
          </div>
        </Banner>
      );
    }
    if (nav.error) {
      return (
        <Banner>
          <div className="flex items-center gap-3 px-4 py-3" role="alert">
            <TriangleAlert className="w-6 h-6 text-amber-500 shrink-0" />
            <div className="flex-1 text-sm font-medium text-foreground">{nav.error}</div>
            <button onClick={nav.stop} className="px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-sm font-semibold text-foreground active:scale-95">Cerrar</button>
          </div>
        </Banner>
      );
    }
    return null;
  }

  if (nav.state === 'locating') {
    return (
      <Banner>
        <div className="flex items-center gap-3 px-4 py-3" role="status" aria-live="polite">
          <div className="w-8 h-8 border-4 border-sitva-green border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-foreground">Buscando tu ubicación</div>
            <div className="text-[12px] text-slate-600 dark:text-slate-300">Mantén el GPS activado y espera un momento.</div>
          </div>
          <button onClick={nav.stop} className="px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-sm font-semibold text-foreground active:scale-95">Cancelar</button>
        </div>
      </Banner>
    );
  }

  // Paused at a boarding point: tell the user what to board.
  if (nav.state === 'at_station') {
    return (
      <Banner>
        <div className="flex items-center gap-3 px-4 py-3">
          <Radio className="w-7 h-7 text-sitva-blue shrink-0 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-sitva-blue dark:text-sitva-blue/90 uppercase tracking-wider">Sube al transporte</div>
            <div className="font-bold text-foreground truncate">{nav.boardingLabel || 'Transporte'}</div>
            <div className="text-[12px] text-slate-600 dark:text-slate-300">Cuando estés a bordo, toca "Siguiente tramo".</div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <button onClick={nav.nextLeg} className="px-3 py-1.5 rounded-full bg-sitva-green text-white text-sm font-bold active:scale-95 flex items-center gap-1">
              <Footprints className="w-4 h-4" /> Siguiente tramo
            </button>
            <button onClick={nav.stop} className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-semibold text-foreground active:scale-95">Terminar</button>
          </div>
        </div>
      </Banner>
    );
  }

  // Active walking guidance.
  const Icon = maneuverIcon(nav.cue);
  const recalculating = nav.recalculating;
  const cue = nav.cue;

  return (
    <Banner>
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md">
            {recalculating ? <TriangleAlert className="w-6 h-6 animate-pulse" /> : <Icon className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-foreground leading-none">
                {cue ? formatDistance(cue.distanceToManeuver) : '—'}
              </span>
              <span className="text-[12px] text-slate-600 dark:text-slate-300">hasta el próximo paso</span>
            </div>
            <div className="font-semibold text-foreground truncate">
              {recalculating ? 'Recalculando ruta…' : (cue?.instruction || 'Continúa')}
            </div>
            {cue?.nextInstruction && !recalculating && (
              <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate">Luego: {cue.nextInstruction}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button onClick={nav.toggleMute} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-foreground active:scale-90" aria-label={nav.muted ? 'Activar voz' : 'Silenciar voz'}>
              {nav.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button onClick={nav.stop} className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-300 active:scale-90" aria-label="Detener navegación">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Tramo {nav.legIndex} de {nav.legCount}</span>
          {cue && <span>{formatDistance(cue.remainingDistance)} · {formatDuration(cue.eta)}</span>}
        </div>
      </div>
    </Banner>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] safe-top pointer-events-auto">
      <div className="mx-auto max-w-md m-2 bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border/40 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
