// tests/_share_impl.mjs
// Mirror of src/lib/share.ts (kept in sync by hand; tests assert against this).

const VALID_ORIGIN = { name: 'Casa', lat: 6.21, lng: -75.57 };
const VALID_DEST = { name: 'Trabajo', lat: 6.27, lng: -75.56 };
const VALID_ROUTE = { id: 'r1', duration: 25, cost: 3430, transfers: 1 };

export function buildShareText(route, originName, destName) {
  const o = (originName || 'origen').toString();
  const d = (destName || 'destino').toString();
  const dur = (route && typeof route.duration === 'number') ? route.duration : '?';
  const cost = (route && typeof route.cost === 'number') ? '$' + route.cost.toLocaleString('es-CO') : '$?';
  const tr = (route && typeof route.transfers === 'number') ? route.transfers : '?';
  return 'Ruta MetroBOT: ' + o + ' -> ' + d + ' (~' + dur + ' min, ' + cost + ', ' + tr + ' transbordos)';
}

// tryShare: navigator.share may be unavailable in tests. Pass an injectable
// share API. Returns 'shared' | 'copied' | 'failed' and never throws.
export async function tryShare(text, title, deps) {
  const d = deps || (typeof navigator !== 'undefined' ? navigator : {});
  try {
    if (d && typeof d.share === 'function') {
      await d.share({ title: title || 'Ruta MetroBOT', text });
      return 'shared';
    }
  } catch (e) {
    // fall through to clipboard
  }
  try {
    if (d && d.clipboard && typeof d.clipboard.writeText === 'function') {
      await d.clipboard.writeText(text);
      return 'copied';
    }
  } catch (e) {
    // fall through to failed
  }
  return 'failed';
}
