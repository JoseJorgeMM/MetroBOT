import type { FareResult } from '../../lib/fares/types';
import { fareCatalog, formatCOP } from '../../lib/fares/config';

const labels: Record<string,string> = { METRO:'Metro', CABLE:'Metrocable', TRANVIA:'Tranvía', METROPLUS:'Metroplús', ALIMENTADOR:'Alimentador', BUS_INTEGRADO:'Bus integrado', MICRO_INTEGRADO:'Micro integrado', ENCICLA:'EnCicla', CABLE_ARVI:'Cable Arví', WALK:'A pie', TIPO_TRANSPORTE_NO_DETERMINADO:'Bus: categoría sin confirmar' };

export function FareBreakdown({ fare }: { fare: FareResult }) {
  return <section aria-label="Costo del viaje" className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h4 className="text-sm font-semibold">Costo total del viaje</h4>
      <p className="text-lg font-bold">{fare.total === null ? 'Tarifa no determinada' : formatCOP(fare.total)}</p>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">Perfil: {fareCatalog.perfiles_masivo[fare.profile]?.descripcion || fare.profile} · Tarifario {fare.version}</p>
    {fare.status === 'CONDICIONAL' && <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Condicionado a los horarios previstos y requisitos de integración.</p>}
    <details className="mt-2">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Ver desglose tarifario</summary>
      <ol className="space-y-3">{fare.breakdown.filter(row => row.mode !== 'WALK').map(row => <li key={row.index} className="border-l-2 border-emerald-500 pl-3">
        <div className="flex justify-between gap-2 text-sm"><span className="font-semibold">{labels[row.mode] || row.mode}</span><span className="shrink-0">{row.charge === null ? 'Por confirmar' : formatCOP(row.charge)}</span></div>
        <p className="text-xs text-muted-foreground">{row.description}</p>
      </li>)}</ol>
      {fare.total !== null && fare.withoutIntegration !== null && fare.savings !== null && fare.savings > 0 && <div className="mt-3 rounded-lg bg-background p-3 text-xs">
        <p>Sin integración: {formatCOP(fare.withoutIntegration)}</p>
        <p>Con integración: {formatCOP(fare.total)}</p>
        <p className="font-semibold text-emerald-700 dark:text-emerald-300">Ahorro: {formatCOP(fare.savings)}</p>
      </div>}
      {fare.warnings.length > 0 && <ul className="mt-3 space-y-1 text-xs text-amber-800 dark:text-amber-200">{fare.warnings.map(message => <li key={message}>{message}</li>)}</ul>}
      <p className="mt-3 text-xs text-muted-foreground">Fuente: configuración tarifaria de MetroBot. Los cobros efectivos dependen de la validación y el perfil habilitado.</p>
    </details>
  </section>;
}
