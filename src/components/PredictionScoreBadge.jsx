function PredictionScoreBadge({ score }) {
  const tone =
    score >= 85
      ? 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200'
      : score >= 70
        ? 'border-lime-400/40 bg-lime-400/12 text-lime-200'
        : score >= 55
          ? 'border-amber-400/40 bg-amber-400/12 text-amber-200'
          : score >= 40
            ? 'border-orange-400/40 bg-orange-400/12 text-orange-200'
            : 'border-rose-400/40 bg-rose-400/12 text-rose-200';

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${tone}`}>
      {score}/100
    </span>
  );
}

export default PredictionScoreBadge;
