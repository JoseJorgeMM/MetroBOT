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
    <div className="mt-3 overflow-x-auto pb-1" aria-label="Destinos favoritos">
      <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
        <span className="inline-flex h-11 shrink-0 items-center gap-1.5 px-1 text-xs font-bold text-slate-500 dark:text-slate-300">
          <Star className="h-4 w-4" aria-hidden="true" /> Favoritos
        </span>
        {favorites.slice(0, 8).map((favorite) => (
          <div
            key={favorite.id}
            className="inline-flex h-11 shrink-0 items-center overflow-hidden rounded-full border border-amber-200/60 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"
          >
            <button
              type="button"
              onClick={() => onPickFavorite(favorite)}
              className="inline-flex h-11 max-w-[180px] items-center gap-1.5 px-3 text-xs font-semibold text-foreground"
              title={favorite.name + (favorite.address ? ' (' + favorite.address + ')' : '')}
            >
              <MapPin className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span className="truncate">{favorite.name}</span>
            </button>
            <button
              type="button"
              onClick={() => remove(favorite.id)}
              aria-label={'Quitar ' + favorite.name + ' de favoritos'}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center border-l border-amber-200/60 text-amber-700 hover:bg-amber-200/60 dark:border-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
