export const DEFAULT_VISIBLE_MAP_SYSTEMS = ['Metro', 'Cable', 'MPLUS', 'T'] as const;

export type MapLayerSystem = (typeof DEFAULT_VISIBLE_MAP_SYSTEMS)[number] | 'EnCicla';

export interface MapLayerSelection {
  isNavigating?: boolean;
  routeSystems?: readonly MapLayerSystem[];
}

/** Converts catalog and provider labels to the station layer identifiers. */
export function normalizeMapLayerSystem(system: string | undefined): MapLayerSystem | undefined {
  switch (system?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()) {
    case 'metro': return 'Metro';
    case 'cable':
    case 'metrocable': return 'Cable';
    case 'mplus':
    case 'metroplus': return 'MPLUS';
    case 't':
    case 'tranvia': return 'T';
    case 'encicla': return 'EnCicla';
    default: return undefined;
  }
}

/** Returns the systems whose station layers must remain visible on the map. */
export function visibleMapSystems({
  isNavigating = false,
  routeSystems = [],
}: MapLayerSelection = {}): MapLayerSystem[] {
  if (!isNavigating) return [...DEFAULT_VISIBLE_MAP_SYSTEMS];

  return [...new Set<MapLayerSystem>([...DEFAULT_VISIBLE_MAP_SYSTEMS, ...routeSystems])];
}
