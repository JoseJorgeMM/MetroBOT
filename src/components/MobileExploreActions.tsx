type MobileExploreActionsProps = {
  onPlanTrip: () => void;
  onAskMetroBot: () => void;
};

export function MobileExploreActions({ onPlanTrip, onAskMetroBot }: MobileExploreActionsProps) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-label="Planear un viaje"
        className="min-h-12 w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white"
        onClick={onPlanTrip}
      >
        Planear un viaje
      </button>
      <button
        type="button"
        className="min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-900"
        onClick={onAskMetroBot}
      >
        Pregúntale a MetroBot
      </button>
    </div>
  );
}
