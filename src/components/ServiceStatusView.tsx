import { Activity, AlertTriangle, CircleHelp } from 'lucide-react';
import type { RouteOption } from '../lib/routing';
import { isFreshStatus, routeServiceLines, STATUS_SOURCE, type ServiceSnapshot } from '../lib/serviceStatus';

export function ServiceStatusView({ snapshot, route }: { snapshot: ServiceSnapshot | null; route?: Pick<RouteOption, 'steps'> }) {
  const fresh = isFreshStatus(snapshot);
  const coverage = route ? routeServiceLines(route) : null;
  const lines = fresh ? snapshot.lines.filter(line => !coverage || coverage.ids.includes(line.id)) : [];
  const alerts = lines.filter(line => line.status === 'warning' || line.status === 'suspended');
  const unknown = !fresh || lines.some(line => line.status === 'unknown');
  const title = alerts.length ? (route ? 'Novedades en líneas de este trayecto' : 'Novedades del Metro')
    : unknown ? 'Estado no verificado' : coverage && !coverage.ids.length ? 'Trayecto sin cobertura operativa' : 'Semáforo oficial de líneas';
  const rows = (items: typeof lines) => items.map(line => <li key={line.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-1.5">
    <span className="font-semibold">Línea {line.id}</span>
    <span className={line.status === 'suspended' || line.status === 'warning' ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}>
      {line.status === 'unknown' ? `Sin verificar · ${line.message}` : line.message}
    </span>
  </li>);
  return <section aria-label={route ? 'Estado operativo del trayecto' : 'Estado operativo del Metro'} className={`mt-3 rounded-xl border p-3 text-xs ${alerts.length ? 'border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20' : 'border-border bg-card'}`}>
    <div className="flex items-start gap-2" role="status">
      {alerts.length ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" /> : unknown ? <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Activity className="mt-0.5 h-4 w-4 shrink-0 text-sitva-green" aria-hidden="true" />}
      <div><h2 className="text-sm font-semibold">{route ? 'Estado del trayecto' : 'Estado del Sistema'}</h2><p className="mt-1 font-medium">{title}</p></div>
    </div>
    {alerts.length > 0 && <ul className="mt-2 divide-y divide-border/60">{rows(alerts)}</ul>}
    {!fresh && <p className="mt-2 text-muted-foreground">No hay una consulta vigente disponible. Esto no significa que el servicio opere normalmente.</p>}
    {coverage?.uncovered && <p className="mt-2 text-muted-foreground">Hay tramos sin cobertura: buses externos, EnCicla o líneas no identificadas.</p>}
    {fresh && lines.length > 0 && <details className="mt-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-sitva-blue">Ver estado de {coverage ? 'las líneas del trayecto' : 'las 12 líneas'} ▾</summary>
      <ul className="divide-y divide-border/60">{rows(lines)}</ul>
    </details>}
    <p className="mt-2 leading-relaxed text-muted-foreground">Reporte por línea: no identifica estaciones cerradas. La fuente no informa la hora de actualización.</p>
    {fresh && <p className="mt-2 text-muted-foreground">Consultado: {new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(snapshot.checkedAt))} · Colombia. Se consulta cada 5 min mientras usas la app.</p>}
    {route && alerts.length > 0 && <p className="mt-2 font-medium">Confirma antes de salir. Este reporte no predice el estado a la hora de tu viaje.</p>}
    <div className="mt-2 flex flex-wrap gap-x-4">
      <a href={STATUS_SOURCE} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-sitva-blue underline">Fuente: Metro de Medellín ↗</a>
      <a href="https://www.instagram.com/metrodemedellin/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-muted-foreground underline">Novedades en Instagram ↗</a>
    </div>
  </section>;
}
