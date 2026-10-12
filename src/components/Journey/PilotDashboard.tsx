import {useRef,useState} from 'react';
import {buildPilotReport,mergePilotSessions,parsePilotSession,PILOT_BATCH_LIMIT,PILOT_FILE_LIMIT,PILOT_SESSION_LIMIT,type PilotSession} from '../../lib/pilotEvaluation';

const button='min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50';
const rate=(n:number,d:number)=>d?`${n}/${d} · ${Math.round(n/d*100)}%`:'Sin respuestas';
const stages=[['connection','Comprender conexión'],['sign','Comprobar señal']] as const;

export function PilotDashboard({onClose}:{onClose:()=>void}) {
 const [mode,setMode]=useState<'imported'|'demo'>('imported');
 const [sessions,setSessions]=useState<PilotSession[]>([]);
 const [demo,setDemo]=useState<PilotSession[]>([]);
 const [status,setStatus]=useState('');
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const report=buildPilotReport(mode==='demo'?demo:sessions,mode);
 async function showDemo(){
  if(lock.current)return;lock.current=true;setBusy(true);setStatus('');
  try {
   if(!demo.length){
    const response=await fetch('/transfers/pilot-demo.json');
    if(!response.ok)throw Error();
    const data=await response.json();
    if(data.mode!=='demo'||!Array.isArray(data.sessions)||data.sessions.length>PILOT_SESSION_LIMIT)throw Error();
    const validated=data.sessions.map((item:unknown)=>parsePilotSession(JSON.stringify(item),'demo'));
    const merged=mergePilotSessions([],validated);
    if(merged.conflicts||merged.duplicates)throw Error();
    setDemo(merged.sessions);
   }
   setMode('demo');
  }catch{setStatus('No se pudo cargar la demostración. Tus sesiones importadas no cambiaron.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function importFiles(files:File[]){
  if(lock.current)return;
  if(files.length>PILOT_BATCH_LIMIT){setStatus('Selecciona como máximo 20 archivos por lote.');return;}
  lock.current=true;setBusy(true);
  const incoming:PilotSession[]=[];let rejected=0;let reason='';
  for(const file of files){
   try{
    if(file.size>PILOT_FILE_LIMIT)throw Error('Máximo 128 KiB por archivo.');
    incoming.push(parsePilotSession(await file.text()));
   }catch(error){rejected++;reason=error instanceof Error?error.message:'No se pudo leer un archivo.';}
  }
  const merged=mergePilotSessions(sessions,incoming);
  setSessions(merged.sessions);setMode('imported');
  setStatus(`${merged.added} añadidas · ${merged.duplicates} duplicadas · ${merged.conflicts} conflictos rechazados · ${rejected} inválidas · ${merged.overflow} fuera del límite. ${reason}`);
  lock.current=false;setBusy(false);
 }
 function download(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`metrobot-piloto-${mode}-agregado.json`;
  try{a.click();}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
 }
 return <section aria-label="Evaluación del piloto" className="mt-4 space-y-4 rounded-xl border border-border bg-background p-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Evaluación del piloto</h3><button className={button} onClick={onClose}>Cerrar panel</button></div>
  <p className="text-xs text-muted-foreground">San Antonio · A → B. Evidencia local para evaluar un piloto, no un tablero operativo del Metro.</p>
  <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} aria-pressed={mode==='imported'} onClick={()=>{setMode('imported');setStatus('');}}>Ver sesiones importadas</button><button className={button} disabled={busy} aria-pressed={mode==='demo'} onClick={()=>void showDemo()}>Ver demostración</button></div>
  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-semibold">{report.provenance}</p>
  {mode==='imported'&&<>
   <label className="block text-sm font-medium">Importar sesiones JSON v2<input type="file" accept=".json,application/json" multiple disabled={busy} className="mt-2 block w-full min-w-0 text-xs file:min-h-11 file:rounded-lg file:border-0 file:px-2" onChange={async event=>{const files=Array.from(event.target.files??[]);event.target.value='';await importFiles(files);}}/></label>
   <p className="text-xs text-muted-foreground">Hasta 20 archivos por lote, 128 KiB por archivo y 100 sesiones. Se procesan en este dispositivo; no se envían ni guardan. Cerrar el panel las descarta.</p>
   {!sessions.length&&<p className="py-3 text-sm">Aún no hay sesiones importadas. Descarga observaciones desde «Evaluar esta experiencia» y selecciónalas aquí.</p>}
  </>}
  <p role="status" className="text-xs">{busy?'Procesando…':status}</p>
  <div className="grid grid-cols-3 gap-2">{[[report.summary.sessions,'Sesiones'],[report.summary.field,'Campo declarado'],[report.summary.practice,'Práctica']].map(([value,label])=><div key={label} className="rounded-xl bg-muted p-2"><p className="text-xl font-bold tabular-nums">{value}</p><p className="text-xs">{label}</p></div>)}</div>
  <h4 className="text-sm font-semibold">Respuestas por momento</h4>
  {stages.map(([key,label])=>{const stage=report.summary.stages[key];return <div key={key} className="rounded-xl border border-border p-3 text-sm"><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{stage.answered} sesiones respondieron en este momento</p><dl className="mt-2 space-y-1">{[['No fue claro',stage.unclear],['Necesité ayuda',stage.helpNeeded],['Me resultó útil',stage.useful]].map(([name,value])=><div key={name} className="flex flex-wrap justify-between gap-2"><dt>{name}</dt><dd className="tabular-nums">{rate(Number(value),stage.answered)}</dd></div>)}</dl>{stage.helpNeeded>0&&<p className="mt-3 text-xs text-muted-foreground">Prioridad de revisión: observar con personal del piloto dónde se solicita ayuda. Este conteo no identifica la causa.</p>}</div>;})}
  <h4 className="text-sm font-semibold">Referencia frente a asistencia</h4>
  <p className="text-xs text-muted-foreground">Solo campo declarado, catálogo v1. Práctica y fase sin asignar se excluyen. Se compara «Necesité ayuda», no una mejora causal.</p>
  {stages.map(([key,label])=><div key={key} className="rounded-lg bg-muted p-3 text-xs"><p className="font-semibold">{label}</p><p className="mt-1">Referencia: {rate(report.baseline.stages[key].helpNeeded,report.baseline.stages[key].answered)}</p><p>Asistida: {rate(report.assisted.stages[key].helpNeeded,report.assisted.stages[key].answered)}</p></div>)}
  <details className="text-xs"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Protocolo y límites de interpretación</summary><p className="mb-2">Acuerda con el Metro un protocolo de campo antes de medir: mismo punto de conexión, condiciones comparables y participación voluntaria. En referencia recoge respuestas sin usar el asistente; en asistida, después de usarlo. No registres varias sesiones de una misma experiencia.</p><ul className="list-disc space-y-2 pl-4">{report.limitations.map(item=><li key={item}>{item}</li>)}</ul><p className="mt-2">Los indicadores son conteos deterministas, no predicciones de IA. Importar de nuevo el mismo ID no aumenta el total; si cambia su contenido se rechaza el conflicto.</p></details>
  <div className="flex flex-wrap gap-2"><button className={button} disabled={!report.summary.sessions||busy} onClick={download}>Descargar informe agregado</button>{mode==='imported'&&<button className={button} disabled={!sessions.length||busy} onClick={()=>{setSessions([]);setStatus('Sesiones descartadas de este panel. Las copias descargadas no se eliminan.');}}>Vaciar sesiones importadas</button>}</div>
 </section>;
}
