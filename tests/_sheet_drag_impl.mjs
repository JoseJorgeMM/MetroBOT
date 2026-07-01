// tests/_sheet_drag_impl.mjs
// Pure logic for useSheetDrag. Decides the next snap index given current snap,
// drag delta (px) and release velocity (px/ms). No DOM, no React.

const DRAG_THRESHOLD = 7;
const VELOCITY_THRESHOLD = 0.3;
const MIN_DELTA = 3;

export function nextSnap(currentSnap, snapPoints, deltaY, velocityY) {
  if (!Array.isArray(snapPoints) || snapPoints.length === 0) return 0;
  const max = snapPoints.length - 1;
  const cur = Math.max(0, Math.min(max, currentSnap | 0));
  const d = typeof deltaY === 'number' ? deltaY : 0;
  const v = typeof velocityY === 'number' ? velocityY : 0;
  if (Math.abs(d) < MIN_DELTA && Math.abs(v) < VELOCITY_THRESHOLD) return cur;
  let next = cur;
  if (d < -DRAG_THRESHOLD || v < -VELOCITY_THRESHOLD) {
    next = cur + 1;
  } else if (d > DRAG_THRESHOLD || v > VELOCITY_THRESHOLD) {
    next = cur - 1;
  }
  return Math.max(0, Math.min(max, next));
}
