// share.ts
// -----------------------------------------------------------------------------
// Build a shareable text summary for a route and try to share it via the
// Web Share API, falling back to the clipboard. Never throws.
// -----------------------------------------------------------------------------

import type { RouteOption } from './routing';

export function buildShareText(
  route: Partial<RouteOption> | null | undefined,
  originName?: string | null,
  destName?: string | null,
): string {
  const o = (originName && String(originName).trim()) || 'origen';
  const d = (destName && String(destName).trim()) || 'destino';
  const dur = route && typeof route.duration === 'number' ? route.duration : '?';
  const cost =
    route && typeof route.cost === 'number' ? '$' + route.cost.toLocaleString('es-CO') : '$?';
  const tr = route && typeof route.transfers === 'number' ? route.transfers : '?';
  return 'Ruta MetroBOT: ' + o + ' -> ' + d + ' (~' + dur + ' min, ' + cost + ', ' + tr + ' transbordos)';
}

type ShareCapableNavigator = {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

export async function tryShare(
  text: string,
  title?: string,
  deps?: ShareCapableNavigator,
): Promise<'shared' | 'copied' | 'failed'> {
  const d =
    deps ||
    (typeof navigator !== 'undefined'
      ? (navigator as unknown as ShareCapableNavigator)
      : undefined);
  try {
    if (d && typeof d.share === 'function') {
      await d.share({ title: title || 'Ruta MetroBOT', text });
      return 'shared';
    }
  } catch {
    // fall through to clipboard
  }
  try {
    if (d && d.clipboard && typeof d.clipboard.writeText === 'function') {
      await d.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // fall through to failed
  }
  return 'failed';
}
