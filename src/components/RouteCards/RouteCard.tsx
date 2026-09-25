import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { RouteOption } from '@/src/lib/routing';
import { Train, CableCar, TramFront, Bus, Bike, Footprints, Clock, DollarSign, ShieldCheck, ShieldAlert, Navigation2, MapPin } from 'lucide-react';
import { ShareButton } from '../ShareButton';
import { walkingMinutes as getWalkingMinutes } from '../../lib/routeComparison';
import { googleDirectionsUrl } from '../../lib/googleTransit';

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
    default: return <Train className={className} />;
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

const ModeLabel = (mode: string) => {
  switch (mode) {
    case 'metro': return 'Metro';
    case 'metrocable': return 'Metrocable';
    case 'tranvia': return 'Tranvía';
    case 'metroplus': return 'Metroplús';
    case 'bus':
    case 'bus_articulado': return 'Bus';
    case 'encicla': return 'EnCicla';
    case 'walk': return 'A pie';
    default: return 'Transporte público';
  }
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
  routeIndex?: number;
  extraMinutes?: number | null;
  onSelect?: (route: RouteOption) => void;
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
          {more > 0 && <li className="italic">... y {more} más</li>}
        </ol>
      )}
    </div>
  );
};

export function RouteCard({ route, isSelected, originName, destName, routeIndex = 0, extraMinutes, onSelect, onStartNav, navState }: RouteCardProps) {
  const steps = Array.isArray(route.steps) ? route.steps : [];
  const modes = Array.isArray(route.modes) ? route.modes : [];
  const validation = route.validation;
  const hasBusLegs = (validation?.busLegs?.length ?? 0) > 0;
  const showValidatedBadge = hasBusLegs && validation?.ok;
  const showUnvalidatedBadge = hasBusLegs && !validation?.ok;
  const hasWalkSegment = steps.some((step) => step.mode === 'walk' || step.mode === 'encicla') || modes.includes('walk') || modes.includes('encicla');
  const navIsActive = navState === 'navigating' || navState === 'at_station' || navState === 'locating';
  const showStartNavButton = !!onStartNav && !navIsActive && hasWalkSegment;
  const walkingMinutes = getWalkingMinutes(route);
  const hasKnownWalkingDuration = walkingMinutes !== null;
  const modeSummary = modes.map(ModeLabel).join(', ') || 'transporte público';
  const selectionLabel = `Seleccionar Ruta ${routeIndex + 1}: ${route.duration} minutos por ${modeSummary}`;
  const googleUrl = route.source === 'google' && route.userOrigin && route.userDest ? googleDirectionsUrl(route.userOrigin, route.userDest) : null;
  const formatTime = (value?: string) => value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(value)) : 'Hora no disponible';

  return (
    <Card className={'mb-3 sm:mb-4 overflow-hidden border-0 shadow-sm ring-1 transition-colors duration-200 ' + (isSelected ? 'ring-sitva-green ring-2 bg-emerald-50/30 dark:bg-emerald-950/10' : 'ring-slate-200/70 dark:ring-slate-800/80 bg-card')}>
      <CardContent className="p-3.5 sm:p-4">
        {route.source && <p className="mb-2 text-xs text-muted-foreground" translate="no">{route.source === 'google' ? 'Google Maps' : 'Respaldo local · SITVA'}</p>}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span className="text-slate-500 dark:text-slate-400">OPCIÓN {routeIndex + 1}{isSelected ? ' · EN EL MAPA' : ''}</span>
          {extraMinutes != null && <span className="text-sitva-green">{extraMinutes === 0 ? 'Menor tiempo estimado' : `+${extraMinutes} min frente a la más rápida`}</span>}
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <span className="text-2xl font-bold text-foreground">{route.duration} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">min</span></span>
          </div>
          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(route)}
              aria-label={selectionLabel}
              aria-pressed={isSelected}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-sitva-green hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sitva-green dark:hover:bg-emerald-950/30"
            >
              <MapPin className="w-4 h-4" />
              {isSelected ? 'En el mapa' : 'Ver en el mapa'}
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5 flex-wrap justify-between">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {showValidatedBadge && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                title="Cada bus integrado de esta ruta fue validado contra el catálogo oficial del Metro de Medellín."
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
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{route.fareText || (Number.isFinite(route.cost) && route.cost >= 0 ? `${route.cost.toLocaleString('es-CO')} COP est.` : 'Costo sin confirmar')}</span>
            </div>
          </div>
        </div>

        <ul className="mt-3 flex items-center space-x-2 overflow-x-auto pb-1" aria-label="Modos de transporte">
          {modes.map((mode, index) => (
            <li key={index} className="flex items-center space-x-2 shrink-0">
              <div className={'p-2 rounded-full bg-slate-50 dark:bg-slate-800/60 shrink-0 ' + ModeColor(mode)}>
                <ModeIcon mode={mode} className="w-5 h-5" />
                <span className="sr-only">{ModeLabel(mode)}</span>
              </div>
              {index < modes.length - 1 && (
                <span aria-hidden="true" className="h-0.5 w-4 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
              )}
            </li>
          ))}
        </ul>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>{route.transfers === 0 ? 'Sin transbordos' : `${route.transfers} ${route.transfers === 1 ? 'transbordo' : 'transbordos'}`}</span>
          <span>{hasKnownWalkingDuration ? `${walkingMinutes} min a pie` : hasWalkSegment ? 'Incluye tramo a pie' : 'Sin tramos a pie'}</span>
        </div>

        <details className="mt-3 border-t border-border" open={isSelected || undefined}>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-foreground">Trayecto paso a paso · {steps.length} tramos</summary>
          <div className="space-y-3 border-l-2 border-border pl-3">
          {steps.map((step, index) => {
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
                    {step.transit && <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                      <p>Sube: {step.transit.departureStop || 'Parada no informada'} · {formatTime(step.transit.departureTime)}</p>
                      <p>Baja: {step.transit.arrivalStop || 'Parada no informada'} · {formatTime(step.transit.arrivalTime)}</p>
                      {step.transit.stopCount != null && <p>{step.transit.stopCount} paradas · {step.transit.vehicleName || ModeLabel(step.mode)}</p>}
                      {step.transit.agencies.map((agency, i) => <p key={i}>{/^https?:\/\//.test(agency.uri || '') ? <a className="underline" href={agency.uri} target="_blank" rel="noreferrer">{agency.name}</a> : agency.name}</p>)}
                    </div>}
                  </div>
                  <div className="flex flex-col items-end shrink-0 min-w-[64px]">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {step.cost !== undefined && Number.isFinite(step.cost) ? '$' + step.cost.toLocaleString('es-CO') : step.mode === 'walk' ? 'A pie' : 'Sin tarifa'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{step.duration >= 0 ? `${step.duration} min` : 'Sin estimación'}</span>
                  </div>
                </div>
                {leg && step.mode === 'bus_articulado' && <RealStopsPanel leg={leg} />}
              </div>
            );
          })}
          </div>
        </details>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          {googleUrl ? <a href={googleUrl} target="_blank" rel="noreferrer" className="min-h-11 rounded-full bg-sitva-green px-4 py-3 text-sm font-bold text-white">Continuar en Google Maps ↗</a> : showStartNavButton ? (
            <button
              type="button"
              onClick={() => onStartNav && onStartNav(route)}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-full bg-sitva-green hover:bg-sitva-green/90 text-white text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-transform"
            >
              <Navigation2 className="w-5 h-5" />
              Iniciar navegación
            </button>
          ) : navIsActive ? (
            <span className="inline-flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-bold">
              <Navigation2 className="w-4 h-4" /> Navegación activa
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
