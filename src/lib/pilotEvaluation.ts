import type {TransferObservation} from './transfers';

export type PilotContext = 'practice' | 'field';
export type PilotPhase = 'unassigned' | 'baseline' | 'assisted';
export interface PilotSession {
  schemaVersion:2; pilot:'san-antonio-a-b'; sessionId:string; catalogVersion:1;
  context:PilotContext; phase:PilotPhase; observations:TransferObservation[];
}
export const PILOT_FILE_LIMIT=128*1024;
export const PILOT_SESSION_LIMIT=100;
export const PILOT_BATCH_LIMIT=20;
const record=(value:unknown):value is Record<string,unknown>=>!!value && typeof value==='object' && !Array.isArray(value);
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length && keys.every(key=>Object.hasOwn(value,key));

/** Import is untrusted. Do not retain raw JSON, file names or unsupported fields. */
export function parsePilotSession(text:string,source:'imported'|'demo'='imported'):PilotSession {
  if(new TextEncoder().encode(text).byteLength>PILOT_FILE_LIMIT) throw Error('Archivo demasiado grande: máximo 128 KiB.');
  let value:unknown;
  try { value=JSON.parse(text); } catch { throw Error('JSON inválido. No se importó la sesión.'); }
  if(record(value) && value.schemaVersion===1) throw Error('Formato v1 sin grupo de evaluación. Exporta una nueva sesión v2; no se inventará su procedencia.');
  if(!record(value) || !exact(value,['schemaVersion','pilot','sessionId','catalogVersion','context','phase','observations']) ||
    value.schemaVersion!==2 || value.pilot!=='san-antonio-a-b' || value.catalogVersion!==1 ||
    typeof value.sessionId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.sessionId) ||
    typeof value.context!=='string' || !['practice','field'].includes(value.context) || typeof value.phase!=='string' || !['unassigned','baseline','assisted'].includes(value.phase) ||
    !Array.isArray(value.observations) || value.observations.length>6) throw Error('Sesión incompatible: se requiere el formato v2 de San Antonio, sin campos adicionales.');
  const synthetic=value.sessionId.toLowerCase().startsWith('00000000-0000-4000-8000-');
  if(source==='imported'&&synthetic)throw Error('Sesión sintética reservada para demostración; no se importa como campo.');
  if(source==='demo'&&!synthetic)throw Error('La demostración requiere identificadores sintéticos reservados.');
  const observations:TransferObservation[]=[];
  const seen=new Set<string>();
  for(const item of value.observations) {
    if(!record(item) || !exact(item,['stage','kind']) || typeof item.stage!=='string' || !['connection','sign'].includes(item.stage) ||
      typeof item.kind!=='string' || !['unclear','help-needed','useful'].includes(item.kind)) throw Error('Categorías de evaluación inválidas.');
    const key=`${item.stage}:${item.kind}`;
    if(seen.has(key)) throw Error('La sesión contiene categorías repetidas.');
    seen.add(key);
    observations.push({stage:item.stage as TransferObservation['stage'],kind:item.kind as TransferObservation['kind']});
  }
  return {schemaVersion:2,pilot:'san-antonio-a-b',sessionId:value.sessionId.toLowerCase(),catalogVersion:1,
    context:value.context as PilotContext,phase:value.phase as PilotPhase,observations};
}

const signature=(session:PilotSession)=>JSON.stringify([session.catalogVersion,session.context,session.phase,session.observations.map(item=>`${item.stage}:${item.kind}`).sort()]);
export function mergePilotSessions(current:readonly PilotSession[],incoming:readonly PilotSession[]) {
  const sessions=[...current];const ids=new Map(current.map(session=>[session.sessionId,signature(session)]));
  let added=0,duplicates=0,conflicts=0,overflow=0;
  for(const session of incoming) {
    const previous=ids.get(session.sessionId);
    if(previous!==undefined) { if(previous===signature(session))duplicates++;else conflicts++;continue; }
    if(sessions.length>=PILOT_SESSION_LIMIT){overflow++;continue;}
    sessions.push(session);ids.set(session.sessionId,signature(session));added++;
  }
  return {sessions,added,duplicates,conflicts,overflow};
}

const stageSummary=()=>({answered:0,unclear:0,helpNeeded:0,useful:0});
export function summarizePilot(sessions:readonly PilotSession[]) {
  const result={sessions:sessions.length,field:0,practice:0,unassigned:0,stages:{connection:stageSummary(),sign:stageSummary()}};
  for(const session of sessions) {
    result[session.context]++;
    if(session.phase==='unassigned') result.unassigned++;
    for(const stage of ['connection','sign'] as const) {
      const events=session.observations.filter(item=>item.stage===stage);
      if(!events.length)continue;
      const summary=result.stages[stage];summary.answered++;
      for(const kind of ['unclear','help-needed','useful'] as const) {
        if(events.some(item=>item.kind===kind))summary[kind==='help-needed'?'helpNeeded':kind]++;
      }
    }
  }
  return result;
}

export function buildPilotReport(sessions:readonly PilotSession[],mode:'imported'|'demo') {
  return {schemaVersion:1,pilot:'san-antonio-a-b',catalogVersion:1,mode,
    provenance:mode==='demo'?'Datos sintéticos. No representan resultados del Metro.':'Sesiones importadas, procedencia declarada y no verificada.',
    summary:summarizePilot(sessions),
    baseline:summarizePilot(sessions.filter(session=>session.context==='field' && session.phase==='baseline')),
    assisted:summarizePilot(sessions.filter(session=>session.context==='field' && session.phase==='assisted')),
    limitations:[
      'Una sesión no equivale a una persona única; no mide demanda ni congestión.',
      'El denominador es el número de sesiones que respondieron en cada etapa. Sin respuestas no hay tasa calculable.',
      'Se pueden elegir varias categorías; los porcentajes no tienen que sumar 100%.',
      'La comparación es descriptiva, sin causalidad ni garantía de representatividad; requiere un protocolo de campo comparable.',
      'Las sesiones de práctica y las de fase sin asignar se excluyen de la comparación de campo.',
    ]};
}
