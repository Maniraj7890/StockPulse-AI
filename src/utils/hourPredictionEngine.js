import { adjustPredictionWithLearning } from '@/utils/learningProfileEngine';
import { buildDecisionSupport } from '@/utils/decisionEngine';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(2));
}

function buildBaseHourPrediction(stock = {}) {
  const price = stock?.live?.ltp ?? stock?.currentPrice ?? 0;
  return {
    symbol: stock?.symbol ?? 'UNKNOWN',
    companyName: stock?.companyName ?? 'Unknown company',
    currentPrice: price,
    direction: 'NONE',
    confidence: 35,
    expectedMoveMin: 0,
    expectedMoveMax: 0,
    trend: 'sideways',
    riskLevel: 'medium',
    support: stock?.supportResistance?.support ?? price,
    resistance: stock?.supportResistance?.resistance ?? price,
    invalidation: stock?.supportResistance?.support ?? price,
    reasons: [],
    marketStatus: stock?.live?.marketStatus ?? 'UNKNOWN',
    lastUpdated: stock?.live?.lastUpdated ?? null,
    live: stock?.live ?? null,
    setupType: 'No Trade',
    setupFamily: 'mixed sideways',
    setupAge: 'Unknown',
    opportunityScore: 0,
    modelHitRate: 0,
    learningAdjustment: 0,
    learningReason: 'Limited history, so confidence stays close to the base engine.',
    learningBadge: 'Neutral history',
    bullishScore: 0,
    bearishScore: 0,
    noClearEdge: true,
    isWatchlistStock: false,
    rankingScore: 0,
    expectedMoveText: 'No clear directional edge',
    confidenceBucket: '30-60',
    prediction: stock?.prediction ?? null,
    supportResistance: stock?.supportResistance ?? null,
  };
}

function classifySetupFamily({ direction, setupType, nearSupport, nearResistance, sideways, actionBias }) {
  if (sideways || direction === 'NONE') return 'mixed sideways';
  if (setupType === 'Breakout') return 'breakout watch';
  if (setupType === 'Breakdown') return 'trend-follow bearish';
  if (setupType === 'Pullback') return 'pullback continuation';
  if (setupType === 'Reversal') return direction === 'UP' ? 'support bounce' : 'resistance rejection';
  if (nearSupport && direction === 'UP') return 'support bounce';
  if (nearResistance && direction === 'DOWN') return 'resistance rejection';
  if (String(actionBias ?? '').toLowerCase().includes('breakout')) return 'breakout watch';
  return direction === 'UP' ? 'trend-follow bullish' : 'trend-follow bearish';
}

function moveRangeFromAtr(price, atrValue, confidence, opportunityScore = 0, setupType = 'No Trade') {
  const atrPercent = ((atrValue || price * 0.008) / Math.max(price, 1)) * 100;
  const setupBoost =
    setupType === 'Breakout' || setupType === 'Breakdown'
      ? 0.18
      : setupType === 'Pullback' || setupType === 'Reversal'
        ? 0.08
        : -0.06;
  const qualityBoost = opportunityScore * 0.045;
  const min = round(clamp(atrPercent * 0.35 + confidence * 0.0018 + qualityBoost + setupBoost, 0.2, 1.2));
  const max = round(clamp(atrPercent * 0.78 + confidence * 0.0024 + qualityBoost + setupBoost, min + 0.15, 2.1));
  return { min, max };
}

function classifySetupType({ direction, nearSupport, nearResistance, indicators, momentum, sideways }) {
  const rsi = indicators?.rsi14 ?? 50;
  const macdPositive = (indicators?.macdHistogram ?? 0) > 0;
  const macdNegative = (indicators?.macdHistogram ?? 0) < 0;

  if (sideways || direction === 'NONE') return 'No Trade';
  if (direction === 'UP' && nearResistance && macdPositive && momentum > 0.2) return 'Breakout';
  if (direction === 'UP' && nearSupport) return 'Pullback';
  if (direction === 'DOWN' && nearSupport && macdNegative && momentum < -0.2) return 'Breakdown';
  if (direction === 'DOWN' && rsi > 60) return 'Reversal';
  if (direction === 'UP' && rsi < 48 && macdPositive) return 'Reversal';
  return direction === 'UP' ? 'Pullback' : 'Breakdown';
}

function classifySetupAge({ momentum, macdHistogram, trendStrength, resistanceDistance, supportDistance }) {
  const histogram = Math.abs(macdHistogram ?? 0);
  const activeLocation = Math.min(
    resistanceDistance != null ? resistanceDistance : Number.POSITIVE_INFINITY,
    supportDistance != null ? supportDistance : Number.POSITIVE_INFINITY,
  );

  if (Math.abs(momentum) >= 0.7 && histogram >= 0.18 && trendStrength >= 68 && activeLocation <= 1.2) {
    return 'Fresh';
  }
  if (Math.abs(momentum) >= 0.35 && histogram >= 0.08 && trendStrength >= 55) {
    return 'Developing';
  }
  return 'Aging';
}

function computeOpportunityScore({
  trendStrength,
  momentum,
  rsi,
  volatility,
  supportDistance,
  resistanceDistance,
  marketStatus,
  direction,
  setupType,
}) {
  const trendComponent = clamp(trendStrength / 12, 0, 2.2);
  const momentumComponent = clamp(Math.abs(momentum) * 1.8, 0, 2);
  const rsiComponent =
    direction === 'UP'
      ? rsi >= 52 && rsi <= 64
        ? 1.7
        : rsi > 72
          ? 0.5
          : 1
      : rsi <= 48 && rsi >= 36
        ? 1.7
        : rsi < 28
          ? 0.5
          : 1;
  const volatilityComponent = clamp(volatility >= 1.2 && volatility <= 4.8 ? 1.5 : volatility < 1.2 ? 0.6 : 1.1, 0.4, 1.6);
  const locationDistance = direction === 'UP' ? resistanceDistance : supportDistance;
  const locationComponent = clamp(locationDistance >= 0.9 && locationDistance <= 3.2 ? 1.8 : locationDistance < 0.6 ? 0.5 : 1.1, 0.4, 1.8);
  const marketComponent = marketStatus === 'OPEN' ? 1 : marketStatus === 'PREOPEN' ? 0.8 : marketStatus === 'CLOSED' ? 0.65 : 0.55;
  const setupBonus =
    setupType === 'Breakout' || setupType === 'Breakdown'
      ? 0.7
      : setupType === 'Pullback' || setupType === 'Reversal'
        ? 0.45
        : 0;

  return round(clamp(trendComponent + momentumComponent + rsiComponent + volatilityComponent + locationComponent + marketComponent + setupBonus, 0, 10));
}

function computeModelHitRate({ setupType, confidence, opportunityScore, backtestAccuracy }) {
  const base = backtestAccuracy ?? 58;
  const setupAdjustment =
    setupType === 'Breakout' || setupType === 'Breakdown'
      ? 6
      : setupType === 'Pullback'
        ? 4
        : setupType === 'Reversal'
          ? 1
          : -6;
  const confidenceAdjustment = (confidence - 50) * 0.18;
  const qualityAdjustment = (opportunityScore - 5) * 2.6;
  return clamp(round(base + setupAdjustment + confidenceAdjustment + qualityAdjustment), 42, 82);
}

function directionFromTrend(stock) {
  const label = stock?.prediction?.trend ?? stock?.trend?.direction ?? 'sideways';
  return label.toLowerCase();
}

function buildReasons({ bullishScore, bearishScore, stock, nearSupport, nearResistance, overextended, deeplyOversold, sideways }) {
  const reasons = [];
  const prediction = stock?.prediction ?? {};
  const indicators = stock?.indicators ?? {};
  const horizonForecast = stock?.shortTermPredictions?.oneHour ?? null;

  if ((indicators.ema9 ?? 0) > (indicators.ema21 ?? 0)) {
    reasons.push('EMA9 is above EMA21.');
  } else if ((indicators.ema9 ?? 0) < (indicators.ema21 ?? 0)) {
    reasons.push('EMA9 is below EMA21.');
  }

  if ((indicators.macdHistogram ?? 0) > 0) {
    reasons.push('MACD momentum is positive.');
  } else if ((indicators.macdHistogram ?? 0) < 0) {
    reasons.push('MACD momentum is negative.');
  }

  if ((indicators.rsi14 ?? 50) > 70) {
    reasons.push('RSI is overbought.');
  } else if ((indicators.rsi14 ?? 50) < 30) {
    reasons.push('RSI is oversold.');
  } else {
    reasons.push('RSI is in a tradable range.');
  }

  if (sideways) reasons.push(stock?.trend?.sidewaysReason ?? 'Indicators are mixed and the stock is moving sideways.');
  if (nearResistance && bullishScore >= bearishScore) reasons.push('Price is close to resistance, so upside room is tighter.');
  if (nearSupport && bearishScore >= bullishScore) reasons.push('Price is close to support, so downside follow-through may be limited.');
  if (overextended) reasons.push('The move is already stretched, which raises pullback risk.');
  if (deeplyOversold) reasons.push('The stock is already deeply oversold, which reduces fresh downside edge.');
  if (Array.isArray(horizonForecast?.reasons) && horizonForecast.reasons.length) {
    reasons.push(horizonForecast.reasons[0]);
  }

  return [...new Set([...(prediction.reasons ?? []), ...reasons])].slice(0, 4);
}

function confidenceFromScores({ bullishScore, bearishScore, dominantDirection, marketStatus, sideways }) {
  const dominant = Math.max(bullishScore, bearishScore);
  const edge = Math.abs(bullishScore - bearishScore);
  const statusPenalty = marketStatus === 'CLOSED' ? 8 : marketStatus === 'PREOPEN' ? 4 : marketStatus === 'UNKNOWN' ? 10 : 0;

  if (dominantDirection === 'NONE') {
    return clamp(round(40 + edge * 0.35 - statusPenalty - (sideways ? 6 : 0)), 35, 58);
  }

  return clamp(round(dominant * 0.68 + edge * 0.42 - statusPenalty - (sideways ? 10 : 0)), 55, 90);
}

function rankScore({ direction, confidence, bullishScore, bearishScore, riskLevel, sideways }) {
  const dominant = direction === 'UP' ? bullishScore : bearishScore;
  const riskPenalty = riskLevel === 'high' ? 10 : riskLevel === 'medium' ? 4 : 0;
  return round(dominant * 0.65 + confidence * 0.35 - riskPenalty - (sideways ? 12 : 0));
}

function buildHourPrediction(stock, context = {}) {
  const base = buildBaseHourPrediction(stock);
  const price = stock?.live?.ltp ?? stock?.currentPrice ?? 0;
  const indicators = stock?.indicators ?? {};
  const support = stock?.supportResistance?.support ?? price;
  const resistance = stock?.supportResistance?.resistance ?? price;
  const atrValue = indicators.atr14 ?? price * 0.008;
  const momentum = stock?.prediction?.indicators?.momentum ?? stock?.trend?.momentum ?? stock?.dayChangePercent ?? 0;
  const volatility = stock?.prediction?.indicators?.volatility ?? (((atrValue || 0) / Math.max(price, 1)) * 100);
  const marketStatus = stock?.live?.marketStatus ?? 'UNKNOWN';
  const horizonForecast = stock?.shortTermPredictions?.oneHour ?? null;
  const trend = directionFromTrend(stock);
  const sideways = Boolean(stock?.trend?.sideways) || trend === 'sideways' || volatility < 1;
  const nearResistance = resistance > 0 && ((resistance - price) / Math.max(price, 1)) * 100 <= 0.75;
  const nearSupport = support > 0 && ((price - support) / Math.max(price, 1)) * 100 <= 0.75;
  const resistanceDistance = resistance > 0 ? round(((resistance - price) / Math.max(price, 1)) * 100) : 0;
  const supportDistance = support > 0 ? round(((price - support) / Math.max(price, 1)) * 100) : 0;
  const overextended = (indicators.rsi14 ?? 50) >= 70 || (nearResistance && momentum > 0.4);
  const deeplyOversold = (indicators.rsi14 ?? 50) <= 30 || (nearSupport && momentum < -0.4);
  const pullbackQuality =
    nearSupport && trend === 'bullish' && momentum > -0.2 && (indicators.rsi14 ?? 50) >= 46 && (indicators.rsi14 ?? 50) <= 62;
  const breakdownQuality =
    nearResistance && trend === 'bearish' && momentum < 0.2 && (indicators.rsi14 ?? 50) <= 54;
  const breakoutQuality =
    nearResistance && trend === 'bullish' && momentum > 0.25 && (indicators.macdHistogram ?? 0) > 0;
  const rejectionQuality =
    nearResistance && trend === 'bearish' && momentum < -0.2 && (indicators.macdHistogram ?? 0) < 0;

  let bullishScore = 0;
  let bearishScore = 0;

  if ((indicators.ema9 ?? 0) > (indicators.ema21 ?? 0)) bullishScore += 18;
  if ((indicators.ema9 ?? 0) < (indicators.ema21 ?? 0)) bearishScore += 18;

  if ((indicators.macdHistogram ?? 0) > 0) bullishScore += 16;
  if ((indicators.macdHistogram ?? 0) < 0) bearishScore += 16;

  if ((indicators.rsi14 ?? 50) >= 52 && (indicators.rsi14 ?? 50) <= 64) bullishScore += 10;
  if ((indicators.rsi14 ?? 50) <= 48 && (indicators.rsi14 ?? 50) >= 36) bearishScore += 10;
  if ((indicators.rsi14 ?? 50) > 72) bullishScore -= 14;
  if ((indicators.rsi14 ?? 50) < 28) bearishScore -= 14;

  if (momentum >= 0.4) bullishScore += 14;
  if (momentum <= -0.4) bearishScore += 14;

  if ((stock?.trend?.strengthScore ?? 50) >= 65) {
    if (trend === 'bullish') bullishScore += 10;
    if (trend === 'bearish') bearishScore += 10;
  } else {
    bullishScore -= 4;
    bearishScore -= 4;
  }

  if (nearSupport && momentum >= -0.1) bullishScore += 8;
  if (nearResistance && momentum <= 0.1) bearishScore += 8;
  if (pullbackQuality) bullishScore += 8;
  if (breakoutQuality) bullishScore += 6;
  if (breakdownQuality) bearishScore += 8;
  if (rejectionQuality) bearishScore += 6;

  if (nearResistance && momentum > 0.25) bullishScore -= 10;
  if (nearSupport && momentum < -0.25) bearishScore -= 10;

  if (overextended) bullishScore -= 12;
  if (deeplyOversold) bearishScore -= 12;

  if (sideways) {
    bullishScore -= 18;
    bearishScore -= 18;
  }

  if (horizonForecast?.direction === 'UP') bullishScore += 10;
  if (horizonForecast?.direction === 'DOWN') bearishScore += 10;
  if (horizonForecast?.direction === 'SIDEWAYS') {
    bullishScore -= 8;
    bearishScore -= 8;
  }
  if ((horizonForecast?.confidence ?? 0) < 58) {
    bullishScore -= 6;
    bearishScore -= 6;
  }
  if ((horizonForecast?.signalQuality ?? 0) < 56) {
    bullishScore -= 8;
    bearishScore -= 8;
  }

  bullishScore = clamp(round(bullishScore + (stock?.prediction?.signal === 'BUY' ? 8 : 0)), 0, 100);
  bearishScore = clamp(round(bearishScore + (stock?.prediction?.signal === 'SELL' ? 8 : 0)), 0, 100);

  let direction = 'NONE';
  if (!sideways && bullishScore >= 62 && bullishScore - bearishScore >= 12 && !overextended) {
    direction = 'UP';
  } else if (!sideways && bearishScore >= 62 && bearishScore - bullishScore >= 12 && !deeplyOversold) {
    direction = 'DOWN';
  }

  const confidence = confidenceFromScores({
    bullishScore,
    bearishScore,
    dominantDirection: direction,
    marketStatus,
    sideways,
  });

  if (direction !== 'NONE' && confidence < 60) {
    direction = 'NONE';
  }

  const setupType = classifySetupType({
    direction,
    nearSupport,
    nearResistance,
    indicators,
    momentum,
    sideways,
  });
  const setupFamily = classifySetupFamily({
    direction,
    setupType,
    nearSupport,
    nearResistance,
    sideways,
    actionBias: stock?.prediction?.actionBias,
  });
  const setupAge = classifySetupAge({
    momentum,
    macdHistogram: indicators?.macdHistogram ?? 0,
    trendStrength: stock?.trend?.strengthScore ?? 50,
    resistanceDistance,
    supportDistance,
  });
  const opportunityScore = computeOpportunityScore({
    trendStrength: stock?.trend?.strengthScore ?? 50,
    momentum,
    rsi: indicators?.rsi14 ?? 50,
    volatility,
    supportDistance,
    resistanceDistance,
    marketStatus,
    direction,
    setupType,
  });
  const modelHitRate = computeModelHitRate({
    setupType,
    confidence,
    opportunityScore,
    backtestAccuracy: context?.backtestAccuracy,
  });
  const moveRange = moveRangeFromAtr(price, atrValue, confidence, opportunityScore, setupType);
  const expectedMoveMin = direction === 'UP' ? moveRange.min : direction === 'DOWN' ? -moveRange.min : 0;
  const expectedMoveMax = direction === 'UP' ? moveRange.max : direction === 'DOWN' ? -moveRange.max : 0;
  const invalidation =
    direction === 'UP'
      ? round(Math.min(support, price - atrValue * 0.55))
      : direction === 'DOWN'
        ? round(Math.max(resistance, price + atrValue * 0.55))
        : round(direction === 'NONE' && trend === 'bearish' ? resistance : support);
  const reasons = buildReasons({
    bullishScore,
    bearishScore,
    stock,
    nearSupport,
    nearResistance,
    overextended,
    deeplyOversold,
    sideways,
  });
  const riskLevel = stock?.prediction?.riskLevel ?? 'medium';
  const invalidationDistance = round((Math.abs(price - invalidation) / Math.max(price, 1)) * 100);
  const setupCleanliness = clamp(
    round(
      (horizonForecast?.signalQuality ?? 50) * 0.5 +
        breakoutQuality * 0.22 +
        (stock?.trend?.strengthScore ?? 50) * 0.14 +
        Math.max(0, 100 - invalidationDistance * 18) * 0.14,
    ),
    18,
    94,
  );

  const basePrediction = {
    ...base,
    symbol: stock?.symbol ?? base.symbol,
    companyName: stock?.companyName ?? base.companyName,
    currentPrice: price,
    direction,
    confidence,
    expectedMoveMin,
    expectedMoveMax,
    trend,
    riskLevel,
    support,
    resistance,
    invalidation,
    reasons,
    marketStatus,
    lastUpdated: stock?.live?.lastUpdated ?? null,
    live: stock?.live ?? null,
    setupType,
    setupFamily,
    setupAge,
    opportunityScore,
    modelHitRate,
    bullishScore,
    bearishScore,
    noClearEdge: direction === 'NONE',
    isWatchlistStock: false,
    setupCleanliness,
    rankingScore:
      rankScore({ direction: direction === 'NONE' ? 'UP' : direction, confidence, bullishScore, bearishScore, riskLevel, sideways }) +
      opportunityScore * 3.2 +
      setupCleanliness * 0.42 +
      modelHitRate * 0.3 -
      (setupAge === 'Aging' ? 10 : 0) -
      invalidationDistance * 3,
    expectedMoveText:
      horizonForecast?.expectedMoveText ??
      (direction === 'UP'
        ? `+${moveRange.min}% to +${moveRange.max}%`
        : direction === 'DOWN'
          ? `-${moveRange.min}% to -${moveRange.max}%`
          : 'No clear directional edge'),
    prediction: stock?.prediction ?? null,
    horizonForecast,
    supportResistance: stock?.supportResistance ?? null,
    confidenceBucket:
      confidence >= 60 ? '60-100' : confidence >= 30 ? '30-60' : '0-30',
  };

  const learnedPrediction = adjustPredictionWithLearning(basePrediction, context?.learningProfile);
  const decision = buildDecisionSupport({
    symbol: learnedPrediction.symbol,
    prediction: {
      ...stock?.prediction,
      signal:
        learnedPrediction.direction === 'UP'
          ? 'BUY'
          : learnedPrediction.direction === 'DOWN'
            ? 'SELL'
            : 'HOLD',
      direction: learnedPrediction.direction === 'NONE' ? 'SIDEWAYS' : learnedPrediction.direction,
      confidence: learnedPrediction.confidence,
      trendSummary: stock?.prediction?.trendSummary,
      momentumSummary: stock?.prediction?.momentumSummary,
      structureSummary: stock?.prediction?.structureSummary,
      volatilitySummary: stock?.prediction?.volatilitySummary,
      sessionSummary: stock?.prediction?.sessionSummary,
      reasons: learnedPrediction.reasons,
      riskLevel: learnedPrediction.riskLevel,
      diagnostics: stock?.prediction?.diagnostics,
      finalSignalScore:
        learnedPrediction.direction === 'UP'
          ? learnedPrediction.bullishScore - learnedPrediction.bearishScore
          : learnedPrediction.bearishScore - learnedPrediction.bullishScore,
    },
    entryZonePlan: stock?.entryZonePlan ?? {},
    exitZonePlan: stock?.exitZonePlan ?? {},
    marketStatus,
    zoneQuality: learnedPrediction.setupCleanliness,
    rewardRiskRatio: stock?.entryZonePlan?.riskReward?.rewardRiskRatio ?? 0,
    invalidation: learnedPrediction.invalidation,
  });
  const shouldDemoteToNoEdge =
    learnedPrediction.direction !== 'NONE' &&
    (learnedPrediction.noClearEdge || learnedPrediction.confidence < 60);

  if (!shouldDemoteToNoEdge) {
    return {
      ...learnedPrediction,
      decision,
    };
  }

  return {
    ...learnedPrediction,
    decision: {
      ...decision,
      finalDecision: 'WAIT',
      decisionStrength: 'WEAK',
      noTradeMessage: 'No clear edge - avoid trading this setup.',
    },
    direction: 'NONE',
    noClearEdge: true,
    expectedMoveMin: 0,
    expectedMoveMax: 0,
    expectedMoveText: 'No clear directional edge',
    setupType: learnedPrediction.setupType === 'No Trade' ? 'No Trade' : learnedPrediction.setupType,
    setupFamily: learnedPrediction.setupFamily ?? setupFamily,
    reasons: [...new Set([...(learnedPrediction.reasons ?? []), learnedPrediction.learningReason])].slice(0, 5),
  };
}

export function buildHourPredictions(stocks, options = {}) {
  return (stocks ?? [])
    .map((stock) => buildHourPrediction(stock, options))
    .sort((left, right) => right.rankingScore - left.rankingScore);
}
