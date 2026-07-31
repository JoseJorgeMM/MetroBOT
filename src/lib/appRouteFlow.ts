export interface RouteRequestPlace {
  lat: number;
  lng: number;
  name: string;
}

export interface RouteRequestEndpoints {
  origin: RouteRequestPlace;
  destination: RouteRequestPlace;
}

export type AppRequest =
  | { id: number; kind: 'assistant' }
  | { id: number; kind: 'route'; endpoints: RouteRequestEndpoints };

export interface AppRequestState {
  nextRequestId: number;
  activeRequest: AppRequest | null;
}

export type RouteOutcome = 'none' | 'ready' | 'failed';

interface AppRequestAdmission {
  state: AppRequestState;
  request: AppRequest | null;
}

export function createAppRequestState(): AppRequestState {
  return { nextRequestId: 1, activeRequest: null };
}

export function admitRouteRequest(
  state: AppRequestState,
  endpoints: RouteRequestEndpoints,
): AppRequestAdmission {
  if (state.activeRequest) return { state, request: null };
  const request: AppRequest = {
    id: state.nextRequestId,
    kind: 'route',
    endpoints,
  };
  return {
    state: {
      nextRequestId: state.nextRequestId + 1,
      activeRequest: request,
    },
    request,
  };
}

export function admitAssistantRequest(state: AppRequestState): AppRequestAdmission {
  if (state.activeRequest) return { state, request: null };
  const request: AppRequest = { id: state.nextRequestId, kind: 'assistant' };
  return {
    state: {
      nextRequestId: state.nextRequestId + 1,
      activeRequest: request,
    },
    request,
  };
}

export function completeAppRequest(state: AppRequestState, requestId: number): AppRequestState {
  if (state.activeRequest?.id !== requestId) return state;
  return { ...state, activeRequest: null };
}

export function assistantResponseForOutcome(
  outcome: RouteOutcome,
  response: string,
): string | null {
  return outcome === 'failed' ? null : response;
}
