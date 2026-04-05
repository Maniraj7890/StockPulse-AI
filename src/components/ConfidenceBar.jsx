function ConfidenceBar({ value = 0 }) {
  const safeValue = Math.max(0, Math.min(100, value));
  const tone =
    safeValue >= 75
      ? 'from-emerald-400 to-lime-300'
      : safeValue >= 55
        ? 'from-amber-400 to-yellow-300'
        : 'from-slate-500 to-slate-400';

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-500">
        <span>Confidence</span>
        <span>{safeValue}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tone} transition-all duration-300`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

export default ConfidenceBar;
