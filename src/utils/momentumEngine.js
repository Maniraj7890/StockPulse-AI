import { analyzeMomentumLayer } from '@/utils/predictionEngine';

export { analyzeMomentumLayer };

export function buildMomentumSnapshot(input = {}) {
  const momentum = analyzeMomentumLayer(input);
  return {
    momentumDirection: momentum.momentumDirection,
    momentumStrength: momentum.momentumStrength,
    momentumReason: momentum.reason,
    summary: momentum.summary,
    rsiDirection: momentum.rsiDirection,
    histogramDirection: momentum.histogramDirection,
  };
}
