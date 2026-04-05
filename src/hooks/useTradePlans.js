import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';

export function useTradePlans(symbol = null) {
  const analysisData = useMarketStore((state) => state.analysisData ?? {});
  const buyZoneRows = useMarketStore((state) => state.buyZoneRows ?? []);
  const sellExitRows = useMarketStore((state) => state.sellExitRows ?? []);

  return useMemo(() => {
    if (!symbol) {
      return {
        buyZoneRows,
        sellExitRows,
      };
    }

    const analysis = analysisData[symbol] ?? null;
    return {
      analysis,
      entryZonePlan: analysis?.entryZonePlan ?? null,
      exitZonePlan: analysis?.exitZonePlan ?? null,
      stopLoss: analysis?.stopLoss ?? null,
      target: analysis?.target ?? null,
    };
  }, [analysisData, buyZoneRows, sellExitRows, symbol]);
}
