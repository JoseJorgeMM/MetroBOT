import { useReducer } from 'react';
import {
  presentationForSurface,
  transitionMobileSurface,
  type MobileSurface,
  type MobileSurfaceEvent,
} from '../lib/mobileSurface';

export function useMobileSurface(initial: MobileSurface = 'explore') {
  const [surface, dispatch] = useReducer(transitionMobileSurface, initial);

  return {
    surface,
    presentation: presentationForSurface(surface),
    dispatch: dispatch as (event: MobileSurfaceEvent) => void,
  };
}
