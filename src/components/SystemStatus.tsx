import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface LineStatus {
  line: string;
  system: string;
  status: 'normal' | 'warning' | 'suspended';
  message: string;
}

export function SystemStatus() {
  const [lines, setLines] = useState<LineStatus[]>([
    { line: 'A', system: 'Metro', status: 'normal', message: 'Operación Normal' },
    { line: 'B', system: 'Metro', status: 'normal', message: 'Operación Normal' },
    { line: '1', system: 'Metroplús', status: 'normal', message: 'Operación Normal' },
    { line: 'K', system: 'Cable', status: 'normal', message: 'Operación Normal' },
    { line: 'J', system: 'Cable', status: 'warning', message: 'Retrasos por clima' },
    { line: 'T', system: 'Tranvía', status: 'normal', message: 'Operación Normal' },
  ]);

  // Mock real-time updates
  useEffect(() => {
    const timer = setInterval(() => {
      setLines(prev => prev.map(l => {
        if (Math.random() > 0.95) {
           return { ...l, status: Math.random() > 0.5 ? 'warning' : 'normal', message: Math.random() > 0.5 ? 'Alta afluencia' : 'Operación Normal' };
        }
        return l;
      }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="border-border/30 bg-card shadow-lg overflow-hidden mt-4">
      <CardHeader className="bg-slate-50 dark:bg-slate-900/50 pb-2 border-b border-border/10">
        <CardTitle className="text-[12px] font-bold flex items-center justify-between text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Estado del Sistema
          </div>
          <div className="flex items-center gap-1 text-[10px] lowercase font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-sitva-green animate-pulse" />
            En vivo
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {lines.map((l, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-border/5">
              <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] text-white ${
                l.system === 'Metro' ? 'bg-sitva-green' : 
                l.system === 'Cable' ? 'bg-sitva-red' : 
                l.system === 'Metroplús' ? 'bg-sitva-blue' : 'bg-slate-500'
              }`}>
                {l.line}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {l.status === 'normal' ? <CheckCircle2 className="w-2.5 h-2.5 text-sitva-green" /> : <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />}
                  <span className="text-[10px] font-bold truncate text-foreground">{l.message}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1 text-[9px] text-slate-400 font-medium">
          <Clock className="w-3 h-3" />
          Actualizado hace 1 minuto
        </div>
      </CardContent>
    </Card>
  );
}
