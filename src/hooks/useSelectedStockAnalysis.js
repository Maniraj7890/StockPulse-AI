import { useMarketStore } from '@/store/useMarketStore';

export function useSelectedStockAnalysis() {
  const selectedStock = useMarketStore((state) => state.selectedStock);
  const analysisData = useMarketStore((state) => state.analysisData ?? {});

  return selectedStock ? analysisData[selectedStock] ?? null : null;
}
