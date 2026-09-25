import { CloudRain, CloudSun } from 'lucide-react';
import type { WeatherData } from '../lib/weather';

export function WeatherSummary({ weather }: { weather: WeatherData | null }) {
  if (!weather) return <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Clima no disponible por ahora.</p>;
  const Icon = weather.isRaining ? CloudRain : CloudSun;
  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 shrink-0 text-sitva-green" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{Math.round(weather.temperature)} °C · {weather.description}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Medellín · <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>{weather.checkedAt ? ` · Consulta ${new Date(weather.checkedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
        </div>
      </div>
      {weather.isRaining && <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">Lleva protección para la lluvia. Al elegir tu ruta, compara cuánto tendrás que caminar.</p>}
    </div>
  );
}
