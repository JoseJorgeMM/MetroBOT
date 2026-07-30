const MAX_SOURCE_AGE_MS = 24 * 60 * 60 * 1000;

export function isTrustedStatusSource(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'metrodemedellin.gov.co' || host.endsWith('.metrodemedellin.gov.co');
  } catch { return false; }
}

function parseList(value) {
  if (!value || /^(ninguna|ninguno|no aplica|no se reporta)$/i.test(value.trim())) return [];
  return value.split(/[,;|]/).map(item => item.trim()).filter(Boolean);
}

function field(text, name) {
  return text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, 'im'))?.[1]?.trim();
}

export function parseLiveMetroStatus(text, metadata, now = new Date()) {
  const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web?.uri || !/^https?:\/\//i.test(web.uri) || seen.has(web.uri)) continue;
    const published = web.publishedTime || web.publicationTime;
    if (published && now.getTime() - Date.parse(published) > MAX_SOURCE_AGE_MS) continue;
    seen.add(web.uri);
    sources.push({ title: web.title?.trim() || web.uri, url: web.uri, official: isTrustedStatusSource(web.uri) });
  }
  const result = (field(text, 'RESULTADO') || '').toLowerCase();
  const summary = field(text, 'RESUMEN') || '';
  const explicit = result === 'normal' || result === 'alerta';
  const status = explicit && sources.length > 0 && sources.some(source => source.official) ? result : 'no_verificado';
  return {
    status,
    summary: summary || (status === 'no_verificado' ? 'No se pudo confirmar el estado operativo actual.' : 'Estado operativo consultado.'),
    affectedLines: status === 'alerta' ? parseList(field(text, 'LINEAS_AFECTADAS')) : [],
    affectedStations: status === 'alerta' ? parseList(field(text, 'ESTACIONES_AFECTADAS')) : [],
    sources: sources.slice(0, 3),
    checkedAt: now.toISOString(),
  };
}
