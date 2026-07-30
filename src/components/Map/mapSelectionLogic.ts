import type { PlaceValue } from '../TripPlannerPanel';

export type MapSelectionMode = 'origin' | 'destination' | null;
export type MapSelectionState = { mode: MapSelectionMode; generation: number; locked: boolean };
export type MapSelectionAttempt = { mode: Exclude<MapSelectionMode, null>; generation: number };

export function createMapSelectionState(mode: MapSelectionMode): MapSelectionState {
  return { mode, generation: 0, locked: false };
}

export function beginMapSelection(previous: MapSelectionState, mode: MapSelectionMode): MapSelectionState {
  return { mode, generation: previous.generation + 1, locked: false };
}

export function acceptMapSelectionTap(state: MapSelectionState) {
  if (state.mode === null || state.locked) return null;
  return {
    state: { ...state, locked: true },
    attempt: { mode: state.mode, generation: state.generation },
  };
}

export function canDeliverMapSelection(state: MapSelectionState, attempt: MapSelectionAttempt) {
  return state.locked && state.mode === attempt.mode && state.generation === attempt.generation;
}

export function placeFromReverseGeocode(lat: number, lng: number, displayName?: string): PlaceValue {
  return { lat, lng, name: displayName?.split(',')[0] || 'Punto seleccionado' };
}
