export interface NavigationStartState {
  generation: number;
  activeToken: number | null;
}

export interface NavigationStartTransition {
  state: NavigationStartState;
  token: number | null;
}

export function createNavigationStartState(): NavigationStartState {
  return { generation: 0, activeToken: null };
}

export function beginNavigationStart(state: NavigationStartState): NavigationStartTransition {
  if (state.activeToken !== null) return { state, token: null };
  const token = state.generation + 1;
  return {
    state: { generation: token, activeToken: token },
    token,
  };
}

export function cancelNavigationStart(state: NavigationStartState): NavigationStartState {
  return { generation: state.generation + 1, activeToken: null };
}

export function isNavigationStartCurrent(state: NavigationStartState, token: number): boolean {
  return state.activeToken === token;
}

export function completeNavigationStart(state: NavigationStartState, token: number): NavigationStartState {
  if (!isNavigationStartCurrent(state, token)) return state;
  return { ...state, activeToken: null };
}
