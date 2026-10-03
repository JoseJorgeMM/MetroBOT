import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MapPin, Sparkles, X } from 'lucide-react';
import type { PlaceValue } from '../TripPlannerPanel';
import { getStations, type Station } from '../../lib/stations';
import { requestJourneyIntent, stationCandidates } from '../../lib/journey/intent';
import { defaultNeeds, type JourneyNeeds } from '../../lib/journey/types';
import { NeedsControls } from './NeedsControls';

interface Props {
  origin:PlaceValue|null;destination:PlaceValue|null;needs:JourneyNeeds;
  onNeedsChange:(needs:JourneyNeeds)=>void;
  onPlan:(origin:PlaceValue,dest:PlaceValue)=>boolean;
  onManualPlan:(origin:PlaceValue|null,dest:PlaceValue|null,queries:{origin:string;destination:string})=>void;
  onClose:()=>void;
}
const examples=[
  '¿Cuánto vale un recorrido desde La Estrella hasta el Estadio?',
  'Desde Niquía hasta Poblado, tengo $5.000 y prefiero caminar poco.',
  'Desde Universidad hasta San Javier, máximo 1 transbordo y caminar máximo 10 minutos.',
];

function PlacePicker({label,text,place,stations,onText,onSelect}:{label:string;text:string;place:PlaceValue|null;stations:Station[];onText:(value:string)=>void;onSelect:(station:Station)=>void}) {
  const candidates=place?[]:stationCandidates(text,stations);
  return <div>
    <label className="block text-sm font-medium">{label}
      <input value={text} onChange={e=>onText(e.target.value)} placeholder="Busca una estación" autoComplete="off" className="mt-1 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base" />
    </label>
    {place ? <p className="mt-1 text-xs text-sitva-green dark:text-green-300">Punto seleccionado · {place.name}</p>
      : text && <div className="mt-1 overflow-hidden rounded-xl border border-border" aria-label={`Coincidencias de ${label.toLowerCase()}`}>
        {candidates.map(s=><button key={s.id} type="button" onClick={()=>onSelect(s)} className="flex min-h-12 w-full items-center gap-2 border-b border-border/50 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted focus-visible:bg-muted">
          <MapPin className="h-4 w-4 shrink-0 text-sitva-green" aria-hidden="true"/><span>{s.nombre}<small className="block text-xs text-muted-foreground">{s.sistema}{s.linea?` · Línea ${s.linea}`:''}</small></span>
        </button>)}
        {!candidates.length && <p className="p-3 text-xs text-muted-foreground">Sin coincidencia en el catálogo. Usa «Buscar otra dirección» para elegir un lugar o marcarlo en el mapa.</p>}
      </div>}
  </div>;
}

export function JourneyStudio({origin,destination,needs,onNeedsChange,onPlan,onManualPlan,onClose}:Props) {
  const [query,setQuery]=useState('');
  const [stations,setStations]=useState<Station[]>([]);
  const [start,setStart]=useState(origin); const [end,setEnd]=useState(destination);
  const [startText,setStartText]=useState(origin?.name||'');const [endText,setEndText]=useState(destination?.name||'');
  const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [notes,setNotes]=useState<string[]>([]);
  const [provider,setProvider]=useState<'gemini'|'local'|null>(null);
  const abort=useRef<AbortController|null>(null);
  useEffect(()=>{let active=true;getStations().then(value=>{if(active)setStations(value);}).catch(()=>{if(active)setNotice('No se pudo cargar el catálogo. Puedes usar el planificador y el mapa.');});return()=>{active=false;abort.current?.abort();};},[]);
  const invalidate=()=>{abort.current?.abort();abort.current=null;setBusy(false);};
  const editQuery=(value:string)=>{invalidate();setQuery(value);setProvider(null);setNotice('');setNotes([]);setStart(null);setEnd(null);setStartText('');setEndText('');onNeedsChange(defaultNeeds);};
  async function interpret() {
    invalidate();const controller=new AbortController();abort.current=controller;setBusy(true);setNotice('');
    try {
      const result=await requestJourneyIntent(query,controller.signal);
      if(controller.signal.aborted)return;
      const {intent}=result;onNeedsChange(intent);setProvider(result.provider);setNotice(result.notice);setNotes(intent.notes);
      setStartText(intent.origin||'');setEndText(intent.destination||'');setStart(null);setEnd(null);
    } catch {if(!controller.signal.aborted)setNotice('No pudimos interpretar la solicitud. Completa los puntos y condiciones.');}
    finally {if(abort.current===controller){setBusy(false);abort.current=null;}}
  }
  const select=(s:Station):PlaceValue=>({name:`${s.nombre} · ${s.sistema}${s.linea?` ${s.linea}`:''}`,lat:s.lat,lng:s.lng});
  return <section aria-label="Diseña mi viaje" className="h-full min-h-0 overflow-y-auto bg-background p-4 pb-8 sm:p-5">
    <header className="mb-5 flex items-start justify-between gap-3">
      <div><h2 className="text-2xl font-bold tracking-tight">Un viaje a tu medida.</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Cuéntanos qué necesitas. Convierte tus prioridades en un recorrido que puedas comparar.</p></div>
      <button type="button" aria-label="Cerrar diseño de viaje" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"><X className="h-5 w-5"/></button>
    </header>
    <form onSubmit={e=>{e.preventDefault();void interpret();}} className="rounded-2xl border border-sitva-green/30 bg-sitva-green/5 p-4">
      <label htmlFor="journey-query" className="text-sm font-semibold">¿Qué necesitas para este viaje?</label>
      <textarea id="journey-query" rows={3} maxLength={1200} value={query} onChange={e=>editQuery(e.target.value)} placeholder="Voy de La Estrella al Estadio. Quiero saber cuánto cuesta y caminar poco." className="mt-2 w-full resize-y rounded-xl border border-border bg-background p-3 text-base leading-relaxed focus-visible:outline-sitva-green" />
      <button type="submit" disabled={!query.trim()||busy} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sitva-green px-4 font-semibold text-white disabled:opacity-50"><Sparkles className="h-4 w-4" aria-hidden="true"/>{busy?'Interpretando tus necesidades…':'Diseñar con IA'}</button>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Al pulsar, tu descripción se envía a Gemini para interpretar el viaje. No incluyas datos personales.</p>
    </form>
    {!provider && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-muted-foreground">Prueba una idea</summary><div className="space-y-2">{examples.map(example=><button type="button" key={example} onClick={()=>editQuery(example)} className="min-h-11 w-full rounded-xl border border-border p-3 text-left text-sm hover:bg-muted">{example}</button>)}</div></details>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-muted p-3 text-sm leading-relaxed">{notice}</p>}
    {notes.length>0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{notes.map((note,i)=><li key={i}>{note}</li>)}</ul>}
    <div className="my-5 space-y-4 border-b border-border pb-5">
      <h3 className="text-sm font-semibold">Confirma los puntos del recorrido</h3>
      <PlacePicker label="Origen del viaje" text={startText} place={start} stations={stations} onText={v=>{invalidate();setStartText(v);setStart(null);}} onSelect={s=>{invalidate();setStart(select(s));setStartText(s.nombre);}}/>
      <PlacePicker label="Destino del viaje" text={endText} place={end} stations={stations} onText={v=>{invalidate();setEndText(v);setEnd(null);}} onSelect={s=>{invalidate();setEnd(select(s));setEndText(s.nombre);}}/>
      <button type="button" onClick={()=>onManualPlan(start,end,{origin:startText,destination:endText})} className="min-h-11 text-sm font-semibold text-sitva-green dark:text-green-300">Buscar otra dirección o elegir en el mapa →</button>
    </div>
    <NeedsControls value={needs} onChange={value=>{invalidate();onNeedsChange(value);}}/>
    <button type="button" disabled={!start||!end||busy} onClick={()=>{if(start&&end&&!onPlan(start,end))setNotice('Hay una consulta en curso. Espera y vuelve a comparar.');}} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sitva-green px-4 font-semibold text-white disabled:opacity-50">Comparar recorridos reales <ArrowRight className="h-4 w-4" aria-hidden="true"/></button>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Después podrás ajustar el presupuesto, comparar el esfuerzo y explorar un plan B sobre las alternativas encontradas.</p>
  </section>;
}
