import { useMemo } from 'react';
import { buildPredictionEngine } from '@/utils/predictionEngine';

export function usePredictionEngine(input) {
  return useMemo(() => buildPredictionEngine(input), [input]);
}

