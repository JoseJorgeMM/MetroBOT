import type { ReactNode } from 'react';
import { TrainFront } from 'lucide-react';
import { WeatherSummary } from './WeatherSummary';
import type { WeatherData } from '../lib/weather';
import type { SheetPresentation } from '../lib/mobileSurface';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileExploreActions } from './MobileExploreActions';

type MapSelectionMode = 'origin' | 'destination' | null;

interface MobileExploreSurfaceProps {
  mapSelectionMode: MapSelectionMode;
  hasAvailableRoutes: boolean;
  weather?: WeatherData | null;
  quickPicks: ReactNode;
  onPlanTrip: () => void;
  onAskMetroBot: () => void;
  onShowResults: () => void;
  onPresentationChange: (presentation: SheetPresentation) => void;
}

export function MobileExploreSurface({
  mapSelectionMode,
  hasAvailableRoutes,
  weather = null,
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
        className="safe-top pointer-events-none absolute left-3 right-[4.75rem] top-3 z-[1100] lg:bottom-0 lg:left-auto lg:right-0 lg:top-0 lg:w-[28rem] lg:bg-card lg:p-6"
      >
        <div className="pointer-events-auto max-h-[calc(100dvh-150px)] overflow-y-auto rounded-2xl border border-border/60 bg-card/95 p-3 shadow-lg backdrop-blur-md lg:max-h-full lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
          <div className="mb-4 flex items-center gap-2 border-b border-border pb-3 text-sm font-bold tracking-tight"><TrainFront className="h-5 w-5 text-sitva-green" aria-hidden="true" />MetroBOT<span className="ml-auto text-xs font-normal text-slate-500 dark:text-slate-400">Medellín y Valle de Aburrá</span></div>

          {mapSelectionMode ? (
            <p className="rounded-xl border border-sitva-blue/30 bg-sitva-blue/10 p-3 text-sm font-semibold text-foreground" role="status">
              Selecciona el {mapSelectionMode === 'origin' ? 'origen' : 'destino'} en el mapa.
            </p>
          ) : (
            <>
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">¿A dónde vas?</h1>
              <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Encuentra tu recorrido y elige entre tiempo, costo y menos caminata.</p>
              <MobileExploreActions layout="row" onPlanTrip={onPlanTrip} onAskMetroBot={onAskMetroBot} />
              {quickPicks}
              <WeatherSummary weather={weather} />
              {hasAvailableRoutes && (
                <button
                  type="button"
                  onClick={onShowResults}
                  className="mt-3 min-h-11 w-full rounded-xl border border-sitva-green px-4 text-sm font-bold text-sitva-green"
                >
                  Ver rutas encontradas
                </button>
              )}
              <div className="mt-8 hidden border-t border-border pt-5 lg:block">
                <h2 className="text-sm font-semibold">Un viaje a tu medida</h2>
                <ol className="mt-4 list-decimal space-y-4 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <li>Busca tu destino o elige un punto en el mapa.</li>
                  <li>Compara las opciones según lo que más te importa.</li>
                  <li>Revisa las paradas y sigue las indicaciones de tu ruta.</li>
                </ol>
                <p className="mt-6 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Las duraciones y tarifas son estimaciones. Revisa los tramos sin validar antes de abordar.</p>
              </div>
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
