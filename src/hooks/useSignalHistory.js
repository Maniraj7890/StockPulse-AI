import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { buildHistoryOverview, filterSignalHistory } from '@/utils/historyEngine';

export function useSignalHistory(filters = {}) {
  const signalHistory = useMarketStore((state) => state.signalHistory ?? []);
  const summary = useMarketStore((state) => state.signalHistorySummary ?? {});

  return useMemo(() => {
    const filtered = filterSignalHistory(signalHistory, filters);
    return {
      history: filtered,
      summary,
      overview: buildHistoryOverview(filtered),
    };
  }, [filters, signalHistory, summary]);
}
