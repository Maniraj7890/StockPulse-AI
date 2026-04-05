import { calculatePredictionConfidence, getSignalQuality } from '@/utils/predictionEngine';

export { calculatePredictionConfidence, getSignalQuality };

export function buildConfidenceView(args = {}) {
  const result = calculatePredictionConfidence(args);
  return {
    ...result,
    quality: getSignalQuality(result.confidence, args?.scores?.direction ?? 'SIDEWAYS'),
  };
}
