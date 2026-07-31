export type PlaceValue = { lat: number; lng: number; name: string };
export type PlannerField = 'origin' | 'destination';
export type SearchRequest = { field: PlannerField; generation: number };

export type SearchResult = {
  place_id: string | number;
  lat: string;
  lon: string;
  display_name: string;
  isGoogle?: boolean;
};

type PlannerOperation =
  | { type: 'search'; request: SearchRequest }
  | { type: 'search-result'; request: SearchRequest }
  | { type: 'current-location'; token: SearchRequest }
  | null;

export type PlannerState = {
  origin: PlaceValue | null;
  destination: PlaceValue | null;
  originQuery: string;
  destinationQuery: string;
  busesEnabled: boolean;
  activeField: PlannerField;
  results: SearchResult[];
  resultRequest: SearchRequest | null;
  search: SearchRequest | null;
  currentLocation: SearchRequest | null;
  loading: boolean;
  generation: number;
  editing: Record<PlannerField, boolean>;
  operation: PlannerOperation;
};

export type PlannerEvent =
  | { type: 'sync-place'; field: PlannerField; place: PlaceValue | null }
  | { type: 'sync-buses-enabled'; busesEnabled: boolean }
  | { type: 'input'; field: PlannerField; value: string }
  | { type: 'focus-field'; field: PlannerField }
  | { type: 'begin-search'; request: SearchRequest }
  | { type: 'settle-search'; request: SearchRequest; results: SearchResult[] }
  | { type: 'begin-search-result'; request: SearchRequest }
  | { type: 'search-result-failure'; request: SearchRequest }
  | { type: 'select-search-result'; request: SearchRequest; place: PlaceValue }
  | { type: 'swap-endpoints' }
  | { type: 'set-buses-enabled'; busesEnabled: boolean }
  | { type: 'begin-current-location'; field: PlannerField }
  | { type: 'current-location-success'; token: SearchRequest; place: PlaceValue }
  | { type: 'current-location-failure'; token: SearchRequest }
  | { type: 'request-map-selection' }
  | { type: 'submit' }
  | { type: 'close' };

export type PlannerEffect =
  | { type: 'place-change'; field: PlannerField; place: PlaceValue | null }
  | { type: 'buses-enabled-change'; busesEnabled: boolean }
  | { type: 'schedule-search'; query: string; request: SearchRequest; delayMs: 600 }
  | { type: 'cancel-search' }
  | { type: 'request-map-selection'; field: PlannerField }
  | { type: 'submit' }
  | { type: 'close' };

export type PlannerTransition = { state: PlannerState; effects: PlannerEffect[] };

function sameRequest(left: SearchRequest | null, right: SearchRequest) {
  return left?.field === right.field && left.generation === right.generation;
}

function queryKey(field: PlannerField) {
  return field === 'origin' ? 'originQuery' : 'destinationQuery';
}

function clearedSearchState(state: PlannerState) {
  return {
    ...state,
    results: [],
    resultRequest: null,
    search: null,
    currentLocation: null,
    loading: false,
    operation: null,
  };
}

export function createPlannerState({
  origin,
  destination,
  busesEnabled,
}: Pick<PlannerState, 'origin' | 'destination' | 'busesEnabled'>): PlannerState {
  return {
    origin,
    destination,
    originQuery: origin?.name ?? '',
    destinationQuery: destination?.name ?? '',
    busesEnabled,
    activeField: 'origin',
    results: [],
    resultRequest: null,
    search: null,
    currentLocation: null,
    loading: false,
    generation: 0,
    editing: { origin: false, destination: false },
    operation: null,
  };
}

export function transitionPlanner(state: PlannerState, event: PlannerEvent): PlannerTransition {
  switch (event.type) {
    case 'sync-place': {
      const key = queryKey(event.field);
      const preserveEdit = state.editing[event.field] && event.place === null;
      return {
        state: {
          ...state,
          [event.field]: event.place,
          [key]: preserveEdit ? state[key] : event.place?.name ?? '',
          editing: event.place === null
            ? state.editing
            : { ...state.editing, [event.field]: false },
        },
        effects: [],
      };
    }

    case 'sync-buses-enabled':
      return { state: { ...state, busesEnabled: event.busesEnabled }, effects: [] };

    case 'input': {
      const generation = state.generation + 1;
      const request = event.value.trim() ? { field: event.field, generation } : null;
      const key = queryKey(event.field);
      const next = clearedSearchState(state);
      return {
        state: {
          ...next,
          [event.field]: null,
          [key]: event.value,
          activeField: event.field,
          generation,
          search: request,
          editing: { ...state.editing, [event.field]: true },
        },
        effects: [
          { type: 'place-change', field: event.field, place: null },
          request
            ? { type: 'schedule-search', query: event.value, request, delayMs: 600 }
            : { type: 'cancel-search' },
        ],
      };
    }

    case 'focus-field': {
      if (state.activeField === event.field) return { state, effects: [] };
      const next = clearedSearchState(state);
      return {
        state: { ...next, activeField: event.field, generation: state.generation + 1 },
        effects: [{ type: 'cancel-search' }],
      };
    }

    case 'begin-search':
      if (!sameRequest(state.search, event.request)) return { state, effects: [] };
      return {
        state: {
          ...state,
          loading: true,
          currentLocation: null,
          operation: { type: 'search', request: event.request },
        },
        effects: [],
      };

    case 'settle-search':
      if (
        !sameRequest(state.search, event.request)
        || state.operation?.type !== 'search'
        || !sameRequest(state.operation.request, event.request)
      ) return { state, effects: [] };
      return {
        state: {
          ...state,
          results: event.results,
          resultRequest: event.request,
          loading: false,
          operation: null,
        },
        effects: [],
      };

    case 'begin-search-result':
      if (!sameRequest(state.search, event.request) || !sameRequest(state.resultRequest, event.request)) {
        return { state, effects: [] };
      }
      return {
        state: { ...state, loading: true, operation: { type: 'search-result', request: event.request } },
        effects: [],
      };

    case 'search-result-failure':
      if (
        !sameRequest(state.search, event.request)
        || state.operation?.type !== 'search-result'
        || !sameRequest(state.operation.request, event.request)
      ) return { state, effects: [] };
      return { state: { ...state, loading: false, operation: null }, effects: [] };

    case 'select-search-result': {
      if (!sameRequest(state.search, event.request) || !sameRequest(state.resultRequest, event.request)) {
        return { state, effects: [] };
      }
      const key = queryKey(event.request.field);
      const next = clearedSearchState(state);
      return {
        state: {
          ...next,
          [event.request.field]: event.place,
          [key]: event.place.name,
          editing: { ...state.editing, [event.request.field]: false },
        },
        effects: [
          { type: 'cancel-search' },
          { type: 'place-change', field: event.request.field, place: event.place },
        ],
      };
    }

    case 'swap-endpoints': {
      const next = clearedSearchState(state);
      return {
        state: {
          ...next,
          origin: state.destination,
          destination: state.origin,
          originQuery: state.destination?.name ?? '',
          destinationQuery: state.origin?.name ?? '',
          generation: state.generation + 1,
          editing: { origin: false, destination: false },
        },
        effects: [
          { type: 'cancel-search' },
          { type: 'place-change', field: 'origin', place: state.destination },
          { type: 'place-change', field: 'destination', place: state.origin },
        ],
      };
    }

    case 'set-buses-enabled':
      return {
        state: { ...state, busesEnabled: event.busesEnabled },
        effects: [{ type: 'buses-enabled-change', busesEnabled: event.busesEnabled }],
      };

    case 'begin-current-location': {
      const generation = state.generation + 1;
      const token = { field: event.field, generation };
      const next = clearedSearchState(state);
      return {
        state: {
          ...next,
          activeField: event.field,
          generation,
          currentLocation: token,
          loading: true,
          operation: { type: 'current-location', token },
        },
        effects: [{ type: 'cancel-search' }],
      };
    }

    case 'current-location-success': {
      if (
        !sameRequest(state.currentLocation, event.token)
        || state.operation?.type !== 'current-location'
        || !sameRequest(state.operation.token, event.token)
      ) return { state, effects: [] };
      const key = queryKey(event.token.field);
      return {
        state: {
          ...state,
          [event.token.field]: event.place,
          [key]: event.place.name,
          currentLocation: null,
          loading: false,
          editing: { ...state.editing, [event.token.field]: false },
          operation: null,
        },
        effects: [{ type: 'place-change', field: event.token.field, place: event.place }],
      };
    }

    case 'current-location-failure':
      if (
        !sameRequest(state.currentLocation, event.token)
        || state.operation?.type !== 'current-location'
        || !sameRequest(state.operation.token, event.token)
      ) return { state, effects: [] };
      return {
        state: { ...state, currentLocation: null, loading: false, operation: null },
        effects: [],
      };

    case 'request-map-selection':
      return {
        state,
        effects: [{ type: 'request-map-selection', field: state.activeField }],
      };

    case 'submit':
      return {
        state,
        effects: state.origin && state.destination && !state.loading ? [{ type: 'submit' }] : [],
      };

    case 'close':
      return { state, effects: [{ type: 'close' }] };
  }
}
