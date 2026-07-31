import type { ReactNode } from 'react';
import { CloudRain } from 'lucide-react';
import type { SheetPresentation } from '../lib/mobileSurface';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileExploreActions } from './MobileExploreActions';

type MapSelectionMode = 'origin' | 'destination' | null;

interface MobileExploreSurfaceProps {
  mapSelectionMode: MapSelectionMode;
  hasAvailableRoutes: boolean;
  isRaining: boolean;
  quickPicks: ReactNode;
  onPlanTrip: () => void;
  onAskMetroBot: () => void;
  onShowResults: () => void;
  onPresentationChange: (presentation: SheetPresentation) => void;
}

export function MobileExploreSurface({
  mapSelectionMode,
  hasAvailableRoutes,
  isRaining,
  quickPicks,
  onPlanTrip,
  onAskMetroBot,
  onShowResults,
  onPresentationChange,
}: MobileExploreSurfaceProps) {
  return (
    <>
      <div
        data-mobile-explore-overlay="true"
        className="safe-top pointer-events-none absolute left-3 right-[4.75rem] top-3 z-[1100] lg:left-6 lg:right-auto lg:w-96"
      >
        <div className="pointer-events-auto rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur-md">
          {isRaining && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-sitva-blue/30 bg-sitva-blue/10 p-2.5" role="status">
              <CloudRain className="h-5 w-5 shrink-0 text-sitva-blue" aria-hidden="true" />
              <p className="text-xs leading-snug text-foreground">
                Llueve en Medellín. Los metrocables podrían operar con intermitencia.
              </p>
            </div>
          )}

          {mapSelectionMode ? (
            <p className="rounded-xl border border-sitva-blue/30 bg-sitva-blue/10 p-3 text-sm font-semibold text-foreground" role="status">
              Selecciona el {mapSelectionMode === 'origin' ? 'origen' : 'destino'} en el mapa.
            </p>
          ) : (
            <>
              <h1 className="mb-2 text-base font-bold text-foreground">¿A dónde vas?</h1>
              <MobileExploreActions layout="row" onPlanTrip={onPlanTrip} onAskMetroBot={onAskMetroBot} />
              {quickPicks}
              {hasAvailableRoutes && (
                <button
                  type="button"
                  onClick={onShowResults}
                  className="mt-3 min-h-11 w-full rounded-xl border border-sitva-green px-4 text-sm font-bold text-sitva-green"
                >
                  Ver rutas encontradas
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <MobileBottomSheet
        presentation="compact"
        title="MetroBot"
        onPresentationChange={onPresentationChange}
      >
        <p className="text-xs text-muted-foreground">Asistente SITVA disponible</p>
      </MobileBottomSheet>
    </>
  );
}
