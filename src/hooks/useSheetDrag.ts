// useSheetDrag.ts
// -----------------------------------------------------------------------------
// Pointer-events based drag for the bottom sheet. Snap to one of the given
// snapPoints (in pixels). SSR-safe (no-op outside the browser).
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { nextSnap } from '../../tests/_sheet_drag_impl.mjs';

export interface UseSheetDragApi {
  currentSnap: number;
  setSnap: (next: number) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  isDragging: boolean;
}

export function useSheetDrag(handleRef: React.RefObject<HTMLElement>, snapPoints: number[], initial: number): UseSheetDragApi {
  const [currentSnap, setCurrentSnap] = useState<number>(() => Math.max(0, Math.min(snapPoints.length - 1, initial | 0)));
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const lastYRef = useRef(0);
  const startMsRef = useRef(0);
  const lastMsRef = useRef(0);

  const setSnap = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(snapPoints.length - 1, next | 0));
    setCurrentSnap((prev) => {
      if (prev !== clamped) {
        try { navigator.vibrate && navigator.vibrate(10); } catch (_e) { /* noop */ }
      }
      return clamped;
    });
  }, [snapPoints.length]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (typeof window === 'undefined') return;
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    startMsRef.current = e.timeStamp || Date.now();
    lastMsRef.current = startMsRef.current;
    setIsDragging(true);
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch (_err) { /* noop */ }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    lastYRef.current = e.clientY;
    lastMsRef.current = e.timeStamp || Date.now();
  }, [isDragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch (_err) { /* noop */ }
    const deltaY = lastYRef.current - startYRef.current;
    const dt = Math.max(1, (lastMsRef.current || 0) - (startMsRef.current || 0));
    const velocity = deltaY / dt;
    const next = nextSnap(currentSnap, snapPoints, deltaY, velocity);
    setSnap(next);
  }, [isDragging, currentSnap, snapPoints, setSnap]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try { (e.currentTarget as Element).releasePointerCapture(e.pointerId); } catch (_err) { /* noop */ }
  }, [isDragging]);

  useEffect(() => () => { setIsDragging(false); }, []);

  return { currentSnap, setSnap, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, isDragging };
}
