import { useId, useState } from 'react';
import type { TransferObservation } from '../../lib/transfers';

type Session = {
  sessionId: string;
  context: 'practice' | 'field';
  phase: 'unassigned' | 'baseline' | 'assisted';
  observations: TransferObservation[];
};

const button = 'min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2';
const select = 'my-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 disabled:opacity-50';
const choices = [
  ['unclear', 'No fue claro'],
  ['help-needed', 'Necesité ayuda'],
  ['useful', 'Me resultó útil'],
] as const;

export function TransferEvaluation({ catalogVersion }: { catalogVersion: 1 }) {
  const [session, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<TransferObservation['stage']>('connection');
  const descriptionId = useId();
  const categoriesId = useId();
  const observations = session?.observations ?? [];
  const locked = observations.length > 0;

  function participate(checked: boolean) {
    // Generate outside state updaters so StrictMode cannot create duplicate IDs.
    const next = checked ? {
      sessionId: crypto.randomUUID(),
      context: 'practice' as const,
      phase: 'unassigned' as const,
      observations: [],
    } : null;
    setSession(next);
    setStage('connection');
  }

  function record(kind: TransferObservation['kind']) {
    setSession(current => {
      if (!current || current.observations.some(item => item.stage === stage && item.kind === kind)) return current;
      return { ...current, observations: [...current.observations, { stage, kind }] };
    });
  }

  function clear() {
    if (!session || !locked) return;
    const sessionId = crypto.randomUUID();
    setSession(current => current ? { ...current, sessionId, observations: [] } : null);
  }

  function exportReport() {
    if (!session || !locked) return;
    const report = {
      schemaVersion: 2,
      pilot: 'san-antonio-a-b',
      sessionId: session.sessionId,
      catalogVersion,
      context: session.context,
      phase: session.phase,
      observations: session.observations,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'metrobot-conexiones-observaciones.json';
    try {
      anchor.click();
    } finally {
      // Let the download consume the URL; also release it if this panel closes.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  return <section aria-label="Evaluar esta experiencia · sesión local" className="space-y-3 border-t border-border pt-3">
    <h4 className="text-sm font-semibold">Evaluar esta experiencia · sesión local</h4>
    <p id={descriptionId} className="text-xs leading-relaxed text-muted-foreground">
      Participación voluntaria. Solo registra categorías elegidas; sin fotos, texto, GPS ni datos personales.
      No se transmite ni se guarda en el navegador. Se borra al cerrar el piloto o retirar el consentimiento,
      salvo las copias JSON que descargues. No es un reporte enviado al Metro ni una medición de congestión.
    </p>
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={session !== null} aria-describedby={descriptionId} onChange={event => participate(event.target.checked)} />
      Participar en la evaluación local
    </label>
    {session !== null ? <>
      <p id={categoriesId} className="text-xs leading-relaxed text-muted-foreground">
        El contexto de campo es declarado, no verificado. Las etiquetas referencia y asistida no infieren causalidad.
        Elige contexto y fase antes de registrar; quedan bloqueados hasta borrar las observaciones.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">Contexto
          <select className={select} value={session.context} disabled={locked} aria-describedby={categoriesId}
            onChange={event => {
              const context = event.target.value as Session['context'];
              setSession(current => current && current.observations.length === 0 ? { ...current, context } : current);
            }}>
            <option value="practice">Práctica</option>
            <option value="field">Campo · declarado, no verificado</option>
          </select>
        </label>
        <label className="block text-sm">Fase
          <select className={select} value={session.phase} disabled={locked} aria-describedby={categoriesId}
            onChange={event => {
              const phase = event.target.value as Session['phase'];
              setSession(current => current && current.observations.length === 0 ? { ...current, phase } : current);
            }}>
            <option value="unassigned">Sin asignar</option>
            <option value="baseline">Referencia · sin uso del asistente</option>
            <option value="assisted">Asistida · con uso del asistente</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">Momento evaluado
        <select className={select} value={stage} onChange={event => setStage(event.target.value as TransferObservation['stage'])}>
          <option value="connection">Comprender conexión</option>
          <option value="sign">Comprobar señal</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {choices.map(([kind, label]) => <button type="button" key={kind} className={button}
          disabled={observations.some(item => item.stage === stage && item.kind === kind)} onClick={() => record(kind)}>{label}</button>)}
      </div>
      <p className="text-xs text-muted-foreground">Cada respuesta se registra una vez por momento: máximo 6 pares únicos por sesión.</p>
    </> : null}
    <p role="status" className="text-xs">{observations.length} observaciones en esta sesión. No equivalen a personas diferentes.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button} disabled={!locked} onClick={exportReport}>Descargar observaciones JSON</button>
      <button type="button" className={button} disabled={!locked} onClick={clear}>Borrar observaciones</button>
    </div>
  </section>;
}
