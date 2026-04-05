const styles = {
  'BUY NOW': 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200',
  'WAIT FOR BREAKOUT': 'border-amber-400/40 bg-amber-400/12 text-amber-200',
  'WAIT FOR PULLBACK': 'border-yellow-400/40 bg-yellow-400/12 text-yellow-200',
  'SUPPORT BOUNCE': 'border-sky-400/40 bg-sky-400/12 text-sky-200',
  AVOID: 'border-rose-400/40 bg-rose-400/12 text-rose-200',
};

function EntryTypeBadge({ type }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${styles[type] ?? styles.AVOID}`}
    >
      {type}
    </span>
  );
}

export default EntryTypeBadge;
