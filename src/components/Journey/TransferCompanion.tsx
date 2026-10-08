import {useEffect,useRef,useState} from 'react';
import {Camera,GitBranch,ShieldCheck} from 'lucide-react';
import {loadTransferCatalog,type TransferCatalog} from '../../lib/transferCatalog';
import {assessSign,summarizeObservations,type TransferObservation} from '../../lib/transfers';

const button='min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50';

export function TransferCompanion(){
 const [open,setOpen]=useState(false);
 return <section className="my-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4" aria-label="MetroBOT Conexiones">
  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><GitBranch size={18}/><span className="text-xs font-bold uppercase tracking-wider">Conexiones · piloto</span></div>
  <h3 className="mt-2 text-lg font-bold">¿Qué señal corresponde a tu conexión?</h3>
  <p className="mt-1 text-sm text-muted-foreground">San Antonio · A → B hacia San Javier. Comprueba referencias de una señal, sin un chat.</p>
  <button type="button" className={`${button} mt-3 w-full`} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'Cerrar piloto de transbordo':'Explorar conexión San Antonio'}</button>
  {open&&<TransferSession/>}
 </section>;
}

function TransferSession(){
 const [catalog,setCatalog]=useState<TransferCatalog|null>(null);
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 const [text,setText]=useState('');const [result,setResult]=useState<ReturnType<typeof assessSign>|null>(null);
 const [image,setImage]=useState<string|null>(null); const [consent,setConsent]=useState(false);
 const [method,setMethod]=useState<'manual'|'gemini'|'gemini-edited'|null>(null);
 const [retained,setRetained]=useState(false);
 const [participate,setParticipate]=useState(false);
 const [events,setEvents]=useState<TransferObservation[]>([]);
 const [stage,setStage]=useState<TransferObservation['stage']>('connection');
 const request=useRef<AbortController|null>(null);const generation=useRef(0);
 useEffect(()=>{const controller=new AbortController();loadTransferCatalog(controller.signal).then(setCatalog).catch(()=>{if(!controller.signal.aborted)setError('No se pudo cargar la documentación. Cierra y vuelve a abrir el piloto.');});return()=>{controller.abort();request.current?.abort();generation.current++;};},[]);
 function invalidate(){generation.current++;request.current?.abort();request.current=null;setBusy(false);setResult(null);setError('');}
 async function chooseFile(file?:File){
  invalidate();setImage(null);setConsent(false);setText('');setMethod(null);setRetained(false);
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('Elige JPG, PNG o WebP de hasta 10 MB.');return;}
  const token=generation.current;
  try{
   const bitmap=await createImageBitmap(file);
   try{
    const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error();
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const encoded=canvas.toDataURL('image/jpeg',0.85);
    if(token===generation.current)setImage(encoded);
   }finally{bitmap.close();}
  }catch{if(token===generation.current)setError('No se pudo abrir la imagen. Prueba otra o escribe el texto de la señal.');}
 }
 async function readSign(){
  if(!image||!consent||!catalog)return;
  invalidate();setRetained(!!text);const token=generation.current;const controller=new AbortController();request.current=controller;setBusy(true);
  const timer=setTimeout(()=>controller.abort(),16000);
  try{
   const response=await fetch('/api/transfer-sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mimeType:'image/jpeg',data:image.split(',')[1]}),signal:controller.signal});
   const data=await response.json();
   if(!response.ok){throw new Error(data.code==='CONFIGURATION'?'El reconocimiento visual no está configurado. Puedes comprobar el texto manualmente.':data.code==='RATE_LIMIT'?'Se alcanzó el límite temporal. Prueba más tarde.':'No se pudo leer la señal. Usa otra imagen o la comprobación manual.');}
   if(data.provider!=='gemini'||typeof data.visibleText!=='string'||data.visibleText.length>2000)throw new Error('Respuesta visual inválida. No se usará para orientarte.');
   if(token!==generation.current)return;
   setText(data.visibleText);setMethod('gemini');setRetained(false);
   // A person must review the transcription before any compatibility result.
  }catch(e){if(token===generation.current)setError(controller.signal.aborted?'Se agotó el tiempo de lectura. Puedes intentarlo de nuevo.':e instanceof Error?e.message:'No se pudo leer la señal.');}
  finally{clearTimeout(timer);if(token===generation.current){setBusy(false);request.current=null;}}
 }
 function record(kind:TransferObservation['kind']){if(participate)setEvents(old=>old.some(e=>e.stage===stage&&e.kind===kind)?old:[...old,{stage,kind}]);}
 function exportReport(){
  const report={schemaVersion:1,pilot:'san-antonio-a-b',scope:'Una sesión local; no representa demanda ni usuarios únicos',catalogVersion:catalog?.version,summary:summarizeObservations(events),observations:events};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='metrobot-conexiones-observaciones.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="mt-4 space-y-4 border-t border-border pt-4">
  {!catalog?<p role="status">{error||'Cargando fuentes del piloto…'}</p>:<>
   <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Piloto independiente, no servicio oficial del Metro. No es navegación interior ni confirma que puedas abordar.</p>
   <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Conexión documentada</p><p className="mt-1 font-bold">{catalog.target}</p><p className="mt-2 text-sm">{catalog.facts[1]}</p></div>
   <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Fuentes y límites de esta conexión</summary>
    <p className="text-xs text-muted-foreground">Consulta documental: {catalog.reviewedAt}. No es una inspección presencial.</p>
    <ul className="my-3 list-disc space-y-2 pl-5 text-sm">{catalog.unknowns.map(s=><li key={s}>{s}</li>)}</ul>
    <p className="text-sm">{catalog.notice}</p>
    <ul className="mt-3 space-y-3">{catalog.sources.map(s=><li key={s.url}><a className="text-sm underline" href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a><p className="text-xs text-muted-foreground">{s.supports}</p></li>)}</ul>
   </details>
   <div className="rounded-xl border border-border p-3">
    <h4 className="flex items-center gap-2 font-semibold"><Camera size={18}/> Leer una señal con IA</h4>
    <p className="my-2 text-xs leading-relaxed text-muted-foreground">Detente en un lugar seguro. Elige una foto de una sola señal, sin personas ni datos personales. La foto no ubica tu posición.</p>
    <label className="block text-sm">Foto de la señal<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void chooseFile(file);}} className="mt-2 block w-full min-w-0 text-sm file:mr-2 file:min-h-11 file:rounded-lg file:border-0 file:px-3"/></label>
    {image&&<><img src={image} alt="Vista previa de la señal seleccionada" className="my-3 max-h-48 w-full rounded-lg object-contain"/><button type="button" className={button} onClick={()=>{invalidate();setImage(null);setText('');setMethod(null);setRetained(false);setConsent(false);}}>Quitar foto</button></>}
    <label className="my-3 flex min-h-11 items-start gap-2 text-xs leading-relaxed"><input type="checkbox" checked={consent} onChange={e=>{invalidate();setConsent(e.target.checked);}} className="mt-1"/>Autorizo enviar esta foto a Gemini mediante el servidor para transcribir la señal. No se guarda en MetroBOT; aplican las políticas del proveedor.</label>
    <button type="button" className={`${button} w-full`} disabled={!image||!consent||busy} onClick={()=>void readSign()}>{busy?'Leyendo señal…':'Leer foto con Gemini'}</button>
    {busy&&<button type="button" className={`${button} mt-2`} onClick={invalidate}>Cancelar lectura</button>}
   </div>
   {retained&&<p className="text-xs text-muted-foreground">Se conserva el texto anterior; no es una nueva transcripción.</p>}
   <label className="block text-sm font-medium">{method==='gemini'?'Revisa la transcripción de Gemini':method==='gemini-edited'?'Revisa la transcripción de Gemini editada por ti':'Escribe el texto de una sola señal (sin IA)'}<textarea rows={3} maxLength={2000} value={text} onChange={e=>{invalidate();setText(e.target.value);setMethod(old=>old==='gemini'||old==='gemini-edited'?'gemini-edited':'manual');}} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-base" placeholder="Transcribe la línea y el destino tal como aparecen"/></label>
   <button type="button" className={`${button} w-full`} disabled={!text.trim()||busy} onClick={()=>{setResult(assessSign(text));if(!method)setMethod('manual');}}>He revisado el texto · comprobar referencias</button>
   {error&&<p role="alert" className="text-sm text-amber-800 dark:text-amber-200">{error}</p>}
   {result&&<div role="status" className="rounded-xl border border-border bg-background p-4"><ShieldCheck className="mb-2 h-5 w-5"/><p className="font-semibold">{result.status==='compatible'?'Referencias compatibles':result.status==='conflicting'?'Referencias distintas o ambiguas':'No hay evidencia suficiente'}</p><p className="mt-2 text-sm">{result.message}</p><p className="mt-2 text-xs text-muted-foreground">No confirma ubicación, flecha, pasillo ni andén. Sigue la señalización vigente y consulta al personal si tienes dudas.</p></div>}
   <details className="border-t border-border pt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Evaluar esta experiencia · sesión local</summary>
    <p className="text-xs text-muted-foreground">No es un reporte enviado al Metro ni una medición de congestión. Solo registra categorías elegidas; sin fotos, texto, GPS ni identidad. Se borra al cerrar el piloto salvo que descargues el archivo.</p>
    <label className="my-3 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={participate} onChange={e=>{setParticipate(e.target.checked);if(!e.target.checked)setEvents([]);}}/>Participar en la evaluación local</label>
    {participate&&<><label className="block text-sm">Momento evaluado<select value={stage} onChange={e=>setStage(e.target.value as TransferObservation['stage'])} className="my-2 min-h-11 w-full rounded-xl border border-border bg-background px-3"><option value="connection">Comprender la conexión</option><option value="sign">Comprobar una señal</option></select></label><div className="flex flex-wrap gap-2">{([['unclear','No fue claro'],['help-needed','Necesité ayuda'],['useful','Me resultó útil']] as const).map(([kind,label])=><button type="button" key={kind} className={button} disabled={events.some(e=>e.stage===stage&&e.kind===kind)} onClick={()=>record(kind)}>{label}</button>)}</div></>}
    <p role="status" className="my-3 text-xs">{events.length} observaciones en esta sesión. No equivalen a personas diferentes.</p>
    <button type="button" className={button} disabled={!events.length} onClick={exportReport}>Descargar observaciones JSON</button>
    <button type="button" className={`${button} ml-2`} disabled={!events.length} onClick={()=>setEvents([])}>Borrar observaciones</button>
   </details>
  </>}
 </div>;
}
