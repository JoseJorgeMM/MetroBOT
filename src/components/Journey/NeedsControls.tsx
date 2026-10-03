import type { JourneyNeeds, JourneyPriority } from '../../lib/journey/types';

export const priorityNames: Record<JourneyPriority,string> = {
  balanced:'Equilibrar mi viaje',cost:'Gastar menos',duration:'Llegar más rápido',walking:'Caminar menos',transfers:'Hacer menos transbordos',
};
const limits = [
  ['maxCost','Presupuesto por viaje (COP)',1000000,100],
  ['maxWalkingMinutes','Caminata máxima (min)',1440,1],
  ['maxDurationMinutes','Tiempo máximo (min)',1440,1],
  ['maxTransfers','Máximo de transbordos',20,1],
] as const;

export function NeedsControls({value,onChange}:{value:JourneyNeeds;onChange:(value:JourneyNeeds)=>void}) {
  return <fieldset className="min-w-0 space-y-3">
    <legend className="mb-2 text-sm font-semibold">Lo que importa en este viaje</legend>
    <label className="block text-sm">Mi prioridad
      <select className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base" value={value.priority} onChange={e=>onChange({...value,priority:e.target.value as JourneyPriority})}>
        {Object.entries(priorityNames).map(([id,name])=><option value={id} key={id}>{name}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-2 gap-3">{limits.map(([key,label,max,step])=><label className="min-w-0 text-xs leading-relaxed text-muted-foreground" key={key}>{label}
      <input type="number" min={0} max={max} step={step} inputMode="numeric" placeholder="Sin límite" value={value[key]??''}
        onChange={e=>{const n=e.target.valueAsNumber;onChange({...value,[key]:Number.isFinite(n)?Math.min(max,Math.max(0,Math.round(n))):null});}}
        className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base text-foreground" />
    </label>)}</div>
    {!!value.notes?.length && <div className="rounded-xl bg-muted p-3 text-sm"><p className="font-semibold">Necesidades que requieren verificación</p><p className="mt-1 text-xs text-muted-foreground">Todavía no tenemos datos para comprobar estas condiciones.</p><ul className="mt-2 space-y-2">{value.notes.map((note,index)=><li key={`${index}-${note}`}><span>{note}</span><button type="button" className="block min-h-11 text-xs underline" onClick={()=>onChange({...value,notes:value.notes?.filter((_,i)=>i!==index)})}>Quitar esta condición: {note}</button></li>)}</ul></div>}
  </fieldset>;
}
