import React from 'react';
import { Star, Clock, MapPin } from 'lucide-react';
import { useFavorites, type FavoritePlace } from '../hooks/useFavorites';
import { useRecentSearches, type RecentEntry } from '../hooks/useRecentSearches';

interface QuickPicksBarProps {
  onPickFavorite: (fav: FavoritePlace) => void;
  onPickRecent: (entry: RecentEntry) => void;
  hidden?: boolean;
}

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return 'ahora';
  if (d < 3_600_000) return Math.floor(d / 60_000) + ' min';
  if (d < 86_400_000) return Math.floor(d / 3_600_000) + ' h';
  return Math.floor(d / 86_400_000) + ' d';
}

export function QuickPicksBar({ onPickFavorite, onPickRecent, hidden }: QuickPicksBarProps) {
  const { favorites, remove } = useFavorites();
  const { recents } = useRecentSearches();

  if (hidden) return null;
  if (favorites.length === 0 && recents.length === 0) return null;

  return (
    <div className="absolute top-3 left-3 right-3 lg:right-[29rem] z-[1100] pointer-events-none">
      <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-lg border border-border/60 px-3 py-2 pointer-events-auto max-h-[40dvh] overflow-y-auto">
        {favorites.length > 0 && (
          <div className="mb-1.5">
            <div className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
              <Star className="w-3 h-3" /> Favoritos
            </div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {favorites.slice(0, 8).map((f) => (
                <div
                  key={f.id}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 min-h-[32px]"
                >
                  <button
                    type="button"
                    onClick={() => onPickFavorite(f)}
                    className="inline-flex items-center gap-1 max-w-[180px] text-[12px] font-semibold text-foreground truncate cursor-pointer"
                    title={f.name}
                  >
                    <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    aria-label={'Quitar ' + f.name}
                    className="min-h-[28px] min-w-[28px] w-7 h-7 rounded-full text-amber-700 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-900/40 inline-flex items-center justify-center cursor-pointer"
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {recents.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3" /> Recientes
            </div>
            <div className="flex flex-wrap gap-1.5 px-1">
              {recents.slice(0, 8).map((r) => (
                <button
                  key={r.query + ':' + r.timestamp}
                  type="button"
                  onClick={() => onPickRecent(r)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 min-h-[32px] max-w-[220px] text-[12px] text-foreground truncate cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/70"
                  title={r.query}
                >
                  <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{r.query}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">{relTime(r.timestamp)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
