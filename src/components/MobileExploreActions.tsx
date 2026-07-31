type MobileExploreActionsProps = {
  onPlanTrip: () => void;
  onAskMetroBot: () => void;
  layout?: 'stack' | 'row';
};

export function MobileExploreActions({
  onPlanTrip,
  onAskMetroBot,
  layout = 'stack',
}: MobileExploreActionsProps) {
  return (
    <div className={layout === 'row' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-3'}>
      <button
        type="button"
        aria-label="Planear un viaje"
        className="min-h-12 w-full rounded-xl bg-blue-700 px-3 py-3 text-sm font-semibold text-white"
        onClick={onPlanTrip}
      >
        Planear un viaje
      </button>
      <button
        type="button"
        aria-label="Pregúntale a MetroBot"
        className="min-h-12 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100"
        onClick={onAskMetroBot}
      >
        Pregúntale a MetroBot
      </button>
    </div>
  );
}
