function PredictionDirectionBadge({ direction = 'SIDEWAYS', compact = false }) {
  const tone =
    direction === 'UP'
      ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200'
      : direction === 'DOWN'
        ? 'border-rose-400/40 bg-rose-400/12 text-rose-200'
        : 'border-slate-400/40 bg-slate-400/12 text-slate-200';

  return (
    <span
      className={`inline-flex rounded-full border font-semibold uppercase tracking-[0.18em] ${compact ? 'px-3 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'} ${tone}`}
    >
      {direction}
    </span>
  );
}

export default PredictionDirectionBadge;
