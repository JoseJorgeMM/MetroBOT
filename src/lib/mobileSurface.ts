export type MobileSurface =
  | 'explore'
  | 'planning'
  | 'loading'
  | 'results'
  | 'assistant'
  | 'navigation';

export type SheetPresentation = 'compact' | 'medium' | 'expanded';

export type MobileSurfaceEvent =
  | { type: 'OPEN_PLANNING' }
  | { type: 'OPEN_ASSISTANT' }
  | { type: 'REQUEST_ROUTES' }
  | { type: 'ROUTES_READY' }
  | { type: 'ROUTES_FAILED' }
  | { type: 'START_NAVIGATION' }
  | { type: 'END_NAVIGATION' }
  | { type: 'SHOW_RESULTS' }
  | { type: 'CLOSE' };

export function transitionMobileSurface(
  state: MobileSurface,
  event: MobileSurfaceEvent,
): MobileSurface {
  switch (event.type) {
    case 'OPEN_PLANNING': return 'planning';
    case 'OPEN_ASSISTANT': return 'assistant';
    case 'REQUEST_ROUTES': return 'loading';
    case 'ROUTES_READY':
    case 'SHOW_RESULTS': return 'results';
    case 'ROUTES_FAILED': return 'planning';
    case 'START_NAVIGATION': return 'navigation';
    case 'END_NAVIGATION':
    case 'CLOSE': return 'explore';
    default: return state;
  }
}

export function presentationForSurface(surface: MobileSurface): SheetPresentation {
  if (surface === 'explore' || surface === 'navigation') return 'compact';
  if (surface === 'results') return 'medium';
  return 'expanded';
}
