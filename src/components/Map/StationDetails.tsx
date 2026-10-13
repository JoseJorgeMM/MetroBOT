import { ExternalLink, MapPin, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { stationSystem, type RouteStop, type nearbyStations } from '../../lib/routeStations';

function scheduledTime(time?: string) {
  if (!time || !Number.isFinite(Date.parse(time))) return undefined;
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Bogota' }).format(new Date(time));
}

export function StationDetails({ stop, nearby, source, onNearby }: {
  stop: RouteStop; nearby: ReturnType<typeof nearbyStations>; source?: 'google' | 'local';
  onNearby?: (station: NonNullable<RouteStop['station']>) => void;
}) {
  const station = stop.station;
  return <div className="space-y-4 rounded-xl bg-card p-3 text-sm text-foreground [&_p]:!m-0">
    <header>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">{station ? stationSystem(station.sistema) : 'Parada de transporte'}</p>
      <h3 className="text-xl font-bold leading-tight text-foreground">{stop.name}</h3>
      {station?.linea && station.sistema !== 'EnCicla' && <p className="mt-1 text-muted-foreground">Línea {station.linea} · Catálogo local</p>}
    </header>
    {stop.visits.map((visit, index) => <div key={`${visit.stepIndex}-${index}`} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
      <div className="flex items-center gap-2 font-semibold text-emerald-900">
        {visit.role === 'Baja aquí' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
        {visit.role}{visit.line && <span className="ml-auto rounded bg-white px-2 py-1 text-xs">{visit.line}</span>}
      </div>
      {visit.headsign && <p className="mt-1">Hacia {visit.headsign}</p>}
      {scheduledTime(visit.time) && <p className="mt-1">Hora indicada: <strong>{scheduledTime(visit.time)}</strong> · Colombia</p>}
    </div>)}
    {stop.visits.length > 0 && <p className="text-xs text-muted-foreground">{source === 'google' ? 'Trayecto y horas: Google Maps. No indica la posición del vehículo en vivo.' : 'Trayecto del planificador local.'}</p>}
    {station?.address && <p className="flex gap-2"><MapPin size={18} className="shrink-0" />{station.address}</p>}
    {station?.sistema === 'EnCicla' && <div className="rounded-xl bg-muted/50 p-3">
      {station.stationType && <p>Tipo registrado: {station.stationType}</p>}
      {station.capacity !== undefined && <p>Capacidad registrada: {station.capacity} anclajes</p>}
      <p className="mt-2 text-xs text-muted-foreground">Catálogo local: no es disponibilidad en tiempo real. Comprueba bicicletas y anclajes antes de viajar.</p>
    </div>}
    <section aria-label="Calidad de datos" className="rounded-xl border border-border bg-muted/40 p-3">
      <p className="text-xs font-semibold text-foreground">Datos disponibles: catálogo local</p>
      <p className="mt-1 text-xs text-muted-foreground">Estado operativo no conectado. Horarios de apertura, accesibilidad y disponibilidad deben confirmarse con la fuente oficial.</p>
    </section>
    {nearby.length > 0 && <section aria-label="Estaciones cercanas">
      <h4 className="font-semibold text-foreground">Otros puntos cercanos</h4>
      <p className="mb-2 text-xs text-muted-foreground">Distancia en línea recta; no confirma acceso ni transbordo.</p>
      <ul className="divide-y divide-border">{nearby.map(({ station: next, distance }) => <li key={`${next.sistema}:${next.id}`}>
        {onNearby ? <button type="button" onClick={() => onNearby(next)} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left hover:text-emerald-700">
          <span>{next.nombre}<small className="block text-muted-foreground">{stationSystem(next.sistema)}</small></span><span className="shrink-0 text-xs">{Math.round(distance)} m →</span>
        </button> : <span className="block py-2">{next.nombre} · {stationSystem(next.sistema)} · {Math.round(distance)} m</span>}
      </li>)}</ul>
    </section>}
    <a href={`https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-3 py-2 font-semibold !text-background">
      Ver ubicación en Google Maps <ExternalLink size={16} />
    </a>
  </div>;
}
