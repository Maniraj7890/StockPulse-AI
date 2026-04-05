import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';

export function useBacktesting() {
  const backtestStats = useMarketStore((state) => state.backtestStats);
  const signalHistorySummary = useMarketStore((state) => state.signalHistorySummary);
  const predictionResults = useMarketStore((state) => state.predictionResults ?? []);

  return useMemo(
    () => ({
      backtestStats,
      summary: signalHistorySummary,
      predictionResults,
    }),
    [backtestStats, predictionResults, signalHistorySummary],
  );
}
