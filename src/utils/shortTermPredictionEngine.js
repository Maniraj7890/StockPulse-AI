import {
  analyzeMomentumLayer,
  analyzeSessionLayer,
  analyzeStructureLayer,
  analyzeTrendLayer,
  analyzeVolatilityLayer,
  applySignalStability,
  buildConfluenceScores,
  buildExpectedMoveEstimate,
  buildWhyThisPrediction,
  calculatePredictionConfidence,
  getSignalQuality,
} from '@/utils/predictionEngine';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  return Number((value ?? 0).toFixed(decimals));
}

function safeArray(values) {
  return Array.isArray(values) ? values.filter((value) => Number.isFinite(value)) : [];
}

function computeConsistency(values = [], lookback = 6) {
  const slice = values.slice(-Math.max(3, lookback));
  if (slice.length < 3) {
    return {
      score: 38,
      agreementRatio: 0.5,
      directionBias: 0,
      acceleration: 0,
      reason: 'Recent candles are limited, so consistency is weaker.',
    };
  }

  const deltas = [];
  for (let index = 1; index < slice.length; index += 1) {
    deltas.push(slice[index] - slice[index - 1]);
  }

  const positive = deltas.filter((value) => value > 0).length;
  const negative = deltas.filter((value) => value < 0).length;
  const agreementRatio = Math.max(positive, negative) / Math.max(deltas.length, 1);
  const directionBias = positive === negative ? 0 : positive > negative ? 1 : -1;
  const acceleration =
    deltas.length >= 2
      ? round((deltas.at(-1) ?? 0) - (deltas.at(-2) ?? 0), 4)
      : 0;

  return {
    score: clamp(round(agreementRatio * 100 - Math.min(Math.abs(acceleration) * 12, 14)), 24, 88),
    agreementRatio,
    directionBias,
    acceleration,
    reason:
      agreementRatio >= 0.72
        ? 'Recent candles are moving with good consistency.'
        : agreementRatio <= 0.56
          ? 'Recent candles are mixed, which lowers conviction.'
          : 'Recent candles show only partial alignment.',
  };
}

const HORIZON_CONFIG = {
  fifteenMinutes: {
    label: '15m',
    lookback: 4,
    neutralZone: 10,
    flipThreshold: 16,
    moveMultiplier: 0.8,
  },
  thirtyMinutes: {
    label: '30m',
    lookback: 6,
    neutralZone: 11,
    flipThreshold: 17,
    moveMultiplier: 1,
  },
  oneHour: {
    label: '1h',
    lookback: 10,
    neutralZone: 12,
    flipThreshold: 18,
    moveMultiplier: 1.18,
  },
};

function confidenceStrength(confidence, marketStatus) {
  if (marketStatus === 'CLOSED' || marketStatus === 'POSTMARKET') {
    if (confidence >= 58) return 'MODERATE';
    return 'WEAK';
  }
  if (confidence >= 72) return 'STRONG';
  if (confidence >= 48) return 'MODERATE';
  return 'WEAK';
}

function buildHorizonPrediction(input, horizonKey) {
  const config = HORIZON_CONFIG[horizonKey];
  const closes = safeArray(input.closes);
  const lookbackCloses = closes.slice(-Math.max(config.lookback + 6, 8));
  const consistency = computeConsistency(lookbackCloses, config.lookback + 2);
  const trendLayer = analyzeTrendLayer({
    ...input,
    closes: lookbackCloses,
  });
  const momentumLayer = analyzeMomentumLayer({
    ...input,
    previousRsi:
      input.previousRsi ??
      (input.rsiValue ?? 50) - (input.momentum?.changePercent ?? 0) * 6,
    previousHistogram:
      input.previousHistogram ??
      (input.macdResult?.histogram ?? 0) - (input.momentum?.changePercent ?? 0) * 0.12,
  });
  const structureLayer = analyzeStructureLayer(input);
  const volatilityLayer = analyzeVolatilityLayer({
    ...input,
    consistency,
  });
  const sessionLayer = analyzeSessionLayer(input);
  const layers = {
    trend: trendLayer,
    momentum: momentumLayer,
    structure: structureLayer,
    volatility: volatilityLayer,
    session: sessionLayer,
  };
  const scores = buildConfluenceScores(layers);
  const rawDirection =
    scores.bullishScore - scores.bearishScore >= config.neutralZone
      ? 'UP'
      : scores.bearishScore - scores.bullishScore >= config.neutralZone
        ? 'DOWN'
        : 'SIDEWAYS';
  const confidenceState = calculatePredictionConfidence({
    layers,
    scores,
    marketStatus: input.marketStatus ?? 'UNKNOWN',
    stale: Boolean(input.stale),
    consistency,
    previousPrediction: input.previousPrediction ?? null,
    dataPoints: closes.length,
  });
  const stability = applySignalStability({
    direction: rawDirection,
    previousPrediction: input.previousPrediction ?? null,
    scores,
    confidence: confidenceState.confidence,
    neutralZone: config.neutralZone,
    flipThreshold: config.flipThreshold,
  });
  const direction = stability.stableDirection;
  let confidence =
    direction === 'SIDEWAYS'
      ? clamp(confidenceState.confidence, 25, 56)
      : clamp(confidenceState.confidence, 34, 86);

  if ((input.marketStatus ?? 'UNKNOWN') === 'CLOSED' || (input.marketStatus ?? 'UNKNOWN') === 'POSTMARKET') {
    confidence = clamp(confidence - 4, 25, 74);
  }

  const quality = getSignalQuality(confidence, direction);
  const structureRoom =
    direction === 'DOWN'
      ? structureLayer.supportDistancePercent ?? 0.8
      : structureLayer.resistanceDistancePercent ?? 0.8;
  const moveRange = buildExpectedMoveEstimate({
    confidence,
    direction,
    rangePercent: input.volatility?.rangePercent ?? 0,
    structureRoom,
    horizonMultiplier: config.moveMultiplier,
    quality,
  });
  const reasons = buildWhyThisPrediction({
    layers,
    stableDirection: direction,
    confidence,
    stabilityReason: stability.stabilityReason,
  });
  const basisLabel = Boolean(input.stale)
    ? 'Delayed estimate'
    : (input.marketStatus ?? 'UNKNOWN') === 'CLOSED' || (input.marketStatus ?? 'UNKNOWN') === 'POSTMARKET'
      ? 'Next session estimate'
      : (input.marketStatus ?? 'UNKNOWN') === 'PREOPEN'
        ? 'Pre-open estimate'
        : 'Live session estimate';

  return {
    horizon: config.label,
    direction,
    confidence,
    strength: confidenceStrength(confidence, input.marketStatus ?? 'UNKNOWN'),
    quality,
    bullishScore: scores.bullishScore,
    bearishScore: scores.bearishScore,
    sidewaysScore: scores.sidewaysScore,
    finalSignalScore: scores.finalSignalScore,
    expectedMoveMin: moveRange.min,
    expectedMoveMax: moveRange.max,
    expectedMoveText: moveRange.text,
    expectedMoveLabel:
      (input.marketStatus ?? 'UNKNOWN') === 'CLOSED' || (input.marketStatus ?? 'UNKNOWN') === 'POSTMARKET'
        ? 'Estimated move for next session'
        : 'Expected move',
    reasons,
    basisLabel,
    sessionNote:
      (input.marketStatus ?? 'UNKNOWN') === 'CLOSED' || (input.marketStatus ?? 'UNKNOWN') === 'POSTMARKET'
        ? 'Based on last session data'
        : Boolean(input.stale)
          ? 'Based on delayed market data'
          : 'Based on live session data',
    signalQuality: clamp(
      round(
        trendLayer.strength * 0.24 +
          momentumLayer.strength * 0.22 +
          structureLayer.structureStrength * 0.18 +
          volatilityLayer.strength * 0.14 +
          sessionLayer.strength * 0.1 +
          consistency.score * 0.12,
      ),
      24,
      88,
    ),
    confluence: {
      trend: trendLayer,
      momentum: momentumLayer,
      structure: structureLayer,
      volatility: volatilityLayer,
      session: sessionLayer,
    },
    debug: {
      trendScore: trendLayer.strength,
      momentumScore: momentumLayer.strength,
      volatilityScore: volatilityLayer.strength,
      supportResistanceScore: structureLayer.structureStrength,
      sessionScore: sessionLayer.strength,
      consistencyScore: consistency.score,
      finalSignalScore: scores.finalSignalScore,
      confidenceBase: confidenceState.confidence,
      confidenceFinal: confidence,
      bullishScore: scores.bullishScore,
      bearishScore: scores.bearishScore,
      sidewaysScore: scores.sidewaysScore,
      stabilityReason: stability.stabilityReason,
      persisted: stability.persisted,
    },
  };
}

export function buildShortTermPredictions(input = {}) {
  const previousPredictions = input.previousPredictions ?? {};

  return {
    fifteenMinutes: buildHorizonPrediction(
      { ...input, previousPrediction: previousPredictions.fifteenMinutes ?? null },
      'fifteenMinutes',
    ),
    thirtyMinutes: buildHorizonPrediction(
      { ...input, previousPrediction: previousPredictions.thirtyMinutes ?? null },
      'thirtyMinutes',
    ),
    oneHour: buildHorizonPrediction(
      { ...input, previousPrediction: previousPredictions.oneHour ?? null },
      'oneHour',
    ),
  };
}
