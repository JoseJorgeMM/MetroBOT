import type { RouteOption, RouteStep } from './routing';

export type TransferObservation = {
  stage: 'connection' | 'sign';
  kind: 'unclear' | 'help-needed' | 'useful';
};

export type ObservationSummary = {
  total: number;
  byStage: Record<TransferObservation['stage'], Record<TransferObservation['kind'], number>>;
};

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim();
}

const messages = {
  compatible: 'El texto menciona la línea B y San Javier. No confirma tu ubicación ni el andén.',
  conflicting: 'El texto contiene líneas o destinos en conflicto. No permite confirmar la conexión.',
  unknown: 'El texto no permite comparar la señal con certeza. Puedes consultar al personal del Metro.',
} as const;

// A deliberately small vocabulary: extra prose is uncertainty, never an instruction.
const signWords = new Set(['linea', 'b', 'san', 'javier', 'direccion', 'hacia', 'sentido', 'metro']);

export function assessSign(text: string): { status: 'compatible' | 'conflicting' | 'unknown'; message: string } {
  const result = (status: keyof typeof messages) => ({ status, message: messages[status] });
  // Reject rather than truncate: an omitted suffix could contain a conflicting sign.
  if (text.length > 2000) return result('unknown');
  const normalized = normalize(text);
  const words: string[] = normalized.match(/[\p{L}\p{N}_]+/gu) ?? [];
  const hasPhrase = (first: string, second: string) => words.some((word, i) => word === first && words[i + 1] === second);
  if (words.some(word => /^[atjklhmop]$/.test(word))
    || words.some((word, i) => /^lineas?$/.test(word) && words[i + 1] !== undefined && words[i + 1] !== 'b')
    || words.includes('niquia') || hasPhrase('la', 'estrella') || hasPhrase('san', 'antonio')) {
    return result('conflicting');
  }
  if (!words.includes('b') || !hasPhrase('san', 'javier') || words.some(word => !signWords.has(word))) {
    return result('unknown');
  }
  return result('compatible');
}

// Exact identities from public/Estaciones_Sistema_Metro.csv, not journey prose.
const downstreamB = new Set(['cisneros', 'suramericana', 'estadio', 'floresta', 'santa lucia', 'san javier']);

function stationName(value: string | undefined, lines: readonly string[]): string {
  if (!value) return '';
  const normalized = normalize(value).replace(/^estacion /, '');
  const suffix = normalized.match(/ \(linea ([a-z0-9]+)\)$/);
  if (!suffix) return normalized;
  return lines.includes(suffix[1]) ? normalized.slice(0, -suffix[0].length) : '';
}

function isMetroLine(step: RouteStep, line: string): step is RouteStep & { transit: NonNullable<RouteStep['transit']> } {
  return step.mode === 'metro' && !!step.transit && normalize(step.line ?? '').replace(/^linea /, '') === line;
}

function isTransferWalk(step: RouteStep): boolean {
  if (!Number.isFinite(step.duration) || step.duration < 0) return false;
  const names = [step.station?.name, step.station?.nameRef, step.transit?.departureStop, step.transit?.arrivalStop];
  return names.every(name => name === undefined || stationName(name, ['a', 'b']) === 'san antonio');
}

/** Requires structured stops; local-router prose and station-only steps are insufficient. */
export function supportsSanAntonioTransfer(route: RouteOption): boolean {
  for (let i = 0; i < route.steps.length; i++) {
    const first = route.steps[i];
    if (!isMetroLine(first, 'a') || stationName(first.transit.arrivalStop, ['a']) !== 'san antonio') continue;
    let next = i + 1;
    let walkMinutes = 0;
    while (route.steps[next]?.mode === 'walk') {
      const walk = route.steps[next];
      // Three minutes is a conservative eligibility cap, not an indoor travel-time claim.
      if (!isTransferWalk(walk)) break;
      walkMinutes += walk.duration;
      if (walkMinutes > 3) break;
      next++;
    }
    const second = route.steps[next];
    if (!second || !isMetroLine(second, 'b') || stationName(second.transit.departureStop, ['b']) !== 'san antonio') continue;
    const { arrivalStop, headsign } = second.transit;
    const arrival = stationName(arrivalStop, ['b']);
    const direction = stationName(headsign, ['b']);
    // Available fields must agree; a valid headsign cannot override a contradictory stop.
    if (arrivalStop !== undefined && !downstreamB.has(arrival)) continue;
    if (headsign !== undefined && direction !== 'san javier') continue;
    if (direction === 'san javier' || downstreamB.has(arrival)) return true;
  }
  return false;
}

export function summarizeObservations(events: readonly TransferObservation[]): ObservationSummary {
  const summary: ObservationSummary = {
    total: events.length,
    byStage: { connection: { unclear: 0, 'help-needed': 0, useful: 0 }, sign: { unclear: 0, 'help-needed': 0, useful: 0 } },
  };
  for (const event of events) summary.byStage[event.stage][event.kind]++;
  return summary;
}
