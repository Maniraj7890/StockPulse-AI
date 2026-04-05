import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

const movementStyles = {
  up: {
    icon: ArrowUpRight,
    className: 'text-emerald-300',
    label: 'Up',
  },
  down: {
    icon: ArrowDownRight,
    className: 'text-rose-300',
    label: 'Down',
  },
  neutral: {
    icon: ArrowRight,
    className: 'text-slate-400',
    label: 'Flat',
  },
};

function PriceMovementIndicator({ direction = 'neutral', showLabel = true }) {
  const config = movementStyles[direction] ?? movementStyles.neutral;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 ${config.className}`}>
      <Icon className="h-4 w-4" />
      {showLabel ? <span className="text-xs font-medium uppercase tracking-[0.16em]">{config.label}</span> : null}
    </span>
  );
}

export default PriceMovementIndicator;
