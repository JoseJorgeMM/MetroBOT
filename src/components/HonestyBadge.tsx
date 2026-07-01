// HonestyBadge.tsx
// -----------------------------------------------------------------------------
// Color-coded badge that summarizes route-validation confidence. Used in the
// chat UI next to Rutas Sugeridas. Accessible: role=status + aria-live.
// -----------------------------------------------------------------------------

import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { HonestyLevel } from '../lib/honesty';

export interface HonestyBadgeProps {
  level: HonestyLevel;
  worstRatio: number;
  label: string;
}

const STYLES: Record<HonestyLevel, { wrap: string; icon: typeof ShieldCheck }> = {
  confiable: { wrap: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', icon: ShieldCheck },
  parcial:   { wrap: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', icon: ShieldAlert },
  no_verificada: { wrap: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200', icon: ShieldAlert },
};

export function HonestyBadge({ level, worstRatio, label }: HonestyBadgeProps) {
  const style = STYLES[level];
  const Icon = style.icon;
  const pct = Math.round(worstRatio * 100);
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="honesty-badge"
      data-level={level}
      aria-label={label + ' (' + pct + '%)'}
      className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold ' + style.wrap}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      <span className="opacity-70">({pct}%)</span>
    </span>
  );
}
