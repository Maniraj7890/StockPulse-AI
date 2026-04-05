import { cn } from '@/utils/cn';

const signalStyles = {
  'STRONG BUY': 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200 shadow-glow',
  BUY: 'border-lime-400/40 bg-lime-400/12 text-lime-200',
  HOLD: 'border-slate-400/40 bg-slate-400/12 text-slate-200',
  WAIT: 'border-amber-400/40 bg-amber-400/12 text-amber-200',
  SELL: 'border-rose-400/40 bg-rose-400/12 text-rose-200',
  'STRONG SELL': 'border-red-400/40 bg-red-400/12 text-red-200',
};

function SignalBadge({ signal, compact = false }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.2em]',
        compact ? 'px-3 py-1 text-[10px]' : 'px-4 py-2 text-xs',
        signalStyles[signal] ?? 'border-border/70 bg-panel-soft text-slate-300',
      )}
    >
      {signal}
    </span>
  );
}

export default SignalBadge;
