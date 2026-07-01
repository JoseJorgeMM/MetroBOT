// tests/_reduced_motion_impl.mjs
export function matchesReducedMotion(mediaQueryList) {
  if (!mediaQueryList || typeof mediaQueryList !== 'object') return false;
  try {
    return mediaQueryList.matches === true;
  } catch (_e) {
    return false;
  }
}
