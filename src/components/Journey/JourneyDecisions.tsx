import { useMemo } from 'react';
import { ArrowRight, SlidersHorizontal, Route } from 'lucide-react';
import type { RouteOption } from '../../lib/routing';
import type { JourneyNeeds } from '../../lib/journey/types';
import { evaluateJourneys, serviceLabel } from '../../lib/journey/decisions';
import { walkingMinutes } from '../../lib/routeComparison';
import { formatCOP } from '../../lib/fares/config';
import { NeedsControls, priorityNames } from './NeedsControls';

const minutes=(value:number|null)=>value!==null&&Number.isFinite(value)&&value>=0?`${Math.round(value)} min`:'Sin dato';
export interface JourneyWhatIfProps {
  excludedService?: string;
  onExcludedServiceChange?: (service: string) => void;
  repeats?: number;
  onRepeatsChange?: (repeats: number) => void;
}

interface Props extends JourneyWhatIfProps {
  routes: RouteOption[];
  needs: JourneyNeeds;
  onNeedsChange: (needs: JourneyNeeds) => void;
  onSelect: (index: number) => void;
  activeRouteIndex: number;
}

export function JourneyDecisions({routes,needs,onNeedsChange,onSelect,activeRouteIndex,
  excludedService: excluded = '', onExcludedServiceChange: setExcluded = () => {},
  repeats = 1, onRepeatsChange: setRepeats = () => {},
}: Props) {
  const evaluation=useMemo(()=>evaluateJourneys(routes,needs,excluded),[routes,needs,excluded]);
  const chosen=evaluation.recommendedIndex===null?null:evaluation.options[evaluation.recommendedIndex];
  const total=chosen?.route.fare?.total??null;
  return <section aria-label="Decisiones para tu viaje" className="border-b border-border pb-5">
    <div className="rounded-2xl bg-emerald-950 p-4 text-white">
      <div className="flex items-center gap-2 text-emerald-200"><Route className="h-4 w-4" aria-hidden="true"/><span className="text-xs font-medium">{excluded?'Explorando un plan B':'Tu viaje, con tus condiciones'}</span></div>
      <h3 className="mt-2 text-xl font-bold tracking-tight">{chosen?`La opción ${chosen.index+1} encaja mejor`:'Hace falta ajustar el viaje'}</h3>
      <p className="mt-2 text-sm leading-relaxed text-emerald-100">{chosen
        ? `${priorityNames[needs.priority]}. ${needs.priority==='balanced'?'Comparamos tiempo, caminata y transbordos con la misma importancia.':'Entre las alternativas que cumplen los límites que elegiste.'}`
        : 'Ninguna opción tiene datos suficientes y cumple tus condiciones para recomendarla. Revisa los motivos y prueba otros límites.'}</p>
      {chosen && <>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3">
          <div><dt className="text-xs text-emerald-200">Viaje</dt><dd className="mt-1 font-bold">{minutes(chosen.route.duration)}</dd></div>
          <div><dt className="text-xs text-emerald-200">A pie</dt><dd className="mt-1 font-bold">{minutes(walkingMinutes(chosen.route))}</dd></div>
          <div><dt className="text-xs text-emerald-200">Tarifa</dt><dd className="mt-1 font-bold">{total===null?'Por confirmar':formatCOP(total)}</dd></div>
        </dl>
        {chosen.conditional && <p className="mt-3 text-xs text-amber-200">La tarifa depende de cumplir los horarios y condiciones de integración.</p>}
        {evaluation.tradeoff && <p className="mt-3 text-sm text-emerald-100">Frente a la más rápida que cumple tus límites: {evaluation.tradeoff}.</p>}
        <button type="button" onClick={()=>onSelect(chosen.index)} aria-label={`Ver opción recomendada ${chosen.index+1} en el mapa`} className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl bg-white px-3 text-sm font-semibold text-emerald-950">{chosen.index===activeRouteIndex?'Esta opción está en el mapa':'Ver esta opción en el mapa'}<ArrowRight className="h-4 w-4" aria-hidden="true"/></button>
      </>}
    </div>
    <details className="mt-3 rounded-xl border border-border p-3" open={undefined}>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold"><SlidersHorizontal className="mr-2 inline h-4 w-4" aria-hidden="true"/>¿Y si cambian mis condiciones?</summary>
      <div className="mt-3 space-y-4">
        <NeedsControls value={needs} onChange={onNeedsChange}/>
        <label className="block text-sm font-medium">Simular un viaje sin este servicio
          <select value={excluded} onChange={e=>setExcluded(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-2 text-base">
            <option value="">Usar todos los servicios</option>
            {evaluation.services.map(key=><option value={key} key={key}>{serviceLabel(key)}</option>)}
          </select>
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">Simulación sobre las {routes.length} alternativas encontradas. No indica una interrupción real ni busca nuevas rutas. Si ninguna sirve, cambia los puntos o vuelve a consultar.</p>
        <label className="block text-sm">¿Cuántas veces repetirás este mismo recorrido?
          <input type="number" min={1} max={100} value={repeats} onChange={e=>setRepeats(Math.max(1,Math.min(100,Math.round(e.target.valueAsNumber)||1)))} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base"/>
        </label>
        <p className="text-sm">{total===null?'La proyección de gasto necesita una tarifa conocida.':`Gasto proyectado: ${formatCOP(total*repeats)} por ${repeats} recorridos en este sentido.`}</p>
        {total!==null && <p className="text-xs text-muted-foreground">Manteniendo tarifa y perfil. La vuelta se calcula por separado.{chosen?.conditional?' Proyección condicional a la integración.':''}</p>}
      </div>
    </details>
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Por qué una opción encaja y otra no</summary>
      <ol className="space-y-3">{evaluation.options.map(option=><li key={option.route.id} className="border-l-2 border-border py-1 pl-3">
        <div className="flex items-center justify-between gap-2"><strong className="text-sm">Opción {option.index+1}</strong><button type="button" onClick={()=>onSelect(option.index)} className="min-h-11 px-2 text-xs font-semibold text-sitva-green dark:text-green-300">Ver en mapa</button></div>
        <p className="text-xs text-muted-foreground">{minutes(option.route.duration)} de viaje · {minutes(walkingMinutes(option.route))} a pie · {option.route.fare?.total==null?'Tarifa por confirmar':formatCOP(option.route.fare.total)}</p>
        <ul className="mt-2 space-y-1 text-xs">{[...option.violations,...option.unknowns].map(reason=><li key={reason} className="text-amber-800 dark:text-amber-200">{reason}</li>)}</ul>
        {option.eligible && <p className="mt-1 text-xs text-sitva-green dark:text-green-300">{option.conditional?'Cumple si se confirma la integración.':'Cumple los límites comprobables.'}{option.pareto?' Ninguna otra alternativa mejora todos sus indicadores a la vez.':''}</p>}
      </li>)}</ol>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Comparación calculada con tiempo, caminata, transbordos y tarifas disponibles. Se vuelve a calcular al cambiar las condiciones; no es una predicción de puntualidad.</p>
    </details>
  </section>;
}
