function LoadingState({ label = 'Loading market data...' }) {
  return (
    <div className="panel panel-hover flex min-h-[220px] animate-fade-in-up flex-col gap-5 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <div className="brand-badge">StockPulse</div>
          <div className="skeleton h-8 w-48" />
        </div>
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-400/20 border-t-emerald-300" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
      <p className="text-sm leading-6 text-slate-400">{label}</p>
    </div>
  );
}

export default LoadingState;
