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
    return null;
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
    <>
      <Banner dark={true}>
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
            {recalculating ? <TriangleAlert className="w-6 h-6 animate-pulse" /> : <Icon className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white leading-none">
                {cue ? formatDistance(cue.distanceToManeuver) : '—'}
              </span>
              <span className="text-[11px] text-slate-300">para la maniobra</span>
            </div>
            <div className="font-bold text-white text-base leading-snug truncate">
              {recalculating ? 'Recalculando ruta…' : (cue?.instruction || 'Continúa')}
            </div>
            {cue?.nextInstruction && !recalculating && (
              <div className="text-[11px] text-slate-400 truncate">Luego: {cue.nextInstruction}</div>
            )}
          </div>
        </div>
      </Banner>

      <BottomBar>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450 leading-none">
              {cue ? formatDuration(cue.eta) : '—'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ({cue ? formatDistance(cue.remainingDistance) : '—'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={nav.toggleMute}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-foreground hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-90 transition-all cursor-pointer"
              aria-label={nav.muted ? 'Activar voz' : 'Silenciar voz'}
            >
              {nav.muted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5 text-sitva-green" />}
            </button>
            <button
              onClick={nav.stop}
              className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-450 hover:bg-rose-200 active:scale-90 transition-all cursor-pointer"
              aria-label="Detener navegación"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </BottomBar>
    </>
  );
}

function Banner({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-[1000] safe-top pointer-events-auto">
      <div className={`mx-auto max-w-md m-2 ${dark ? 'bg-slate-900/95 dark:bg-slate-950/95 text-white' : 'bg-card/95 text-foreground'} backdrop-blur-md rounded-2xl shadow-xl border border-border/40 overflow-hidden`}>
        {children}
      </div>
    </div>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-4 left-0 right-0 z-[1000] safe-bottom pointer-events-auto px-4">
      <div className="mx-auto max-w-md bg-card/95 text-foreground backdrop-blur-md rounded-2xl shadow-xl border border-border/40 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
