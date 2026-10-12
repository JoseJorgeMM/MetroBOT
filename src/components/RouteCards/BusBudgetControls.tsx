import type { RouteOption } from '../../lib/routing';
import { classifyRouteSegments, type FareEvidence } from '../../lib/fares/routeAdapter';
import { formatCOP } from '../../lib/fares/config';
import type { UrbanChoices } from '../../lib/fares/urbanFares';

export function BusBudgetControls({route,evidence,choices,onChange}:{route:RouteOption;evidence:FareEvidence;choices:UrbanChoices;onChange:(choices:UrbanChoices)=>void}) {
  const pending=classifyRouteSegments(route,evidence).map((segment,index)=>({segment,index}))
    .filter(({segment,index})=>segment.mode==='TIPO_TRANSPORTE_NO_DETERMINADO' && ['bus','bus_articulado'].includes(route.steps[index].mode));
  if(!pending.length || route.fare?.source==='google' || (route.fare?.total!=null && route.fare?.source!=='budget')) return null;
  const catalog=evidence.urbanFares;
  return <section aria-label="Completar presupuesto de buses" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
    <h4 className="font-semibold">Completa el presupuesto del bus</h4>
    <p className="mt-1 text-xs text-muted-foreground">Google no informó una tarifa completa. Sólo selecciona una opción si confirmas que es una ruta urbana de Medellín y pagarás ese bus por separado. No aplica a rutas rurales, intermunicipales ni servicios especiales.</p>
    {!catalog ? <p className="mt-2 text-xs">Tarifario urbano no disponible o pendiente de actualización. No se asignará un precio automáticamente.</p> : <>
      {pending.map(({index})=><label key={index} className="mt-3 block text-xs font-medium">Tramo {index+1} · {route.steps[index].line || 'Bus sin línea identificada'}
        <select value={choices[index] || ''} onChange={event=>onChange({...choices,[index]:event.target.value === 'bus' || event.target.value === 'micro' ? event.target.value : undefined})} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 text-foreground">
          <option value="">No puedo confirmar la categoría</option>
          <option value="bus">Bus/buseta urbano · {formatCOP(catalog.prices.bus)} · pago separado</option>
          <option value="micro">Microbús urbano · {formatCOP(catalog.prices.micro)} · pago separado</option>
        </select>
      </label>)}
      <a href={catalog.source} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs underline">Consultar fuente oficial · Alcaldía de Medellín {catalog.version}</a>
    </>}
  </section>;
}
