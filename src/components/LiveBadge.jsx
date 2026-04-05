import { getMarketStatusBadge } from '@/utils/marketSession';

function LiveBadge({ status }) {
  const badge = getMarketStatusBadge(status);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${badge.toneClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${badge.dotClass}`} />
      {badge.label}
    </span>
  );
}

export default LiveBadge;
