const styles = {
  'Very High Probability': 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200',
  'High Probability': 'border-lime-400/40 bg-lime-400/12 text-lime-200',
  'Moderate Probability': 'border-amber-400/40 bg-amber-400/12 text-amber-200',
  'Low Probability': 'border-orange-400/40 bg-orange-400/12 text-orange-200',
  Avoid: 'border-rose-400/40 bg-rose-400/12 text-rose-200',
};

function ProbabilityBadge({ label }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${styles[label] ?? styles.Avoid}`}>
      {label}
    </span>
  );
}

export default ProbabilityBadge;
