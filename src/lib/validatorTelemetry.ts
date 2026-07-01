// validatorTelemetry.ts
// -----------------------------------------------------------------------------
// Per-session telemetry for the validation layer. Stored in localStorage,
// capped at 50 sessions. All functions are SSR-safe and never throw.
// -----------------------------------------------------------------------------

export const KEY = 'metrobot.validation.telemetry.v1';
export const CAP = 50;

export interface TelemetryEntry {
  ts: number;
  validated: number;
  degraded: number;
}

export interface TelemetrySummary {
  sessions: number;
  totalValidated: number;
  totalDegraded: number;
  ratio: number;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch (_e) { return null; }
}

function isValidEntry(x: unknown): x is TelemetryEntry {
  return !!x && typeof (x as TelemetryEntry).ts === 'number' && typeof (x as TelemetryEntry).degraded === 'number' && typeof (x as TelemetryEntry).validated === 'number';
}

export function loadTelemetry(storage?: Storage | null): TelemetryEntry[] {
  const s = storage === undefined ? getStorage() : storage;
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(isValidEntry) : [];
  } catch (_e) { return []; }
}

export function saveTelemetry(storage: Storage | null | undefined, sessions: TelemetryEntry[]): boolean {
  const s = storage === undefined ? getStorage() : storage;
  if (!s) return false;
  try {
    const trimmed = sessions.slice(-CAP);
    s.setItem(KEY, JSON.stringify(trimmed));
    return true;
  } catch (_e) { return false; }
}

export function recordSession(storage: Storage | null | undefined, validated: number, degraded: number, now?: number): boolean {
  const s = storage === undefined ? getStorage() : storage;
  const sessions = loadTelemetry(s);
  sessions.push({ ts: now || Date.now(), validated, degraded });
  return saveTelemetry(s, sessions);
}

export function summarizeTelemetry(storage?: Storage | null): TelemetrySummary {
  const sessions = loadTelemetry(storage);
  let totalValidated = 0;
  let totalDegraded = 0;
  for (const s of sessions) {
    totalValidated += s.validated || 0;
    totalDegraded += s.degraded || 0;
  }
  const total = totalValidated + totalDegraded;
  return { sessions: sessions.length, totalValidated, totalDegraded, ratio: total === 0 ? 0 : totalDegraded / total };
}
