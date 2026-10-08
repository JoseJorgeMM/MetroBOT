import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, SlidersHorizontal } from 'lucide-react';
import { rankRoutes, timeTradeoff } from '../lib/routeComparison';
import { RouteCard, type RouteCardProps } from './RouteCards/RouteCard';
import type { RouteOption } from '../lib/routing';
import { fareCatalog, fareConfig } from '../lib/fares/config';
import { priceRoute, traceFare, type FareEvidence } from '../lib/fares/routeAdapter';
import type { FareProfile } from '../lib/fares/types';
import { getStations } from '../lib/stations';
import { loadIntegratedRoutes } from '../lib/integratedRoutes';
import { JourneyDecisions, type JourneyWhatIfProps } from './Journey/JourneyDecisions';
import type { JourneyNeeds, JourneyPriority } from '../lib/journey/types';
import { TransferCompanion } from './Journey/TransferCompanion';
import { supportsSanAntonioTransfer } from '../lib/transfers';

interface Props extends JourneyWhatIfProps {
  profile?: FareProfile;
  onProfileChange?: (profile: FareProfile) => void;
  routes: RouteOption[];
  activeRouteIndex: number;
  originName?: string;
  destName?: string;
  onSelect: (index: number) => void;
  onEdit: () => void;
  onStartNav: RouteCardProps['onStartNav'];
  navState: RouteCardProps['navState'];
  needs: JourneyNeeds;
  onNeedsChange: (needs:JourneyNeeds)=>void;
}

export function RouteComparison({ routes, activeRouteIndex, originName, destName, onSelect, onEdit, onStartNav, navState, needs, onNeedsChange,
  profile = fareConfig.defaultProfile, onProfileChange: setProfile = () => {},
  excludedService, onExcludedServiceChange, repeats, onRepeatsChange,
}: Props) {
  const [evidence, setEvidence] = useState<FareEvidence>({});
  useEffect(() => {
    let active = true;
    if (routes.some(route => route.steps.some(step => step.mode === 'bus' || step.mode === 'bus_articulado'))) {
      Promise.all([getStations(), loadIntegratedRoutes()]).then(([stations, catalog]) => { if (active) setEvidence({stations, routes:catalog}); });
    }
    return () => { active = false; };
  }, [routes]);
  const pricedRoutes = useMemo(() => routes.map(route => priceRoute(route, profile, evidence)), [routes, profile, evidence]);
  useEffect(() => { pricedRoutes.forEach(route => traceFare(route, import.meta.env.DEV && import.meta.env.VITE_FARE_DEBUG === 'true')); }, [pricedRoutes]);
  const ranked = rankRoutes(pricedRoutes, needs.priority==='balanced'?'duration':needs.priority);
  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold tracking-tight">Elige cómo viajar</h3>
          <button type="button" onClick={onEdit} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-sitva-green hover:bg-sitva-green/10">Editar viaje</button>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{originName?.split(',')[0] || 'Origen'}</span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{destName?.split(',')[0] || 'Destino'}</span>
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Priorizar
          <select value={needs.priority} onChange={event => onNeedsChange({...needs,priority:event.target.value as JourneyPriority})} className="ml-auto min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-sitva-green">
            <option value="balanced">Equilibrar viaje</option>
            <option value="duration">Menor tiempo</option>
            <option value="cost">Menor costo</option>
            <option value="walking">Menos caminata</option>
            <option value="transfers">Menos transbordos</option>
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">Perfil tarifario
          <select value={profile.id} onChange={event => setProfile({...profile,id:event.target.value,payment:event.target.value === 'bancarizado' ? 'bank' : 'civica'})} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
            {Object.entries(fareCatalog.perfiles_masivo).map(([id, value]) => <option key={id} value={id}>{value.descripcion}</option>)}
          </select>
        </label>
        {routes.some(route => route.steps.some(step => step.mode === 'metrocable')) && <label className="mt-3 block text-sm">Si usas Cable Arví
          <select value={profile.arviCategory || ''} onChange={event => setProfile({...profile,arviCategory:event.target.value || undefined})} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3">
            <option value="">Categoría sin confirmar</option>
            <option value="estratos_1_2_3">Estratos 1, 2 y 3</option><option value="nacionales_o_personalizados">Nacional o personalizado</option><option value="extranjeros_o_general">Extranjero o general</option>
          </select>
        </label>}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" role="status">{routes.length} {routes.length === 1 ? 'opción disponible' : 'opciones disponibles'} · Tiempos estimados; consulta condiciones de tarifa</p>
      </div>
      <JourneyDecisions routes={pricedRoutes} needs={needs} onNeedsChange={onNeedsChange} onSelect={onSelect} activeRouteIndex={activeRouteIndex}
        excludedService={excludedService} onExcludedServiceChange={onExcludedServiceChange}
        repeats={repeats} onRepeatsChange={onRepeatsChange}/>
      {pricedRoutes[activeRouteIndex] && supportsSanAntonioTransfer(pricedRoutes[activeRouteIndex]) && <TransferCompanion key={pricedRoutes[activeRouteIndex].id}/>}
      {ranked.map(({ route, index }) => (
        <RouteCard key={route.id} route={route} routeIndex={index} isSelected={activeRouteIndex === index}
          originName={originName} destName={destName} onSelect={() => onSelect(index)} onStartNav={onStartNav} navState={navState}
          extraMinutes={routes.length > 1 ? timeTradeoff(route, routes) : null} />
      ))}
    </div>
  );
}
