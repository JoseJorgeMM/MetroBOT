import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, Clock, Newspaper, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { fetchMetroNews, NewsItem } from '../lib/news';

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
    { line: 'J', system: 'Cable', status: 'normal', message: 'Operación Normal' },
    { line: 'T', system: 'Tranvía', status: 'normal', message: 'Operación Normal' },
  ]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function updateData() {
      setLoading(true);
      const latestNews = await fetchMetroNews();
      setNews(latestNews);
      
      if (latestNews.length > 0) {
        // Simple logic to detect issues in real news headlines
        const issuesFound: Record<string, { status: 'warning' | 'suspended', msg: string }> = {};
        
        // Only look at news from the last 12 hours for status
        const now = new Date();
        const recentNews = latestNews.filter(n => {
          const pubDate = new Date(n.pubDate);
          return (now.getTime() - pubDate.getTime()) < 12 * 60 * 60 * 1000;
        });

        recentNews.forEach(n => {
          const title = n.title.toLowerCase();
          let status: 'warning' | 'suspended' = 'warning';
          let msg = '';

          if (title.includes('cierre') || title.includes('cerrada') || title.includes('fuera de servicio')) {
            status = 'suspended';
            msg = 'Cierre reportado';
          } else if (title.includes('falla') || title.includes('retraso') || title.includes('inconveniente') || title.includes('problemas técnico')) {
            status = 'warning';
            msg = 'Retrasos';
          }

          if (msg) {
            if (title.includes('línea a')) issuesFound['A'] = { status, msg };
            if (title.includes('línea b')) issuesFound['B'] = { status, msg };
            if (title.includes('línea k')) issuesFound['K'] = { status, msg };
            if (title.includes('línea j')) issuesFound['J'] = { status, msg };
            if (title.includes('línea t')) issuesFound['T'] = { status, msg };
            if (title.includes('metroplús') || title.includes('línea 1')) issuesFound['1'] = { status, msg };
          }
        });

        setLines(prev => prev.map(l => {
          if (issuesFound[l.line]) {
            return { ...l, status: issuesFound[l.line].status, message: issuesFound[l.line].msg };
          }
          return { ...l, status: 'normal', message: 'Operación Normal' };
        }));
      }
      setLoading(false);
    }

    updateData();
    const timer = setInterval(updateData, 300000); // Actualizar cada 5 minutos
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
            <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-slate-400' : 'bg-sitva-green animate-pulse'}`} />
            Real-time News
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

        {news.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/10">
            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-slate-500 uppercase">
              <Newspaper className="w-3 h-3" />
              Últimas Noticias
            </div>
            <div className="space-y-2">
              {news.slice(0, 2).map((item, idx) => (
                <a 
                  key={idx} 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <p className="text-[10px] leading-tight text-foreground/80 group-hover:text-sitva-blue transition-colors line-clamp-2">
                    {item.title}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[8px] text-slate-400">{new Date(item.pubDate).toLocaleDateString()}</span>
                    <ExternalLink className="w-2 h-2 text-slate-300 group-hover:text-sitva-blue" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-1 text-[9px] text-slate-400 font-medium">
          <Clock className="w-3 h-3" />
          {loading ? 'Actualizando...' : 'Datos reales de Google News'}
        </div>
      </CardContent>
    </Card>
  );
}
