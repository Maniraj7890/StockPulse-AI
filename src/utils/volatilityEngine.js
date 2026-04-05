import { analyzeVolatilityLayer } from '@/utils/predictionEngine';

export { analyzeVolatilityLayer };

export function buildVolatilitySnapshot(input = {}) {
  const volatility = analyzeVolatilityLayer(input);
  return {
    volatilityState: volatility.volatilityState,
    volatilityAdjustment: volatility.volatilityAdjustment,
    volatilityReason: volatility.volatilityReason,
    averageMoveSize: volatility.averageMoveSize,
    moveConsistency: volatility.moveConsistency,
    summary: volatility.summary,
  };
}
