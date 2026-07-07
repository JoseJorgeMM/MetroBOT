import React from 'react';
import { Star, MapPin } from 'lucide-react';
import { useFavorites, type FavoritePlace } from '../hooks/useFavorites';

interface QuickPicksBarProps {
  onPickFavorite: (fav: FavoritePlace) => void;
  hidden?: boolean;
}

export function QuickPicksBar({ onPickFavorite, hidden }: QuickPicksBarProps) {
  const { favorites, remove } = useFavorites();

  if (hidden) return null;
  if (favorites.length === 0) return null;

  return (
    <div className="absolute top-3 left-3 right-3 lg:right-[29rem] z-[1100] pointer-events-none">
      <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-lg border border-border/60 px-3 py-2 pointer-events-auto max-h-[18dvh] overflow-y-auto">
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
                title={f.name + (f.address ? ' (' + f.address + ')' : '')}
              >
                <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label={'Quitar ' + f.name + ' de favoritos'}
                className="min-h-[28px] min-w-[28px] w-7 h-7 rounded-full text-amber-700 dark:text-amber-300 hover:bg-amber-200/60 dark:hover:bg-amber-900/40 inline-flex items-center justify-center cursor-pointer"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}