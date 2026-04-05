function EmptyState({ title, description, action }) {
  return (
    <div className="panel panel-hover signal-accent flex min-h-[220px] animate-fade-in-up flex-col items-center justify-center gap-4 p-6 text-center sm:p-8">
      <div className="brand-badge">StockPulse</div>
      <div className="space-y-2">
        <h3 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h3>
        <p className="max-w-md text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {action ? <div className="pt-1">{action}</div> : <p className="text-xs uppercase tracking-[0.18em] text-slate-500">No trade is also a decision.</p>}
    </div>
  );
}

export default EmptyState;
