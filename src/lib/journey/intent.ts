import type { Station } from '../stations';
import { defaultNeeds, type JourneyIntent } from './types';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[¿?¡!.,]/g,'').trim();
const placeName = (value: string) => normalize(value).replace(/^(?:la estacion|estacion|el|la)\s+/, '');

/** Narrow offline parser, explicitly labeled local. Unrecognized constraints remain editable. */
export function parseLocalIntent(text: string): JourneyIntent {
  const trip = text.match(/\bdesde\s+(.+?)\s+(?:hasta|hacia|a)\s+(.+?)(?=[,;?.!]|\s+(?:y (?:tengo|quiero|prefiero|caminar)|con (?:un |mi )?presupuesto)|$)/i)
    || text.match(/\bde\s+(.+?)\s+(?:hasta|al|a)\s+(.+?)(?=[,;?.!]|$)/i);
  const plain = normalize(text);
  const price = text.match(/\$\s*([\d.]+)/);
  const walk = plain.match(/caminar\s+(?:como\s+)?(?:maximo|menos de|hasta)\s+(\d+)\s*(?:min|minutos)/);
  const duration = plain.match(/(?:tengo|maximo de viaje)\s+(\d+)\s*(?:min|minutos)/);
  const transfer = plain.match(/(?:maximo|hasta)\s+(\d+)\s*(?:transbordos?|trasbordos?)/);
  const bounded = (raw: string | undefined, max: number) => {
    const value = raw === undefined ? NaN : Number(raw.replace(/\./g,''));
    return Number.isSafeInteger(value) && value >= 0 && value <= max ? value : null;
  };
  return {...defaultNeeds, origin:trip?.[1].trim() || null, destination:trip?.[2].trim() || null,
    priority:/cuanto (?:vale|cuesta)|barat|ahorrar|menor costo/.test(plain) ? 'cost'
      : /caminar poco|menos caminata|menos caminar/.test(plain) ? 'walking'
      : /sin (?:transbordos|trasbordos)|menos (?:transbordos|trasbordos)/.test(plain) ? 'transfers'
      : /rapido|pronto|menor tiempo/.test(plain) ? 'duration' : 'balanced',
    maxCost:bounded(price?.[1],1_000_000),maxWalkingMinutes:bounded(walk?.[1],1440),maxDurationMinutes:bounded(duration?.[1],1440),
    maxTransfers:/sin (?:transbordos|trasbordos)/.test(plain) ? 0 : bounded(transfer?.[1],20),
    notes:/silla de ruedas|escaleras|accesib|movilidad reducida|antes de las|llegar a las|\bmanana\b|evitar (?:la )?linea|sin (?:usar )?(?:la )?linea/.test(plain)
      ? [`Revisar condiciones adicionales del texto: ${text.slice(0,185)}`] : [],
  };
}

export function stationCandidates(query: string, stations: Station[]): Station[] {
  const key = placeName(query);
  if (key.length < 2) return [];
  const valid = stations.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng));
  const exact = valid.filter(s=>placeName(s.nombre)===key);
  return (exact.length ? exact : valid.filter(s=>placeName(s.nombre).includes(key))).slice(0,8);
}

function validIntent(value: unknown): value is JourneyIntent {
  if (!value || typeof value !== 'object') return false;
  const v=value as Record<string,unknown>;
  const place=(p:unknown)=>p===null || typeof p==='string' && p.length>0 && p.length<=160;
  return place(v.origin)&&place(v.destination)&&['balanced','cost','duration','walking','transfers'].includes(String(v.priority))
    && ['maxCost','maxWalkingMinutes','maxDurationMinutes','maxTransfers'].every(key=>v[key]===null || typeof v[key]==='number' && Number.isSafeInteger(v[key]) && (v[key] as number)>=0 && (v[key] as number)<=(key==='maxCost'?1_000_000:key==='maxTransfers'?20:1440))
    && Array.isArray(v.notes)&&v.notes.length<=8&&v.notes.every(n=>typeof n==='string'&&n.length<=240);
}

export async function requestJourneyIntent(text: string, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<{intent:JourneyIntent;provider:'gemini'|'local';notice:string}> {
  if (!text.trim() || text.length>1200) throw new Error('Escribe entre 1 y 1.200 caracteres.');
  let notice='La interpretación con IA no está disponible. Revisa la lectura básica y completa tus condiciones.';
  const timeout=AbortSignal.timeout(16000);
  try {
    signal?.throwIfAborted();
    const response=await fetchImpl('/api/journey-intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:signal?AbortSignal.any([signal,timeout]):timeout});
    const data=await response.json();
    if(response.ok && data.provider==='gemini' && validIntent(data.intent)) return {intent:data.intent,provider:'gemini',notice:'Necesidades interpretadas con Gemini. Revisa los puntos y condiciones antes de comparar.'};
    if(data.code==='CONFIGURATION') notice='La IA no está activada en este entorno. Revisa la lectura básica o completa el viaje manualmente.';
    else if(data.code==='RATE_LIMIT') notice='Se alcanzó el límite de consultas de IA. Puedes completar el viaje manualmente.';
  } catch {
    signal?.throwIfAborted();
  }
  return {intent:parseLocalIntent(text),provider:'local',notice};
}
