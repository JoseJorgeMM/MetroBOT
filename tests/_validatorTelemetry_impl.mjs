// tests/_validatorTelemetry_impl.mjs
export const KEY = 'metrobot.validation.telemetry.v1';
export const CAP = 50;

function isValidEntry(x) {
  return x && typeof x.ts === 'number' && typeof x.degraded === 'number' && typeof x.validated === 'number';
}

export function loadTelemetry(storage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(isValidEntry) : [];
  } catch (_e) { return []; }
}

export function saveTelemetry(storage, sessions) {
  if (!storage) return false;
  try {
    const trimmed = sessions.slice(-CAP);
    storage.setItem(KEY, JSON.stringify(trimmed));
    return true;
  } catch (_e) { return false; }
}

export function recordSession(storage, validated, degraded, now) {
  const sessions = loadTelemetry(storage);
  sessions.push({ ts: now || Date.now(), validated: validated, degraded: degraded });
  return saveTelemetry(storage, sessions);
}

export function summarizeTelemetry(storage) {
  const sessions = loadTelemetry(storage);
  let totalValidated = 0;
  let totalDegraded = 0;
  for (const s of sessions) {
    totalValidated += s.validated || 0;
    totalDegraded += s.degraded || 0;
  }
  const total = totalValidated + totalDegraded;
  return { sessions: sessions.length, totalValidated: totalValidated, totalDegraded: totalDegraded, ratio: total === 0 ? 0 : totalDegraded / total };
}
