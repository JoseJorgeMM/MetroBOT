import catalog from '../../costosintegraciones.json';
import type { FareCatalog, FareProfile } from './types';

// Categories classify different combinations. This table assigns PRICES only.
// Never parse a category's number or infer its group from equal monetary values.
export const fareConfig = {
  defaultProfile: { id: 'frecuente', payment: 'civica' } as FareProfile,
  categoryGroups: {
    integracion_1: 'integraciones_1_4',
    integracion_2: 'integraciones_1_4',
    integracion_3: 'integraciones_5_7',
    integracion_4: 'integracion_8',
    integracion_5: 'integraciones_9_10',
  } as Record<string, string>,
  // Directional rules explicitly present in the JSON but not always in its arrays.
  transferCategories: {
    metro_a_metroplus: 'integracion_2', metro_a_tranvia: 'integracion_2',
    metro_a_cable: 'integracion_2', metroplus_a_metro: 'integracion_2',
    tranvia_a_metro: 'integracion_2', alimentador_a_metro: 'integracion_3',
    alimentador_a_metroplus: 'integracion_2', alimentador_a_tranvia: 'integracion_2',
    alimentador_a_alimentador: 'integracion_3',
  } as Record<string, string>,
  feederBasins: ['3', '6'],
};
export const fareCatalog: FareCatalog = catalog;
export const formatCOP = (value: number) => `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`;
