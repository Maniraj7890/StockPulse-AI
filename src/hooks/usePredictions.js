import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';

export function usePredictions(symbol = null) {
  const analysisData = useMarketStore((state) => state.analysisData ?? {});
  const oneHourPredictions = useMarketStore((state) => state.oneHourPredictions ?? []);
  const indexPredictions = useMarketStore((state) => state.indexPredictions ?? []);

  return useMemo(() => {
    if (!symbol) {
      return {
        stocks: oneHourPredictions,
        indices: indexPredictions,
        analysisData,
      };
    }

    return {
      stock: oneHourPredictions.find((item) => item.symbol === symbol) ?? null,
      analysis: analysisData[symbol] ?? null,
      index: indexPredictions.find((item) => item.label === symbol) ?? null,
    };
  }, [analysisData, indexPredictions, oneHourPredictions, symbol]);
}
