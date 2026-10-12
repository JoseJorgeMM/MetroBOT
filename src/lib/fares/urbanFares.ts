import { calculateFare } from './engine';
import type { FareProfile, FareResult, FareSegment } from './types';

export interface UrbanFares {
  version:string; validFrom:string; reviewBy:string; currency:'COP';
  scope:'medellin_urbano_pago_independiente'; source:string;
  prices:{bus:number;micro:number};
}
export type UrbanChoices = Record<number,'bus'|'micro'|undefined>;
export function parseUrbanFares(value:unknown, today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Bogota'})):UrbanFares|null {
  if (!value || typeof value !== 'object') return null;
  const data=value as UrbanFares;
  const date=(v:unknown)=>typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v));
  if (!date(data.validFrom) || !date(data.reviewBy) || !date(today) || today<data.validFrom || today>data.reviewBy ||
    data.currency!=='COP' || data.scope!=='medellin_urbano_pago_independiente' || typeof data.version!=='string' ||
    typeof data.source!=='string' || !data.source.startsWith('https://www.medellin.gov.co/') ||
    !data.prices || !['bus','micro'].every(key=>Number.isSafeInteger(data.prices[key as 'bus'|'micro']) && data.prices[key as 'bus'|'micro']>0)) return null;
  return data;
}
export async function loadUrbanFares():Promise<UrbanFares|null> {
  try {
    const response=await fetch('/tarifas_urbanas.json');
    return response.ok ? parseUrbanFares(await response.json()) : null;
  } catch { return null; }
}

/** Optional independent-payment scenario, NEVER an inferred bus integration. */
export function urbanBudget(segments:FareSegment[], profile:FareProfile, catalog:UrbanFares, choices:UrbanChoices):FareResult|null {
  const selected=segments.map((segment,index)=>segment.mode==='TIPO_TRANSPORTE_NO_DETERMINADO' && choices[index] ? index : -1).filter(index=>index>=0);
  if (!selected.length) return null;
  const result=calculateFare(segments,profile);
  result.chains=[]; result.unresolved=[]; result.warnings=[]; result.integrationApplied=false;
  result.source='budget'; result.withoutIntegration=null; result.savings=null;
  let start=0;
  const append=(end:number)=>{
    if(end<=start) return;
    const part=calculateFare(segments.slice(start,end),profile);
    result.chains.push(...part.chains.map(chain=>({...chain,indices:chain.indices.map(index=>index+start)})));
    part.breakdown.forEach((row,index)=>{result.breakdown[start+index]={...row,index:start+index};});
    result.unresolved.push(...part.unresolved); result.warnings.push(...part.warnings);
    result.integrationApplied ||= part.integrationApplied;
  };
  for(const index of selected) {
    append(index);
    const amount=catalog.prices[choices[index]!];
    result.breakdown[index]={...result.breakdown[index],baseFare:amount,charge:amount,description:'Tarifa urbana plena · clase y pago independiente confirmados por ti'};
    result.chains.push({indices:[index],total:amount,charges:[amount],rule:'presupuesto_urbano_independiente',elapsedMinutes:null,windowMinutes:0,timing:'unknown'});
    start=index+1;
  }
  append(segments.length);
  result.total=result.chains.every(chain=>chain.total!==null) ? result.chains.reduce((sum,chain)=>sum+chain.total!,0) : null;
  result.status=result.total===null ? 'NO_DETERMINADA' : 'CONDICIONAL';
  result.warnings=[...new Set(['Presupuesto con pagos independientes de los buses que confirmaste. No aplica descuentos de integración a esos buses. No válido para rutas rurales, intermunicipales ni servicios especiales.',...result.warnings])];
  return result;
}
