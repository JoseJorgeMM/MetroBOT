import { useId, useState } from 'react';
import type { RouteOption } from '../../lib/routing';
import { assessConnections, connectionRules } from '../../lib/journey/connectionRisk';

const minutes = (value: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);
const labels = { unknown: 'Margen sin evaluar', insufficient: 'Tiempo insuficiente', tight: 'Conexión ajustada', available: 'Margen programado disponible' };

export function ConnectionRiskPanel({ route }: { route: RouteOption }) {
  const [delay, setDelay] = useState(0);
  const inputId = useId();
  const connections = assessConnections(route, delay);
  if (!connections.length) return null;
  const attention = connections.filter(item => item.status === 'tight' || item.status === 'insufficient' || item.longWalk).length;
  const unknown = connections.filter(item => item.status === 'unknown').length;
  return <details className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
    <summary className="min-h-11 cursor-pointer text-sm font-semibold">
      Margen de transbordos
      <span className={`mt-1 block text-xs font-normal ${attention ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
        {attention ? `${attention} conexión(es) para revisar` : unknown ? 'Evaluación parcial: faltan horarios o tiempos de traslado' : 'Consulta los márgenes del itinerario'}
      </span>
    </summary>
    <p className="mt-2 text-xs text-muted-foreground">Calculado con el itinerario {route.source === 'google' ? 'de Google Maps' : 'local'}. No predice retrasos ni garantiza el transbordo.</p>
    <label htmlFor={inputId} className="mt-3 block text-sm font-medium">¿Y si llegas tarde a la conexión?</label>
    <select id={inputId} value={delay} onChange={event => setDelay(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-2 text-sm">
      <option value={0}>Sin retraso añadido</option>
      {[2, 5, 10].map(value => <option key={value} value={value}>Simular {value} min de retraso</option>)}
    </select>
    <p className="mt-1 text-xs text-muted-foreground">Escenario independiente en cada conexión; no simula la propagación del retraso.</p>
    <ol className="mt-3 space-y-3" aria-live="polite">
      {connections.map((item, index) => <li key={`${item.fromIndex}-${item.toIndex}`} className="rounded-lg border border-border bg-card p-3 text-sm">
        <p className="font-semibold">{index + 1}. {item.from} → {item.to}</p>
        <p className={`mt-1 font-medium ${item.status === 'tight' || item.status === 'insufficient' ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'}`}>{labels[item.status]}</p>
        <p className="mt-1 text-xs text-muted-foreground">Caminata de conexión: {item.walking === null ? 'sin determinar' : `${minutes(item.walking)} min`}.</p>
        {item.margin !== null && <p className="mt-1 text-xs">Margen tras caminar: {minutes(item.margin)} min{delay > 0 && <> · Con retraso: {minutes(item.adjustedMargin!)} min</>}.</p>}
        {item.longWalk && <p className="mt-1 text-xs">Caminata prolongada: revisa si este esfuerzo se ajusta a tus necesidades.</p>}
        {item.status === 'unknown' ? <p className="mt-1 text-xs">Faltan datos fiables para evaluar esta conexión; consulta el horario antes de viajar.</p>
          : item.status === 'insufficient' || item.status === 'tight' ? <p className="mt-1 text-xs">Compara una opción con más margen o confirma la siguiente salida.</p> : null}
      </li>)}
    </ol>
    <p className="mt-3 text-xs text-muted-foreground">Accesibilidad e interrupciones sin verificar. Si necesitas un recorrido sin escaleras, confirma los accesos y ascensores antes de elegir.</p>
    <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer py-2">Cómo se calcula</summary>
      <p>Salida siguiente − llegada anterior − caminata − retraso simulado. Menos de {connectionRules.tightBelowMinutes} min se marca como ajustado; desde {connectionRules.longWalkFromMinutes} min a pie se destaca la caminata. Son criterios orientativos de MetroBOT, no umbrales oficiales ni probabilidades. La caminata puede estar redondeada por el proveedor.</p>
    </details>
  </details>;
}
