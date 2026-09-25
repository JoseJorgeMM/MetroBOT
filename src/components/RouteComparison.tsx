import { useState } from 'react';
import { ArrowRight, SlidersHorizontal } from 'lucide-react';
import { rankRoutes, timeTradeoff, type RoutePriority } from '../lib/routeComparison';
import { RouteCard, type RouteCardProps } from './RouteCards/RouteCard';
import type { RouteOption } from '../lib/routing';

interface Props {
  routes: RouteOption[];
  activeRouteIndex: number;
  originName?: string;
  destName?: string;
  onSelect: (index: number) => void;
  onEdit: () => void;
  onStartNav: RouteCardProps['onStartNav'];
  navState: RouteCardProps['navState'];
}

export function RouteComparison({ routes, activeRouteIndex, originName, destName, onSelect, onEdit, onStartNav, navState }: Props) {
  const [priority, setPriority] = useState<RoutePriority>('duration');
  const ranked = rankRoutes(routes, priority);
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
          <select value={priority} onChange={event => setPriority(event.target.value as RoutePriority)} className="ml-auto min-h-11 min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-sitva-green">
            <option value="duration">Menor tiempo</option>
            <option value="cost">Menor costo</option>
            <option value="walking">Menos caminata</option>
            <option value="transfers">Menos transbordos</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400" role="status">{routes.length} {routes.length === 1 ? 'opción disponible' : 'opciones disponibles'} · Tiempos y costos estimados</p>
      </div>
      {ranked.map(({ route, index }) => (
        <RouteCard key={route.id} route={route} routeIndex={index} isSelected={activeRouteIndex === index}
          originName={originName} destName={destName} onSelect={() => onSelect(index)} onStartNav={onStartNav} navState={navState}
          extraMinutes={routes.length > 1 ? timeTradeoff(route, routes) : null} />
      ))}
    </div>
  );
}
