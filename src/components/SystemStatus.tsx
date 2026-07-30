import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, ExternalLink, HelpCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { getLiveMetroStatus } from '../lib/gemini';
import type { LiveMetroStatus } from '../lib/liveMetroStatus';

interface LineStatus {
  line: string;
  system: string;
  status: 'normal' | 'warning' | 'unknown';
  message: string;
}

const initialLines: LineStatus[] = [
  { line: 'A', system: 'Metro', status: 'unknown', message: 'No verificado' },
  { line: 'B', system: 'Metro', status: 'unknown', message: 'No verificado' },
  { line: '1', system: 'Metroplús', status: 'unknown', message: 'No verificado' },
  { line: 'K', system: 'Cable', status: 'unknown', message: 'No verificado' },
  { line: 'J', system: 'Cable', status: 'unknown', message: 'No verificado' },
  { line: 'T', system: 'Tranvía', status: 'unknown', message: 'No verificado' },
];

function lineIsAffected(line: string, affectedLines: string[]): boolean {
  return affectedLines.some(item => {
    const normalized = item.toLowerCase().replace(/^línea\s+|^linea\s+/, '').trim();
    return normalized === line.toLowerCase();
  });
}

function applyLiveStatus(status: LiveMetroStatus): LineStatus[] {
  return initialLines.map(line => {
    if (status.status === 'normal') return { ...line, status: 'normal', message: 'Operación normal' };
    if (status.status === 'alerta' && lineIsAffected(line.line, status.affectedLines)) {
      return { ...line, status: 'warning', message: 'Novedad reportada' };
    }
    if (status.status === 'alerta') return { ...line, status: 'normal', message: 'Sin novedad reportada' };
    return { ...line, status: 'unknown', message: 'No verificado' };
  });
}

export function SystemStatus() {
  const [status, setStatus] = useState<LiveMetroStatus | null>(null);
  const [lines, setLines] = useState<LineStatus[]>(initialLines);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const updateData = async () => {
      setLoading(true);
      const result = await getLiveMetroStatus();
      if (!cancelled) {
        setStatus(result);
        setLines(applyLiveStatus(result));
        setLoading(false);
      }
    };
    void updateData();
    const timer = window.setInterval(() => void updateData(), 300000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const statusLabel = loading ? 'Consultando Google Search' : status?.status === 'normal' ? 'Verificado' : status?.status === 'alerta' ? 'Novedad' : 'No verificado';
  const statusColor = status?.status === 'normal' ? 'bg-sitva-green' : status?.status === 'alerta' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <Card className="border-border/30 bg-card shadow-lg overflow-hidden mt-4">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/50 pb-2 border-b border-border/10">
        <CardTitle className="text-[12px] font-bold flex items-center justify-between text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Estado del Sistema</div>
          <div className="flex items-center gap-1 text-[10px] lowercase font-medium">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor} ${loading ? '' : 'animate-pulse'}`} /> {statusLabel}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {lines.map(line => (
            <div key={line.line} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-border/5">
              <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] text-white ${line.system === 'Metro' ? 'bg-sitva-green' : line.system === 'Cable' ? 'bg-sitva-red' : 'bg-sitva-blue'}`}>
                {line.line}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-1">
                {line.status === 'normal' ? <CheckCircle2 className="w-2.5 h-2.5 text-sitva-green shrink-0" /> : line.status === 'warning' ? <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0" /> : <HelpCircle className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                <span className="text-[10px] font-bold truncate text-foreground">{line.message}</span>
              </div>
            </div>
          ))}
        </div>

        {status && (
          <div className="mt-4 pt-3 border-t border-border/10 space-y-2">
            <p className="text-[11px] leading-tight text-foreground/85">{status.summary}</p>
            {status.affectedStations.length > 0 && <p className="text-[10px] text-amber-700 dark:text-amber-300">Estaciones: {status.affectedStations.join(', ')}</p>}
            {status.sources.length > 0 && (
              <div className="space-y-1">
                <div className="text-[9px] font-bold text-slate-500 uppercase">Fuentes consultadas</div>
                {status.sources.map(source => (
                  <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-sitva-blue hover:underline truncate">
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{source.title}{source.official ? ' · oficial' : ' · secundaria'}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-1 text-[9px] text-slate-400 font-medium">
          <Clock className="w-3 h-3" /> {loading ? 'Actualizando...' : `Consulta: ${new Date(status?.checkedAt || Date.now()).toLocaleTimeString('es-CO')}`}
        </div>
      </CardContent>
    </Card>
  );
}
