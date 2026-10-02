import { fareCatalog, fareConfig } from './config';
import type { FareCatalog, FareChain, FareProfile, FareResult, FareSegment } from './types';

const money = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const rail = (mode: string) => mode === 'METRO' || mode === 'CABLE';
const collective = (mode: string) => mode === 'BUS_INTEGRADO' || mode === 'MICRO_INTEGRADO';
const sameChain = (a: string[], b: string[]) => a.length === b.length && a.every((mode, i) => mode === b[i]);
const clock = (segment: FareSegment) => {
  const raw = segment.validationTime ?? segment.scheduledTime;
  return { value: raw === undefined ? NaN : Date.parse(raw), source: segment.validationTime !== undefined ? 'validation' as const : 'scheduled' as const };
};

/** Pure chain calculator. Caller supplies validation evidence; route duration is never a substitute. */
export function calculateFare(segments: FareSegment[], profile: FareProfile = fareConfig.defaultProfile, data: FareCatalog = fareCatalog, config = fareConfig): FareResult {
  const modeData = Object.values(data.modos);
  const free = (segment: FareSegment) => segment.mode === 'WALK' || modeData.some(mode => mode.codigo === segment.mode && mode.costo === 0);
  const standalone = (segment: FareSegment): number | null => {
    if (free(segment)) return 0;
    if (segment.mode === data.cable_arvi.codigo) {
      const price = profile.arviCategory ? data.cable_arvi[profile.arviCategory] : undefined;
      return money(price) ? price : null;
    }
    if (segment.mode === 'ALIMENTADOR' && !config.feederBasins.includes(segment.basin || '')) return null;
    const category = Object.entries(data.integraciones_masivo).find(([, rule]) => rule.combinaciones.some(modes => sameChain(modes, [segment.mode])));
    if (!category || !config.categoryGroups[category[0]]) return null;
    const price = profile.id === 'bancarizado' ? data.perfiles_masivo[profile.id]?.tarifa_base
      : data.equivalencia_integraciones_oficiales[config.categoryGroups[category[0]]]?.[profile.id];
    return money(price) ? price : null;
  };
  const result: FareResult = {
    status: 'DETERMINADA', total: null, currency: data.moneda, profile: profile.id, version: data.version_tarifaria,
    integrationApplied: false, withoutIntegration: null, savings: null, chains: [], warnings: [], unresolved: [],
    breakdown: segments.map((segment, index) => ({ index, mode: segment.mode, name: segment.name || segment.mode,
      baseFare: standalone(segment), charge: free(segment) ? 0 : null,
      description: free(segment) ? (segment.mode === 'WALK' ? 'A pie' : 'Uso sin costo monetario') : 'Tarifa no determinada' })),
  };
  const paid = segments.map((segment, index) => ({ ...segment, index })).filter(segment => !free(segment));
  const groups: typeof paid[] = [];
  let current: typeof paid = [];
  for (const segment of paid) {
    const first = current[0];
    const start = first && clock(first), next = clock(segment);
    const usesCollective = collective(segment.mode) || current.some(item => collective(item.mode));
    const window = usesCollective ? Math.min(data.regla_principal.ventana_integracion_colectivo_integrado_minutos, data.doble_integracion_colectiva.ventana_maxima_minutos) : data.regla_principal.ventana_integracion_masivo_minutos;
    const elapsed = start && start.source === next.source ? (next.value - start.value) / 60000 : NaN;
    const continuousPaidArea = current.length === 1 && first.mode === 'METRO' && segment.mode === 'CABLE' && segment.paidArea === true;
    const expired = !continuousPaidArea && (usesCollective ? elapsed >= window : elapsed > window);
    // Arví has an independent fare, not a mass-transit integration.
    if (first && (segment.newJourney || expired || segment.mode === data.cable_arvi.codigo || first.mode === data.cable_arvi.codigo)) {
      if (expired && next.source === 'scheduled' && !segment.newJourney) {
        result.status = 'CONDICIONAL'; result.warnings.push('El nuevo viaje depende de superar la ventana según horarios previstos, no validaciones reales.');
      }
      groups.push(current); current = [];
    }
    current.push(segment);
  }
  if (current.length) groups.push(current);

  for (const group of groups) {
    const modes = group.map(item => item.mode);
    const usesCollective = modes.some(collective);
    const times = group.map(clock);
    const consistent = times.every(time => Number.isFinite(time.value) && time.source === times[0].source);
    const ordered = consistent && times.every((time, i) => i === 0 || time.value >= times[i - 1].value);
    const paidArea = modes.length === 2 && modes[0] === 'METRO' && modes[1] === 'CABLE' && group[1].paidArea === true;
    const chain: FareChain = { indices: group.map(item => item.index), total: null,
      elapsedMinutes: ordered ? (times[times.length - 1].value - times[0].value) / 60000 : null,
      windowMinutes: usesCollective ? data.regla_principal.ventana_integracion_colectivo_integrado_minutos : data.regla_principal.ventana_integracion_masivo_minutos,
      timing: paidArea ? 'paid_area' : ordered ? times[0].source : 'unknown' };
    const reject = (reason: string) => { chain.reason = reason; };
    if (!data.perfiles_masivo[profile.id]) reject('Perfil tarifario desconocido.');
    else if (group.some(item => item.mode === 'ALIMENTADOR' && !config.feederBasins.includes(item.basin || ''))) reject('Falta confirmar alimentador de cuenca 3 o 6.');
    else if (group.some(item => (item.validationTime !== undefined && !Number.isFinite(Date.parse(item.validationTime))) || (item.scheduledTime !== undefined && !Number.isFinite(Date.parse(item.scheduledTime))))) reject('Hora de validación o salida inválida.');
    else if (group.length > 1 && !paidArea && !ordered) reject('Faltan horas comparables y ordenadas desde la primera validación.');
    else if (group.length > 1 && profile.payment !== 'civica') reject('La integración requiere confirmar el medio de pago Cívica.');
    else if (usesCollective) {
      const buses = group.filter(item => collective(item.mode));
      const single = group.length === 2 && buses.length === 1 && group.some(item => rail(item.mode));
      const double = group.length === 3 && collective(modes[0]) && rail(modes[1]) && collective(modes[2]);
      if ((!single && !double) || profile.payment !== 'civica') reject('Combinación colectiva o medio de pago no contemplado.');
      else if (double && (!buses[0].basin || !buses[1].basin || buses[0].basin === buses[1].basin)) reject('La doble integración exige dos cuencas distintas identificadas.');
      else {
        const railPrice = data.rutas_colectivas_integradas_2026.porcion_metro_o_cable;
        const portions = buses.map(bus => {
          const total = data.rutas_colectivas_integradas_2026.tarifas_totales[bus.zone || '']?.[bus.mode === 'MICRO_INTEGRADO' ? 'micro' : 'bus'];
          return money(total) && money(railPrice) && total >= railPrice ? total - railPrice : null;
        });
        if (portions.some(price => price === null)) reject('Falta una tarifa colectiva para la zona y el tipo de vehículo.');
        else {
          chain.rule = double ? 'doble_integracion_colectiva' : 'rutas_colectivas_integradas_2026';
          let busIndex = 0;
          chain.charges = group.map(item => collective(item.mode) ? portions[busIndex++]! : railPrice);
          chain.total = chain.charges.reduce((a, b) => a + b, 0);
        }
      }
    } else if (group.length === 1 && modes[0] === data.cable_arvi.codigo) {
      chain.rule = 'cable_arvi'; chain.total = standalone(group[0]);
      if (chain.total === null) reject('Falta seleccionar la categoría tarifaria de Cable Arví.');
    } else {
      const matches = Object.entries(data.integraciones_masivo).filter(([, rule]) => rule.combinaciones.some(combination => sameChain(combination, modes)));
      const transferKey = modes.map(mode => mode.toLowerCase()).join('_a_');
      const transfer = group.length === 2 ? data.reglas_transferencia[transferKey] : undefined;
      if (matches.length > 1) reject('Hay más de una regla exacta; requiere validación.');
      else if (matches.length === 1) {
        chain.rule = matches[0][0]; chain.category = chain.rule; chain.group = config.categoryGroups[chain.category];
      } else if (transfer && (!transfer.dentro_zona_paga || paidArea)) {
        chain.rule = `transferencia:${transferKey}`; chain.category = config.transferCategories[transferKey];
        chain.group = chain.category && data.integraciones_masivo[chain.category] ? config.categoryGroups[chain.category] : undefined;
      }
      if (!chain.reason && (!chain.rule || !chain.group)) reject('La combinación no tiene una regla y un grupo tarifario explícitos.');
      if (!chain.reason) {
        const price = profile.id === 'bancarizado' && group.length === 1 ? standalone(group[0])
          : data.equivalencia_integraciones_oficiales[chain.group!]?.[profile.id];
        if (!money(price)) reject('No hay tarifa para este grupo y perfil.');
        else chain.total = price;
      }
    }
    if (chain.total !== null && !chain.charges) {
      // Attribute a base fare then only differences between explicitly priced prefixes.
      // If any prefix is unknown, display one whole-chain charge rather than fabricated splits.
      const base = standalone(group[0]);
      let previous = base;
      const charges = base === null ? [] : [base];
      for (let i = 1; i < group.length && previous !== null; i++) {
        let prefixTotal = i === group.length - 1 ? chain.total : null;
        if (prefixTotal === null) {
          const category = Object.entries(data.integraciones_masivo).find(([, rule]) => rule.combinaciones.some(combo => sameChain(combo, modes.slice(0, i + 1))));
          const value = category && data.equivalencia_integraciones_oficiales[config.categoryGroups[category[0]]]?.[profile.id];
          if (money(value)) prefixTotal = value;
        }
        if (prefixTotal === null || prefixTotal < previous) { previous = null; break; }
        charges.push(prefixTotal - previous); previous = prefixTotal;
      }
      chain.charges = charges.length === group.length && previous !== null ? charges : [chain.total, ...group.slice(1).map(() => 0)];
    }
    if (chain.total === null) {
      const reason = chain.reason || 'Tarifa no determinada.';
      result.warnings.push(reason); result.unresolved.push({ modes, reason });
    } else {
      if (group.length > 1) result.integrationApplied = true;
      if (group.length > 1 && chain.timing === 'scheduled') {
        result.status = 'CONDICIONAL'; result.warnings.push('Tarifa condicionada al horario previsto: las salidas no son validaciones de Cívica.');
      }
      group.forEach((item, i) => {
        const row = result.breakdown[item.index];
        row.charge = chain.charges![i]; row.rule = chain.rule; row.group = chain.group;
        row.description = i === 0 ? (result.chains.length ? 'Nuevo viaje · tarifa de la cadena' : 'Tarifa base o de la cadena')
          : row.charge === 0 ? 'Integración: $0 adicional' : 'Costo adicional de integración';
        if (usesCollective) row.description = 'Componente de la tarifa integrada';
      });
    }
    result.chains.push(chain);
  }
  if (!segments.length || result.chains.some(chain => chain.total === null)) result.status = 'NO_DETERMINADA';
  else result.total = result.chains.reduce((sum, chain) => sum + chain.total!, 0);
  if (result.status !== 'NO_DETERMINADA' && result.breakdown.every(item => item.baseFare !== null)) {
    result.withoutIntegration = result.breakdown.reduce((sum, item) => sum + item.baseFare!, 0);
    if (result.withoutIntegration >= result.total!) result.savings = result.withoutIntegration - result.total!;
  }
  result.warnings = [...new Set(result.warnings)];
  return result;
}
