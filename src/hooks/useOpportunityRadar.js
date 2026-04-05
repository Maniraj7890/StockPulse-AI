import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';
import { buildOpportunityRadar } from '@/utils/opportunityRadarEngine';

export function useOpportunityRadar(filter = 'all') {
  const stocks = useMarketStore((state) => state.stocks ?? []);
  const monitoringSnapshot = useMarketStore((state) => state.monitoringSnapshot ?? {});
  const lastUpdated = useMarketStore((state) => state.lastUpdated);

  return useMemo(
    () => ({
      ...buildOpportunityRadar(stocks, monitoringSnapshot, filter),
      lastUpdated,
    }),
    [filter, lastUpdated, monitoringSnapshot, stocks],
  );
}
