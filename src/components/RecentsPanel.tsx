import React from 'react';
import { Clock, MapPin, Star, Trash2, X } from 'lucide-react';
import { useFavorites, type FavoritePlace } from '../hooks/useFavorites';
import { useRecentSearches, type RecentEntry } from '../hooks/useRecentSearches';

interface RecentsPanelProps {
  onPickFavorite: (fav: FavoritePlace) => void;
  onPickRecent: (entry: RecentEntry) => void;
}

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return 'ahora';
  if (d < 3_600_000) return Math.floor(d / 60_000) + ' min';
  if (d < 86_400_000) return Math.floor(d / 3_600_000) + ' h';
  return Math.floor(d / 86_400_000) + ' d';
}

export function RecentsPanel({ onPickFavorite, onPickRecent }: RecentsPanelProps) {
  const { favorites, remove, has } = useFavorites();
  const { recents } = useRecentSearches();

  if (favorites.length === 0 && recents.length === 0) {
    return (
      <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
        Busca un lugar para ver tus favoritos y busquedas recientes aqui.
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1 py-1">
      {favorites.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            <Star className="w-3 h-3" /> Favoritos
          </div>
          <div className="flex flex-wrap gap-1.5 px-1">
            {favorites.map((f) => (
              <div
                key={f.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 min-h-[36px]"
              >
                <button
                  type="button"
                  onClick={() => onPickFavorite(f)}
                  className="inline-flex items-center gap-1 max-w-[180px] text-sm font-semibold text-foreground truncate cursor-pointer"
                  title={f.name + (f.address ? ' (' + f.address + ')' : '')}
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  aria-label={'Quitar ' + f.name + ' de favoritos'}
                  className="min-h-[32px] min-w-[32px] w-8 h-8 rounded-full text-amber-700 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-900/40 inline-flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {recents.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3" /> Recientes
          </div>
          <div className="flex flex-wrap gap-1.5 px-1">
            {recents.map((r) => (
              <button
                key={r.query + ':' + r.timestamp}
                type="button"
                onClick={() => onPickRecent(r)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 min-h-[36px] max-w-[260px] text-sm text-foreground truncate cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700/70"
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
  );
}
