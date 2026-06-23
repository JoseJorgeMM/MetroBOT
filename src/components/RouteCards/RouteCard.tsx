import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { RouteOption } from '@/src/lib/routing';
import { Train, CableCar, TramFront, Bus, Bike, Footprints, Clock, DollarSign, ShieldCheck, ShieldAlert, Navigation2 } from 'lucide-react';
import { ShareButton } from '../ShareButton';

const ModeIcon = ({ mode, className }: { mode: string, className?: string }) => {
  switch (mode) {
    case 'metro': return <Train className={className} />;
    case 'metrocable': return <CableCar className={className} />;
    case 'tranvia': return <TramFront className={className} />;
    case 'metroplus': return <Bus className={className} />;
    case 'bus':
    case 'bus_articulado': return <Bus className={className} />;
    case 'encicla': return <Bike className={className} />;
    case 'walk': return <Footprints className={className} />;
    default: return <Footprints className={className} />;
  }
};

const ModeColor = (mode: string) => {
  switch (mode) {
    case 'metro': return 'text-sitva-green';
    case 'metrocable': return 'text-sitva-red';
    case 'tranvia': return 'text-sitva-green';
    case 'metroplus': return 'text-sitva-blue';
    case 'bus':
    case 'bus_articulado': return 'text-amber-600 dark:text-amber-500';
    case 'encicla': return 'text-encicla';
    case 'walk': return 'text-slate-400';
    default: return 'text-slate-400';
  }
};

const VehicleVisual = ({ mode }: { mode: string }) => {
  const baseClasses = "w-full h-24 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden";

  if (mode === 'metro') {
    return (
      <div className={baseClasses + ' bg-emerald-600'}>
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        <div className="flex flex-col items-center z-10">
          <Train className="w-12 h-12 text-white mb-1" />
          <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Sistema Metro</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20"></div>
      </div>
    );
  }

  if (mode === 'bus' || mode === 'bus_articulado' || mode === 'metroplus') {
    const isMetroplus = mode === 'metroplus';
    return (
      <div className={baseClasses + ' ' + (isMetroplus ? 'bg-blue-600' : 'bg-amber-500')}>
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,_white_25%,_transparent_25%,_transparent_50%,_white_50%,_white_75%,_transparent_75%,_transparent)] bg-[length:20px_20px]"></div>
        <div className="flex flex-col items-center z-10">
          <Bus className="w-12 h-12 text-white mb-1" />
          <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest">
            {isMetroplus ? 'Metroplus' : 'Bus Integrado'}
          </span>
        </div>
      </div>
    );
  }

  if (mode === 'metrocable') {
    return (
      <div className={baseClasses + ' bg-rose-600'}>
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/30 rotate-[-5deg]"></div>
        <div className="flex flex-col items-center z-10">
          <CableCar className="w-12 h-12 text-white mb-1" />
          <span className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Metrocable</span>
        </div>
      </div>
    );
  }

  return null;
};

export interface BusLegValidation {
  routeId: string;
  routeName: string;
  boardingStop: string;
  boardingLat: number;
  boardingLng: number;
  realStops: Array<{ name: string; lat: number; lng: number }>;
}

export interface RouteValidation {
  ok: boolean;
  validatedSteps: number;
  degradedSteps: number;
  busLegs: BusLegValidation[];
  degradedReasons: string[];
}

export interface RouteCardProps {
  route: RouteOption & { validation?: RouteValidation };
  isSelected?: boolean;
  originName?: string | null;
  destName?: string | null;
  onStartNav?: (route: RouteOption) => void;
  navState?: 'idle' | 'locating' | 'navigating' | 'at_station' | 'arrived' | null;
}

const RealStopsPanel = ({ leg }: { leg: BusLegValidation }) => {
  const [open, setOpen] = useState(false);
  const preview = leg.realStops.slice(0, 6);
  const more = Math.max(0, leg.realStops.length - preview.length);
  return (
    <div className="mt-2 ml-7 border-l-2 border-amber-300/60 pl-3 text-[11px] text-slate-500 dark:text-slate-400">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="min-h-[32px] font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer inline-flex items-center"
      >
        {open ? 'Ocultar paradas reales' : 'Ver paradas reales (' + leg.realStops.length + ')'}
      </button>
      {open && (
        <ol className="mt-1 space-y-0.5 list-decimal list-inside">
          {preview.map((s, i) => (
            <li key={i} className="truncate">{s.name}</li>
          ))}
          {more > 0 && <li className="italic">... y {more} mas</li>}
        </ol>
      )}
    </div>
  );
};

export function RouteCard({ route, isSelected, originName, destName, onStartNav, navState }: RouteCardProps) {
  const primaryMode = route.modes.find(m => m !== 'walk') || 'walk';
  const validation = route.validation;
  const hasBusLegs = (validation?.busLegs?.length ?? 0) > 0;
  const showValidatedBadge = hasBusLegs && validation?.ok;
  const showUnvalidatedBadge = hasBusLegs && !validation?.ok;
  const hasWalkSegment = (route.steps || []).some((s) => s && (s.mode === 'walk' || s.mode === 'encicla'));
  const navIsActive = navState === 'navigating' || navState === 'at_station' || navState === 'locating';
  const showStartNavButton = !!onStartNav && !navIsActive && hasWalkSegment;

  return (
    <Card className={'mb-3 sm:mb-4 overflow-hidden border-0 shadow-md ring-1 transition-all duration-200 ' + (isSelected ? 'ring-sitva-green ring-2 shadow-lg bg-emerald-50/30 dark:bg-emerald-950/10 transform scale-[1.02]' : 'ring-slate-200/50 dark:ring-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-card')}>
      <CardContent className="p-3.5 sm:p-4">
        <VehicleVisual mode={primaryMode} />

        <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <span className="text-2xl font-bold text-foreground">{route.duration} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">min</span></span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {showValidatedBadge && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                title="Cada bus integrado de esta ruta fue validado contra el catalogo oficial del Metro de Medellin."
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                validado
              </span>
            )}
            {showUnvalidatedBadge && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                title={'No pudimos verificar ' + (validation?.degradedSteps ?? 0) + ' tramo(s) de bus. Te recomendamos revisar el mapa antes de abordar.'}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                sin validar
              </span>
            )}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full min-h-[32px]">
              <DollarSign className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{route.cost.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-1">
          {route.modes.map((mode, index) => (
            <React.Fragment key={index}>
              <div className={'p-2 rounded-full bg-slate-50 dark:bg-slate-800/60 shrink-0 ' + ModeColor(mode)}>
                <ModeIcon mode={mode} className="w-5 h-5" />
              </div>
              {index < route.modes.length - 1 && (
                <div className="h-0.5 w-4 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="space-y-3 mt-3 pt-3 border-t border-border">
          {route.steps.map((step, index) => {
            const leg = validation?.busLegs?.find(l => l.routeId && step.line === l.routeName);
            return (
              <div key={index}>
                <div className="flex items-start space-x-3">
                  <div className={'mt-0.5 shrink-0 ' + ModeColor(step.mode)}>
                    <ModeIcon mode={step.mode} className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300 break-words">{step.instruction}</p>
                    {step.line && <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 break-words">{step.line}</p>}
                  </div>
                  <div className="flex flex-col items-end shrink-0 min-w-[64px]">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {step.cost !== undefined ? '$' + step.cost.toLocaleString('es-CO') : '$0'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{step.duration} min</span>
                  </div>
                </div>
                {leg && step.mode === 'bus_articulado' && <RealStopsPanel leg={leg} />}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          {showStartNavButton ? (
            <button
              type="button"
              onClick={() => onStartNav && onStartNav(route)}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full bg-sitva-green hover:bg-sitva-green/90 text-white text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-transform"
            >
              <Navigation2 className="w-5 h-5" />
              Iniciar navegacion
            </button>
          ) : navIsActive ? (
            <span className="inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
              <Navigation2 className="w-4 h-4" /> Navegacion activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              <Navigation2 className="w-4 h-4" /> Ruta sin tramos a pie
            </span>
          )}
          <ShareButton route={route} originName={originName} destName={destName} className="ml-auto" />
        </div>
      </CardContent>
    </Card>
  );
}
