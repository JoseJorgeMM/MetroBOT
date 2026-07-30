export type LiveMetroStatusLevel = 'normal' | 'alerta' | 'no_verificado';

export interface LiveMetroSource {
  title: string;
  url: string;
  official: boolean;
}

export interface LiveMetroStatus {
  status: LiveMetroStatusLevel;
  summary: string;
  affectedLines: string[];
  affectedStations: string[];
  sources: LiveMetroSource[];
  checkedAt: string;
}

const MAX_SOURCE_AGE_MS = 24 * 60 * 60 * 1000;

/** Official source policy. Public social profiles remain secondary evidence. */
export function isTrustedStatusSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'metrodemedellin.gov.co' || host.endsWith('.metrodemedellin.gov.co');
  } catch {
    return false;
  }
}

function parseList(value: string | undefined): string[] {
  if (!value || /^(ninguna|ninguno|no aplica|no se reporta)$/i.test(value.trim())) return [];
  return value.split(/[,;|]/).map(item => item.trim()).filter(Boolean);
}

function field(text: string, name: string): string | undefined {
  const match = text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim();
}

function extractSources(metadata: any, now: Date): LiveMetroSource[] {
  const chunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
  const seen = new Set<string>();
  const sources: LiveMetroSource[] = [];
  for (const chunk of chunks) {
    const web = chunk?.web;
    if (!web?.uri || !/^https?:\/\//i.test(web.uri) || seen.has(web.uri)) continue;
    const published = web.publishedTime || web.publicationTime;
    if (published) {
      const timestamp = Date.parse(published);
      if (!Number.isNaN(timestamp) && now.getTime() - timestamp > MAX_SOURCE_AGE_MS) continue;
    }
    seen.add(web.uri);
    sources.push({
      title: typeof web.title === 'string' && web.title.trim() ? web.title.trim() : web.uri,
      url: web.uri,
      official: isTrustedStatusSource(web.uri),
    });
  }
  return sources.slice(0, 3);
}

export function parseLiveMetroStatus(text: string, groundingMetadata: any, now = new Date()): LiveMetroStatus {
  const checkedAt = now.toISOString();
  const sources = extractSources(groundingMetadata, now);
  const summary = field(text, 'RESUMEN') || '';
  const result = (field(text, 'RESULTADO') || '').toLowerCase();
  const affectedLines = parseList(field(text, 'LINEAS_AFECTADAS'));
  const affectedStations = parseList(field(text, 'ESTACIONES_AFECTADAS'));
  const hasOfficialSource = sources.some(source => source.official);
  const hasExplicitResult = result === 'normal' || result === 'alerta';
  const status: LiveMetroStatusLevel = hasExplicitResult && sources.length > 0 && hasOfficialSource
    ? result as LiveMetroStatusLevel
    : 'no_verificado';

  return {
    status,
    summary: summary || (status === 'no_verificado' ? 'No se pudo confirmar el estado operativo actual.' : 'Estado operativo consultado.'),
    affectedLines: status === 'alerta' ? affectedLines : [],
    affectedStations: status === 'alerta' ? affectedStations : [],
    sources,
    checkedAt,
  };
}
