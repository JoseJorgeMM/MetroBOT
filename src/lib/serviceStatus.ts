import type { RouteOption } from './routing';

export const LINE_IDS = ['A', 'B', 'H', 'J', 'K', 'L', 'M', 'P', 'T', 'O', '1', '2'] as const;
export const STATUS_TTL = 300_000;
export const STATUS_SOURCE = 'https://www.metrodemedellin.gov.co/';
export type ServiceLevel = 'normal' | 'warning' | 'suspended' | 'unknown';
export interface ServiceSnapshot {
  availability: 'available' | 'unavailable';
  checkedAt: string;
  expiresAt: string;
  sourceUpdatedAt: null;
  lines: Array<{ id: string; status: ServiceLevel; message: string }>;
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function unavailableStatus(now = Date.now()): ServiceSnapshot {
  return { availability: 'unavailable', checkedAt: new Date(now).toISOString(), expiresAt: new Date(now).toISOString(), sourceUpdatedAt: null,
    lines: LINE_IDS.map(id => ({ id, status: 'unknown', message: 'Estado no verificado' })) };
}

/** Website feed, NOT a station incident feed. Fail closed when its schema changes. */
export function parseServiceStatus(payload: unknown, now = Date.now()): ServiceSnapshot {
  if (!record(payload) || payload.ok !== true || !record(payload.data)) throw Error('INVALID_STATUS');
  const { semaforos, estados } = payload.data;
  if (!Array.isArray(semaforos) || !semaforos.length || semaforos.length > 100 || !Array.isArray(estados) || !estados.length || estados.length > 100) throw Error('INVALID_STATUS');
  const lines = LINE_IDS.map(id => {
    const rows = semaforos.filter(row => record(row) && row.lineaId === id);
    const definitions = rows.length === 1 ? estados.filter(row => record(row) && row.id === rows[0].estado) : [];
    const state = definitions.length === 1 ? definitions[0] : null;
    if (!state || typeof state.text !== 'string' || !state.text.trim() || state.text.length > 200 || typeof state.color !== 'string') {
      return { id, status: 'unknown' as const, message: 'Estado no verificado' };
    }
    const color = normalize(state.color), text = normalize(state.text);
    const status: ServiceLevel = state.id === '2' && color === 'VERDE' && text === 'NORMAL' ? 'normal'
      : color === 'ROJO' ? 'suspended'
        : color === 'AMARILLO' || color === 'ESTACION O PARADA POR FUERA' ? 'warning' : 'unknown';
    return { id, status, message: state.text.trim() };
  });
  return { availability: 'available', checkedAt: new Date(now).toISOString(), expiresAt: new Date(now + STATUS_TTL).toISOString(), sourceUpdatedAt: null, lines };
}

/** Validate even same-origin responses (including accidentally served SPA HTML). */
export function isFreshStatus(value: unknown, now = Date.now()): value is ServiceSnapshot {
  if (!record(value) || value.availability !== 'available' || value.sourceUpdatedAt !== null
    || typeof value.checkedAt !== 'string' || typeof value.expiresAt !== 'string' || !Array.isArray(value.lines)) return false;
  const checked = Date.parse(value.checkedAt), expires = Date.parse(value.expiresAt);
  const lines = value.lines;
  return Number.isFinite(checked) && checked <= now + 30_000 && expires > now && expires > checked && expires - checked <= STATUS_TTL
    && lines.length === LINE_IDS.length && LINE_IDS.every(id => {
      const rows = lines.filter(row => record(row) && row.id === id);
      return rows.length === 1 && ['normal', 'warning', 'suspended', 'unknown'].includes(rows[0].status)
        && typeof rows[0].message === 'string' && rows[0].message.length <= 200;
    });
}

export function routeServiceLines(route: Pick<RouteOption, 'steps'>): { ids: string[]; uncovered: boolean } {
  if (!Array.isArray(route.steps)) return { ids: [], uncovered: true };
  const ids = new Set<string>(); let uncovered = false;
  for (const step of route.steps) {
    if (step.mode === 'walk') continue;
    const line = normalize(step.line || '').replace(/^LINEA\s+/, '');
    const officialBus = step.transit?.agencies.some(a => normalize(a.name) === 'METRO DE MEDELLIN');
    const compatible = (step.mode === 'metro' && ['A', 'B'].includes(line))
      || (step.mode === 'metrocable' && ['H', 'J', 'K', 'L', 'M', 'P'].includes(line))
      || (step.mode === 'tranvia' && line === 'T')
      || ((step.mode === 'metroplus' || (['bus', 'bus_articulado'].includes(step.mode) && officialBus)) && ['1', '2', 'O'].includes(line));
    if (compatible) ids.add(line); else uncovered = true;
  }
  return { ids: [...ids], uncovered };
}
