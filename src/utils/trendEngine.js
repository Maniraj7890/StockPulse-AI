import { analyzeTrendLayer } from '@/utils/predictionEngine';

export { analyzeTrendLayer };

export function buildTrendSnapshot(input = {}) {
  const trend = analyzeTrendLayer(input);
  return {
    trendDirection: trend.trendDirection,
    trendStrength: trend.trendStrength,
    trendReason: trend.reason,
    summary: trend.summary,
    ema9: trend.ema9,
    ema21: trend.ema21,
    slope9: trend.slope9,
    slope21: trend.slope21,
  };
}
