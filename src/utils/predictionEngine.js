function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  return Number((value ?? 0).toFixed(decimals));
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function safeArray(values) {
  return Array.isArray(values) ? values.filter((value) => Number.isFinite(value)) : [];
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRecentCloses(input = {}) {
  if (Array.isArray(input.closes) && input.closes.length) return safeArray(input.closes);
  if (Array.isArray(input.candles) && input.candles.length) {
    return input.candles.map((candle) => candle?.close).filter((value) => Number.isFinite(value));
  }
  return [];
}

function computeSlope(values = [], lookback = 4) {
  const slice = values.slice(-Math.max(2, lookback));
  if (slice.length < 2) return 0;
  const first = slice[0];
  const last = slice.at(-1);
  return round(((last - first) / Math.max(Math.abs(first), 1)) * 100, 3);
}

function computeConsistency(values = [], lookback = 6) {
  const slice = values.slice(-Math.max(3, lookback));
  if (slice.length < 3) {
    return {
      score: 38,
      agreementRatio: 0.5,
      directionBias: 0,
      acceleration: 0,
      reason: 'Recent candles are limited, so signal consistency is weaker.',
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
    score: clamp(round(agreementRatio * 100 - Math.min(Math.abs(acceleration) * 12, 14)), 26, 88),
    agreementRatio,
    directionBias,
    acceleration,
    reason:
      agreementRatio >= 0.72
        ? 'Recent candles are moving with good directional consistency.'
        : agreementRatio <= 0.56
          ? 'Recent candles are mixed, which weakens directional clarity.'
          : 'Recent candles show only partial alignment.',
  };
}

function scoreToDirection(bullishScore, bearishScore, neutralZone = 8) {
  const edge = bullishScore - bearishScore;
  if (edge >= neutralZone) return 'bullish';
  if (edge <= -neutralZone) return 'bearish';
  return 'mixed';
}

function makeLayer({
  name,
  bullishScore = 50,
  bearishScore = 50,
  reason = '',
  extra = {},
}) {
  const direction = scoreToDirection(bullishScore, bearishScore);
  return {
    name,
    direction,
    strength: round(Math.max(bullishScore, bearishScore)),
    bullishScore: clamp(round(bullishScore), 0, 100),
    bearishScore: clamp(round(bearishScore), 0, 100),
    reason,
    ...extra,
  };
}

export function analyzeTrendLayer(input = {}) {
  const closes = getRecentCloses(input);
  const currentPrice =
    safeNumber(input.currentPrice) ||
    safeNumber(closes.at(-1)) ||
    safeNumber(input.emaCross?.short) ||
    safeNumber(input.emaCross?.long);
  const ema9 = safeNumber(input.ema9, safeNumber(input.emaCross?.short, currentPrice));
  const ema21 = safeNumber(input.ema21, safeNumber(input.emaCross?.long, currentPrice));
  const spreadPercent = safeNumber(
    input.emaCross?.spreadPercent,
    ((ema9 - ema21) / Math.max(Math.abs(ema21), 1)) * 100,
  );
  const slope9 = safeNumber(input.ema9Slope, computeSlope(closes.slice(-5), 4));
  const slope21 = safeNumber(input.ema21Slope, computeSlope(closes.slice(-8), 6) * 0.7);
  const priceAbove9 = currentPrice >= ema9;
  const priceAbove21 = currentPrice >= ema21;
  const bullishStack = ema9 > ema21 && priceAbove9 && priceAbove21;
  const bearishStack = ema9 < ema21 && !priceAbove9 && !priceAbove21;

  let bullishScore = 50;
  let bearishScore = 50;
  const reasons = [];

  if (bullishStack) {
    bullishScore += 24;
    reasons.push('EMA9 is above EMA21 and price is holding above both.');
  } else if (bearishStack) {
    bearishScore += 24;
    reasons.push('EMA9 is below EMA21 and price is trading below both.');
  } else {
    reasons.push('Price is not cleanly aligned with the short and medium trend averages.');
  }

  bullishScore += clamp(spreadPercent * 10, -14, 18);
  bearishScore += clamp(spreadPercent * -10, -14, 18);

  if (slope9 > 0.06) {
    bullishScore += 8;
    reasons.push('Short EMA slope is rising.');
  } else if (slope9 < -0.06) {
    bearishScore += 8;
    reasons.push('Short EMA slope is falling.');
  }

  if (slope21 > 0.03) bullishScore += 4;
  if (slope21 < -0.03) bearishScore += 4;

  return makeLayer({
    name: 'trend',
    bullishScore,
    bearishScore,
    reason: reasons.join(' '),
    extra: {
      trendDirection: bullishStack ? 'bullish' : bearishStack ? 'bearish' : 'mixed',
      trendStrength: clamp(round(Math.max(bullishScore, bearishScore)), 0, 100),
      summary: bullishStack
        ? 'Short and medium trend are aligned upward.'
        : bearishStack
          ? 'Short and medium trend are aligned downward.'
          : 'Trend alignment is mixed.',
      ema9,
      ema21,
      slope9,
      slope21,
      priceAbove9,
      priceAbove21,
    },
  });
}

export function analyzeMomentumLayer(input = {}) {
  const rsiValue = safeNumber(input.rsiValue, 50);
  const previousRsi = safeNumber(input.previousRsi, rsiValue);
  const rsiDirection = rsiValue > previousRsi + 0.4 ? 'rising' : rsiValue < previousRsi - 0.4 ? 'falling' : 'flat';
  const macdValue = safeNumber(input.macdResult?.macd, 0);
  const macdSignal = safeNumber(input.macdResult?.signal, 0);
  const histogram = safeNumber(input.macdResult?.histogram, 0);
  const previousHistogram = safeNumber(input.previousHistogram, histogram);
  const momentumChange = safeNumber(input.momentum?.changePercent, 0);

  let bullishScore = 50;
  let bearishScore = 50;
  const reasons = [];

  if (rsiValue >= 52 && rsiValue <= 66 && rsiDirection !== 'falling') {
    bullishScore += 14;
    reasons.push('RSI is in a healthy bullish zone and is not weakening.');
  } else if (rsiValue >= 68) {
    bullishScore -= 10;
    bearishScore += 4;
    reasons.push('RSI is getting overbought, so upside conviction is reduced.');
  } else if (rsiValue <= 34) {
    bearishScore -= 10;
    bullishScore += 4;
    reasons.push('RSI is getting oversold, so fresh downside conviction is reduced.');
  } else if (rsiValue <= 46 && rsiDirection === 'falling') {
    bearishScore += 14;
    reasons.push('RSI is weak and still falling.');
  } else {
    reasons.push('RSI is near neutral and does not give a strong momentum edge.');
  }

  if (rsiDirection === 'rising') bullishScore += 8;
  if (rsiDirection === 'falling') bearishScore += 8;

  if (macdValue > macdSignal && histogram >= previousHistogram) {
    bullishScore += 16;
    reasons.push('MACD supports improving upside momentum.');
  } else if (macdValue < macdSignal && histogram <= previousHistogram) {
    bearishScore += 16;
    reasons.push('MACD supports downside momentum.');
  } else if (Math.abs(histogram) < 0.08) {
    reasons.push('MACD histogram is flattening, so momentum is less decisive.');
  } else {
    reasons.push('RSI and MACD are not fully aligned.');
  }

  bullishScore += clamp(momentumChange * 12, -12, 16);
  bearishScore += clamp(momentumChange * -12, -12, 16);

  return makeLayer({
    name: 'momentum',
    bullishScore,
    bearishScore,
    reason: reasons.join(' '),
    extra: {
      momentumDirection: scoreToDirection(bullishScore, bearishScore),
      momentumStrength: clamp(round(Math.max(bullishScore, bearishScore)), 0, 100),
      summary:
        bullishScore - bearishScore >= 8
          ? 'Momentum is leaning upward.'
          : bearishScore - bullishScore >= 8
            ? 'Momentum is leaning downward.'
            : 'Momentum is mixed.',
      rsiDirection,
      histogramDirection:
        histogram > previousHistogram ? 'rising' : histogram < previousHistogram ? 'falling' : 'flat',
    },
  });
}

export function analyzeStructureLayer(input = {}) {
  const currentPrice = safeNumber(input.currentPrice, 0);
  const supportLevel = safeNumber(input.levels?.support, safeNumber(input.support));
  const resistanceLevel = safeNumber(input.levels?.resistance, safeNumber(input.resistance));
  const supportDistancePercent =
    currentPrice > 0 && supportLevel > 0
      ? round(((currentPrice - supportLevel) / currentPrice) * 100)
      : null;
  const resistanceDistancePercent =
    currentPrice > 0 && resistanceLevel > 0
      ? round(((resistanceLevel - currentPrice) / currentPrice) * 100)
      : null;

  let bullishScore = 50;
  let bearishScore = 50;
  const reasons = [];

  if (supportDistancePercent != null && supportDistancePercent >= 0 && supportDistancePercent <= 1.1) {
    bullishScore += 14;
    reasons.push('Price is trading close to support, which improves dip-buy structure.');
  } else if (supportDistancePercent != null && supportDistancePercent > 2.3) {
    bullishScore -= 6;
  }

  if (resistanceDistancePercent != null && resistanceDistancePercent >= 0 && resistanceDistancePercent <= 0.9) {
    bullishScore -= 14;
    bearishScore += 10;
    reasons.push('Resistance is close, so upside room is capped.');
  } else if (resistanceDistancePercent != null && resistanceDistancePercent >= 1.8) {
    bullishScore += 10;
    reasons.push('There is decent room before resistance.');
  }

  if (supportDistancePercent != null && supportDistancePercent <= 0.8) {
    bearishScore -= 10;
    reasons.push('Support is nearby, so downside follow-through may be limited.');
  } else if (supportDistancePercent != null && supportDistancePercent >= 1.8) {
    bearishScore += 6;
  }

  const breakoutRisk = resistanceDistancePercent != null && resistanceDistancePercent < 0.45;
  const pullbackChance = supportDistancePercent != null && supportDistancePercent < 0.85;

  return makeLayer({
    name: 'structure',
    bullishScore,
    bearishScore,
    reason: reasons.join(' '),
    extra: {
      structureBias: scoreToDirection(bullishScore, bearishScore),
      structureStrength: clamp(round(Math.max(bullishScore, bearishScore)), 0, 100),
      summary:
        bullishScore - bearishScore >= 8
          ? 'Structure is more supportive for upside.'
          : bearishScore - bullishScore >= 8
            ? 'Structure is more supportive for downside.'
            : 'Structure is balanced and nearby levels matter more.',
      supportLevel,
      resistanceLevel,
      supportDistancePercent,
      resistanceDistancePercent,
      breakoutRisk,
      pullbackChance,
    },
  });
}

export function analyzeVolatilityLayer(input = {}) {
  const rangePercent = safeNumber(input.volatility?.rangePercent, 0);
  const recentReturns = safeArray(input.volatility?.recentReturns);
  const consistency = input.consistency ?? computeConsistency(getRecentCloses(input));
  const averageMoveSize = recentReturns.length ? average(recentReturns.map((value) => Math.abs(value))) : 0;
  const moveConsistency = consistency.agreementRatio ?? 0.5;

  let bullishScore = 50;
  let bearishScore = 50;
  let sidewaysScore = 42;
  let volatilityState = 'moderate';
  let reason = 'Volatility is moderate enough to support a cleaner read.';
  let adjustment = 8;

  if (rangePercent < 1.2 || averageMoveSize < 0.2) {
    bullishScore -= 12;
    bearishScore -= 12;
    sidewaysScore += 22;
    volatilityState = 'low';
    adjustment = -10;
    reason = 'Low volatility increases sideways probability.';
  } else if (rangePercent > 5.4 || averageMoveSize > 1.1) {
    bullishScore -= 8;
    bearishScore -= 8;
    sidewaysScore += 10;
    volatilityState = 'elevated';
    adjustment = -12;
    reason = 'Volatility is elevated, so noise reduces confidence.';
  } else {
    bullishScore += 6;
    bearishScore += 6;
    sidewaysScore -= 6;
  }

  if (moveConsistency < 0.56) {
    bullishScore -= 6;
    bearishScore -= 6;
    sidewaysScore += 10;
    reason = 'Move consistency is mixed, so sideways risk stays higher.';
  } else if (moveConsistency >= 0.72 && volatilityState === 'moderate') {
    bullishScore += 4;
    bearishScore += 4;
    reason = 'Volatility is moderate and recent moves are reasonably consistent.';
  }

  return {
    ...makeLayer({
      name: 'volatility',
      bullishScore,
      bearishScore,
      reason,
    }),
    sidewaysScore: clamp(round(sidewaysScore), 0, 100),
    volatilityState,
    volatilityAdjustment: adjustment,
    volatilityReason: reason,
    averageMoveSize: round(averageMoveSize),
    moveConsistency: round(moveConsistency * 100),
    summary: reason,
  };
}

export function analyzeSessionLayer(input = {}) {
  const marketStatus = input.marketStatus ?? 'UNKNOWN';
  const stale = Boolean(input.stale);
  let bullishScore = 56;
  let bearishScore = 56;
  let sidewaysScore = 36;
  let adjustment = 8;
  let reason = 'Market is open and data is reasonably fresh.';
  let summary = 'Live session quality supports cleaner prediction confidence.';

  if (stale) {
    bullishScore -= 16;
    bearishScore -= 16;
    sidewaysScore += 14;
    adjustment = -18;
    reason = 'Quote freshness is weak, so confidence is reduced.';
    summary = 'Delayed data keeps the engine more defensive.';
  } else if (marketStatus === 'CLOSED' || marketStatus === 'POSTMARKET' || marketStatus === 'WEEKEND_CLOSED' || marketStatus === 'HOLIDAY') {
    bullishScore -= 12;
    bearishScore -= 12;
    sidewaysScore += 10;
    adjustment = -14;
    reason = 'Market is closed, so this is based on last session data.';
    summary = 'Next-session estimate only; directional confidence is reduced.';
  } else if (marketStatus === 'PREOPEN') {
    bullishScore -= 6;
    bearishScore -= 6;
    sidewaysScore += 6;
    adjustment = -7;
    reason = 'Pre-open conditions can shift after the session begins.';
    summary = 'Pre-open data can change quickly after the open.';
  } else if (marketStatus === 'OPEN') {
    reason = 'Market is open and the source is fresh enough for stronger confidence.';
  } else {
    bullishScore -= 10;
    bearishScore -= 10;
    sidewaysScore += 10;
    adjustment = -12;
    reason = 'Session state is uncertain, so the engine stays defensive.';
    summary = 'Uncertain session state reduces confidence.';
  }

  return {
    ...makeLayer({
      name: 'session',
      bullishScore,
      bearishScore,
      reason,
    }),
    sidewaysScore: clamp(round(sidewaysScore), 0, 100),
    sessionState: marketStatus,
    sessionAdjustment: adjustment,
    sessionReason: reason,
    summary,
  };
}

export function buildConfluenceScores(layers = {}, options = {}) {
  const weights = {
    trend: options.weights?.trend ?? 0.3,
    momentum: options.weights?.momentum ?? 0.25,
    structure: options.weights?.structure ?? 0.2,
    volatility: options.weights?.volatility ?? 0.15,
    session: options.weights?.session ?? 0.1,
  };

  const bullishScore = round(
    (layers.trend?.bullishScore ?? 50) * weights.trend +
      (layers.momentum?.bullishScore ?? 50) * weights.momentum +
      (layers.structure?.bullishScore ?? 50) * weights.structure +
      (layers.volatility?.bullishScore ?? 50) * weights.volatility +
      (layers.session?.bullishScore ?? 50) * weights.session,
  );
  const bearishScore = round(
    (layers.trend?.bearishScore ?? 50) * weights.trend +
      (layers.momentum?.bearishScore ?? 50) * weights.momentum +
      (layers.structure?.bearishScore ?? 50) * weights.structure +
      (layers.volatility?.bearishScore ?? 50) * weights.volatility +
      (layers.session?.bearishScore ?? 50) * weights.session,
  );
  const sidewaysScore = round(
    100 -
      Math.min(
        78,
        Math.abs(bullishScore - bearishScore) * 0.85 +
          ((layers.volatility?.sidewaysScore ?? 46) * 0.26 + (layers.session?.sidewaysScore ?? 40) * 0.14) -
          (Math.max(bullishScore, bearishScore) - 50) * 0.22,
      ),
  );
  const finalSignalScore = round(bullishScore - bearishScore);

  return {
    bullishScore: clamp(bullishScore, 0, 100),
    bearishScore: clamp(bearishScore, 0, 100),
    sidewaysScore: clamp(sidewaysScore, 0, 100),
    finalSignalScore,
  };
}

export function calculatePredictionConfidence({
  layers = {},
  scores = {},
  marketStatus = 'UNKNOWN',
  stale = false,
  consistency,
  previousPrediction,
  dataPoints = 0,
}) {
  const alignedLayers = [layers.trend, layers.momentum, layers.structure].filter(
    (layer) => layer?.direction && layer.direction !== 'mixed',
  );
  const dominantDirection =
    scores.bullishScore - scores.bearishScore >= 8
      ? 'bullish'
      : scores.bearishScore - scores.bullishScore >= 8
        ? 'bearish'
        : 'sideways';
  const alignedCount = alignedLayers.filter((layer) => layer.direction === dominantDirection).length;
  const edge = Math.abs((scores.bullishScore ?? 50) - (scores.bearishScore ?? 50));
  const consistencyScore = consistency?.score ?? 42;
  const freshnessPenalty = stale ? 16 : marketStatus === 'CLOSED' || marketStatus === 'POSTMARKET' ? 10 : marketStatus === 'PREOPEN' ? 5 : 0;
  const dataPenalty = dataPoints >= 18 ? 0 : dataPoints >= 12 ? 4 : dataPoints >= 8 ? 9 : 16;
  const volatilityPenalty =
    (layers.volatility?.volatilityState ?? 'moderate') === 'elevated'
      ? 8
      : (layers.volatility?.volatilityState ?? 'moderate') === 'low'
        ? 6
        : 0;
  const persistenceBonus =
    previousPrediction?.direction &&
    previousPrediction.direction !== 'SIDEWAYS' &&
    previousPrediction.direction.toLowerCase() === dominantDirection
      ? 4
      : 0;

  let confidence = 28 + edge * 0.85 + alignedCount * 6 + consistencyScore * 0.12 + persistenceBonus;
  confidence -= freshnessPenalty + dataPenalty + volatilityPenalty;

  if (dominantDirection === 'sideways') {
    confidence = clamp(round(confidence), 25, 56);
  } else {
    confidence = clamp(round(confidence), 32, 82);
    if (alignedCount >= 4 && edge >= 18 && !stale && marketStatus === 'OPEN') {
      confidence = clamp(confidence + 4, 32, 88);
    }
  }

  return {
    confidence,
    alignedCount,
    edge: round(edge),
    penalties: {
      freshnessPenalty,
      dataPenalty,
      volatilityPenalty,
    },
  };
}

export function applySignalStability({
  direction,
  previousPrediction,
  scores,
  confidence,
  neutralZone = 8,
  flipThreshold = 16,
}) {
  const previousDirection = previousPrediction?.direction ?? previousPrediction?.signalDirection ?? 'SIDEWAYS';
  const previousScore =
    previousPrediction?.finalSignalScore ??
    previousPrediction?.debug?.finalSignalScore ??
    previousPrediction?.score ??
    0;

  if (!previousPrediction || previousDirection === direction) {
    return {
      stableDirection: direction,
      stabilityReason: 'No stability override was needed.',
      persisted: false,
    };
  }

  const edge = Math.abs((scores?.bullishScore ?? 50) - (scores?.bearishScore ?? 50));
  const scoreShift = Math.abs((scores?.finalSignalScore ?? 0) - previousScore);

  if (direction === 'SIDEWAYS' && edge >= neutralZone * 0.75) {
    return {
      stableDirection: previousDirection,
      stabilityReason: 'Prior direction is held until weakness becomes clearer.',
      persisted: true,
    };
  }

  if (
    previousDirection !== 'SIDEWAYS' &&
    direction !== 'SIDEWAYS' &&
    previousDirection !== direction &&
    edge < flipThreshold &&
    scoreShift < 14 &&
    confidence < 72
  ) {
    return {
      stableDirection: previousDirection,
      stabilityReason: 'Signal persistence blocks a noisy flip on small score changes.',
      persisted: true,
    };
  }

  return {
    stableDirection: direction,
    stabilityReason: 'Confluence shifted enough to justify the new direction.',
    persisted: false,
  };
}

export function buildExpectedMoveEstimate({
  confidence = 0,
  direction = 'SIDEWAYS',
  rangePercent = 0,
  structureRoom = 1.2,
  horizonMultiplier = 1,
  quality = 'weak',
}) {
  const confidenceFactor = clamp(confidence / 70, 0.45, 1.18);
  const volatilityFactor = clamp((rangePercent || 1.1) / 3.2, 0.45, 1.16);
  const roomFactor = clamp((structureRoom || 0.8) / 1.8, 0.4, 1.15);
  const qualityFactor = quality === 'strong' ? 1.08 : quality === 'moderate' ? 0.9 : 0.72;

  let minMove = 0.14 * confidenceFactor * volatilityFactor * roomFactor * horizonMultiplier * qualityFactor;
  let maxMove = 0.42 * confidenceFactor * volatilityFactor * roomFactor * horizonMultiplier * qualityFactor;

  if (direction === 'SIDEWAYS') {
    minMove *= 0.52;
    maxMove *= 0.64;
  }

  minMove = clamp(round(minMove), 0.08, 1.15);
  maxMove = clamp(round(Math.max(maxMove, minMove + 0.08)), minMove + 0.08, 1.95);

  return {
    min: direction === 'DOWN' ? -minMove : minMove,
    max: direction === 'DOWN' ? -maxMove : maxMove,
    text:
      direction === 'UP'
        ? `+${minMove}% to +${maxMove}%`
        : direction === 'DOWN'
          ? `-${minMove}% to -${maxMove}%`
          : `Within ${minMove}% to ${maxMove}%`,
  };
}

export function buildWhyThisPrediction({
  layers = {},
  stableDirection = 'SIDEWAYS',
  confidence = 0,
  stabilityReason,
}) {
  const reasons = [];

  if (layers.trend?.reason) reasons.push(layers.trend.reason);
  if (layers.momentum?.reason) reasons.push(layers.momentum.reason);
  if (layers.structure?.reason) reasons.push(layers.structure.reason);
  if (layers.volatility?.volatilityReason) reasons.push(layers.volatility.volatilityReason);
  if (layers.session?.sessionReason) reasons.push(layers.session.sessionReason);

  if (stableDirection === 'SIDEWAYS' && confidence <= 56) {
    reasons.push('Signals are mixed, so the engine prefers a sideways bias over forcing direction.');
  }

  if (stabilityReason && !reasons.includes(stabilityReason)) reasons.push(stabilityReason);

  return [...new Set(reasons.filter(Boolean))].slice(0, 5);
}

export function buildActionBias({
  direction = 'SIDEWAYS',
  confidence = 0,
  structure = {},
  marketStatus = 'UNKNOWN',
}) {
  if (marketStatus === 'CLOSED' || marketStatus === 'POSTMARKET') {
    return confidence >= 58 ? 'Next session planning' : 'No trade';
  }

  if (direction === 'UP') {
    if ((structure.resistanceDistancePercent ?? 99) <= 0.7) return 'Book partial near resistance';
    if (confidence >= 68 && structure.pullbackChance) return 'Buy on dip';
    if (confidence >= 58) return 'Wait for pullback';
    return 'Breakout watch';
  }

  if (direction === 'DOWN') {
    if ((structure.supportDistancePercent ?? 99) <= 0.7) return 'Book partial near support';
    if (confidence >= 64) return 'Exit on weakness';
    return 'Avoid chasing';
  }

  if (structure.breakoutRisk) return 'Breakout watch';
  return 'No trade';
}

export function getSignalQuality(confidence = 0, direction = 'SIDEWAYS') {
  if (direction === 'SIDEWAYS') {
    if (confidence >= 50) return 'moderate';
    return 'weak';
  }
  if (confidence >= 70) return 'strong';
  if (confidence >= 45) return 'moderate';
  return 'weak';
}

export function momentumScore(momentumPercent = 0) {
  if (momentumPercent >= 1.1) return { score: 82, label: 'positive', reason: 'Momentum is firmly positive.' };
  if (momentumPercent >= 0.35) return { score: 68, label: 'positive', reason: 'Momentum is positive.' };
  if (momentumPercent <= -1.1) return { score: 18, label: 'negative', reason: 'Momentum is firmly negative.' };
  if (momentumPercent <= -0.35) return { score: 32, label: 'negative', reason: 'Momentum is negative.' };
  return { score: 50, label: 'mixed', reason: 'Momentum is mixed.' };
}

export function trendStrengthScore({ emaCross, macdResult, adxValue = 18, sideways = {} }) {
  const emaBias = emaCross?.bullish ? 18 : emaCross?.bearish ? -18 : 0;
  const macdBias = (macdResult?.histogram ?? 0) > 0 ? 12 : (macdResult?.histogram ?? 0) < 0 ? -12 : 0;
  const adxBias = adxValue >= 25 ? 12 : adxValue >= 20 ? 4 : -8;
  const sidewaysPenalty = sideways?.isSideways ? 18 : 0;
  const raw = 50 + emaBias + macdBias + adxBias - sidewaysPenalty;
  const score = clamp(round(raw), 0, 100);

  return {
    score,
    label: score >= 62 ? 'bullish' : score <= 38 ? 'bearish' : 'sideways',
  };
}

export function buildPredictionEngine(input = {}) {
  const closes = getRecentCloses(input);
  const consistency = computeConsistency(closes, 6);
  const layers = {
    trend: analyzeTrendLayer(input),
    momentum: analyzeMomentumLayer({
      ...input,
      previousRsi:
        input.previousRsi ??
        (safeNumber(input.rsiValue, 50) - safeNumber(input.momentum?.changePercent, 0) * 6),
      previousHistogram:
        input.previousHistogram ??
        (safeNumber(input.macdResult?.histogram, 0) - safeNumber(input.momentum?.changePercent, 0) * 0.12),
    }),
    structure: analyzeStructureLayer(input),
    volatility: analyzeVolatilityLayer({ ...input, consistency }),
    session: analyzeSessionLayer(input),
  };
  const scores = buildConfluenceScores(layers);
  const rawDirection =
    scores.bullishScore - scores.bearishScore >= 10
      ? 'UP'
      : scores.bearishScore - scores.bullishScore >= 10
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
  });
  const stableDirection = stability.stableDirection;
  const confidence =
    stableDirection === 'SIDEWAYS'
      ? clamp(confidenceState.confidence, 25, 58)
      : clamp(confidenceState.confidence, 32, 88);
  const quality = getSignalQuality(confidence, stableDirection);
  const signal = stableDirection === 'UP' ? 'BUY' : stableDirection === 'DOWN' ? 'SELL' : 'HOLD';
  const trend =
    layers.trend.trendDirection === 'bullish'
      ? 'bullish'
      : layers.trend.trendDirection === 'bearish'
        ? 'bearish'
        : 'sideways';
  const supportLevel = layers.structure.supportLevel ?? input.levels?.support ?? 0;
  const resistanceLevel = layers.structure.resistanceLevel ?? input.levels?.resistance ?? 0;
  const structureRoom =
    stableDirection === 'DOWN'
      ? layers.structure.supportDistancePercent ?? 0.8
      : layers.structure.resistanceDistancePercent ?? 0.8;
  const expectedMove = buildExpectedMoveEstimate({
    confidence,
    direction: stableDirection,
    rangePercent: input.volatility?.rangePercent ?? 0,
    structureRoom,
    horizonMultiplier: 1,
    quality,
  });
  const whyThisPrediction = buildWhyThisPrediction({
    layers,
    stableDirection,
    confidence,
    stabilityReason: stability.stabilityReason,
  });
  const actionBias = buildActionBias({
    direction: stableDirection,
    confidence,
    structure: layers.structure,
    marketStatus: input.marketStatus ?? 'UNKNOWN',
  });
  const riskFlagCount = [
    Boolean(input.stale),
    input.marketStatus === 'CLOSED' || input.marketStatus === 'POSTMARKET',
    layers.volatility.volatilityState === 'elevated',
    confidence < 48,
    stableDirection === 'SIDEWAYS',
  ].filter(Boolean).length;
  const riskLevel = riskFlagCount >= 3 ? 'high' : riskFlagCount >= 2 ? 'medium' : 'low';

  return {
    signal,
    direction: stableDirection,
    stableDirection,
    confidence,
    quality,
    trend,
    riskLevel,
    bullishScore: scores.bullishScore,
    bearishScore: scores.bearishScore,
    sidewaysScore: scores.sidewaysScore,
    finalSignalScore: scores.finalSignalScore,
    trendSummary: layers.trend.summary,
    momentumSummary: layers.momentum.summary,
    structureSummary: layers.structure.summary,
    volatilitySummary: layers.volatility.summary,
    sessionSummary: layers.session.summary,
    trendReason: layers.trend.reason,
    momentumReason: layers.momentum.reason,
    structureReason: layers.structure.reason,
    volatilityReason: layers.volatility.volatilityReason,
    sessionReason: layers.session.sessionReason,
    expectedMovePercent: expectedMove,
    support: supportLevel,
    resistance: resistanceLevel,
    invalidation:
      stableDirection === 'DOWN'
        ? round((resistanceLevel || safeNumber(input.currentPrice, 0)) + (safeNumber(input.volatility?.rangePercent, 0) * 0.05))
        : round((supportLevel || safeNumber(input.currentPrice, 0)) - (safeNumber(input.volatility?.rangePercent, 0) * 0.05)),
    actionBias,
    whyThisPrediction,
    reasons: whyThisPrediction.slice(0, 4),
    indicators: {
      rsi: safeNumber(input.rsiValue, 50),
      ema9: layers.trend.ema9 ?? 0,
      ema21: layers.trend.ema21 ?? 0,
      macd: safeNumber(input.macdResult?.macd, 0),
      momentum: safeNumber(input.momentum?.changePercent, 0),
      volatility: safeNumber(input.volatility?.rangePercent, 0),
    },
    layers,
    diagnostics: {
      alignedLayers: confidenceState.alignedCount,
      edge: confidenceState.edge,
      penalties: confidenceState.penalties,
      consistencyScore: consistency.score,
      stabilityReason: stability.stabilityReason,
      persisted: stability.persisted,
      components: {
        trend: layers.trend.strength,
        momentum: layers.momentum.strength,
        structure: layers.structure.structureStrength,
        volatility: layers.volatility.strength,
        session: layers.session.strength,
      },
    },
    debug: {
      trendScore: layers.trend.strength,
      momentumScore: layers.momentum.strength,
      structureScore: layers.structure.structureStrength,
      volatilityScore: layers.volatility.strength,
      sessionScore: layers.session.strength,
      finalSignalScore: scores.finalSignalScore,
      confidenceBase: confidenceState.confidence + (stableDirection === 'SIDEWAYS' ? 0 : 0),
      confidenceFinal: confidence,
      bullishScore: scores.bullishScore,
      bearishScore: scores.bearishScore,
      sidewaysScore: scores.sidewaysScore,
      stabilityReason: stability.stabilityReason,
      persisted: stability.persisted,
    },
  };
}
