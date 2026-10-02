export interface FareSegment {
  mode: string;
  name?: string;
  validationTime?: string;
  scheduledTime?: string;
  paidArea?: boolean;
  newJourney?: boolean;
  zone?: string;
  basin?: string;
  evidence?: string;
}
export interface FareProfile {
  id: string;
  payment?: 'civica' | 'bank' | 'unknown';
  arviCategory?: string;
}
export interface FareChain {
  indices: number[];
  rule?: string;
  category?: string;
  group?: string;
  total: number | null;
  charges?: number[];
  elapsedMinutes: number | null;
  windowMinutes: number;
  timing: 'validation' | 'scheduled' | 'unknown' | 'paid_area';
  reason?: string;
}
export interface FareResult {
  status: 'DETERMINADA' | 'CONDICIONAL' | 'NO_DETERMINADA';
  total: number | null;
  currency: string;
  profile: string;
  version: string;
  integrationApplied: boolean;
  withoutIntegration: number | null;
  savings: number | null;
  chains: FareChain[];
  breakdown: Array<{ index: number; mode: string; name: string; baseFare: number | null; charge: number | null; description: string; rule?: string; group?: string }>;
  warnings: string[];
  unresolved: Array<{ modes: string[]; reason: string }>;
}
export interface FareCatalog {
  version_tarifaria: string; fecha_vigencia: string; moneda: string;
  regla_principal: { ventana_integracion_masivo_minutos: number; ventana_integracion_colectivo_integrado_minutos: number };
  modos: Record<string, { codigo: string; tipo: string; costo?: number }>;
  perfiles_masivo: Record<string, { descripcion: string; tarifa_base?: number; otras_integraciones?: string }>;
  integraciones_masivo: Record<string, { nombre: string; combinaciones: string[][] }>;
  equivalencia_integraciones_oficiales: Record<string, Record<string, number>>;
  reglas_transferencia: Record<string, { dentro_90_minutos?: { costo_adicional?: number; tarifa_frecuente?: number; costo_adicional_sobre_integracion_1?: number; descripcion?: string }; dentro_zona_paga?: { costo_adicional: number } }>;
  rutas_colectivas_integradas_2026: { porcion_metro_o_cable: number; tarifas_totales: Record<string, { bus: number | null; micro: number | null }> };
  doble_integracion_colectiva: { ventana_maxima_minutos: number };
  cable_arvi: { codigo: string; [key: string]: unknown };
}
