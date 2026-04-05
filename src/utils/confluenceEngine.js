import {
  analyzeMomentumLayer,
  analyzeSessionLayer,
  analyzeStructureLayer,
  analyzeTrendLayer,
  analyzeVolatilityLayer,
  buildConfluenceScores,
  buildPredictionEngine,
  buildWhyThisPrediction,
} from '@/utils/predictionEngine';

export {
  analyzeMomentumLayer,
  analyzeSessionLayer,
  analyzeStructureLayer,
  analyzeTrendLayer,
  analyzeVolatilityLayer,
  buildConfluenceScores,
  buildPredictionEngine,
  buildWhyThisPrediction,
};

export function buildConfluencePrediction(input = {}) {
  return buildPredictionEngine(input);
}
