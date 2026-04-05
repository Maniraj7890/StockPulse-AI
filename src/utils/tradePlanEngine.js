function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number((value ?? 0).toFixed(2));
}

function buildRange(min, max) {
  return {
    min: round(Math.min(min, max)),
    max: round(Math.max(min, max)),
  };
}

function rangeText(range) {
  if (!range) return 'Monitor';
  return `${range.min} - ${range.max}`;
}

function qualityBadge(score) {
  if (score >= 78) return 'High Quality';
  if (score >= 60) return 'Usable';
  if (score >= 42) return 'Cautious';
  return 'Low Quality';
}

function chaseRiskLabel(value) {
  if (value >= 72) return 'High';
  if (value >= 48) return 'Moderate';
  return 'Low';
}

export function detectPullback({ livePrice, recentHigh, ema9, ema21 }) {
  const referenceHigh = recentHigh ?? livePrice ?? 0;
  const pullbackPercent = round(((referenceHigh - (livePrice ?? 0)) / Math.max(referenceHigh, 1)) * 100);
  const holdingEmaZone = (livePrice ?? 0) >= Math.min(ema9 ?? 0, ema21 ?? 0) * 0.995;

  return {
    pullbackPercent,
    healthyPullback: pullbackPercent >= 0.6 && pullbackPercent <= 2.8 && holdingEmaZone,
    deepPullback: pullbackPercent > 2.8,
    holdingEmaZone,
  };
}

export function approximateNearestSupport({ levels, candles, ema21, vwap }) {
  const candleSupport = Math.min(...((candles ?? []).slice(-8).map((candle) => candle.low) || [ema21 ?? vwap ?? 0]));
  return round(Math.max(levels?.support ?? candleSupport, Math.min(ema21 ?? candleSupport, vwap ?? candleSupport)));
}

export function approximateNearestResistance({ levels, candles, recentHigh }) {
  const candleResistance = Math.max(...((candles ?? []).slice(-8).map((candle) => candle.high) || [recentHigh ?? 0]));
  return round(Math.max(levels?.resistance ?? candleResistance, recentHigh ?? candleResistance));
}

export function suggestStopLoss({ livePrice, support, atrValue, entryLabel }) {
  const atrUnit = atrValue || (livePrice ?? 0) * 0.01;
  const cushion = entryLabel === 'RISKY' ? atrUnit * 1.15 : entryLabel === 'WAIT' ? atrUnit * 0.95 : atrUnit * 0.8;
  return round(Math.min((livePrice ?? 0) - cushion, (support ?? livePrice ?? 0) - atrUnit * 0.35));
}

export function suggestTarget({ livePrice, resistance, atrValue, entryLabel, bullishBias }) {
  const atrUnit = atrValue || (livePrice ?? 0) * 0.01;
  const multiplier = entryLabel === 'IDEAL' ? 1.25 : entryLabel === 'WAIT' ? 1 : 0.75;
  const directionalTarget = bullishBias
    ? (livePrice ?? 0) + atrUnit * multiplier
    : (livePrice ?? 0) - atrUnit * multiplier;

  if (bullishBias) {
    return round(Math.min(resistance ?? directionalTarget, directionalTarget));
  }

  return round(directionalTarget);
}

export function buildBuyZoneAnalysis({
  livePrice,
  ema9,
  ema21,
  rsi14,
  trendDirection,
  trendStrength,
  support,
  resistance,
  candles,
  atrValue,
}) {
  const recentHigh = Math.max(...((candles ?? []).slice(-10).map((candle) => candle.high) || [livePrice ?? 0]));
  const pullback = detectPullback({ livePrice, recentHigh, ema9, ema21 });
  const supportLevel = approximateNearestSupport({ levels: { support }, candles, ema21, vwap: ema9 });
  const resistanceLevel = approximateNearestResistance({ levels: { resistance }, candles, recentHigh });
  const bullishTrend = trendDirection === 'Bullish' && (trendStrength ?? 0) >= 55 && (ema9 ?? 0) >= (ema21 ?? 0);
  const nearSupport = (livePrice ?? 0) <= supportLevel * 1.018;
  const extendedAboveEma = ((livePrice ?? 0) - (ema9 ?? livePrice ?? 0)) / Math.max(ema9 ?? 1, 1) >= 0.012;
  const overbought = (rsi14 ?? 50) >= 70;
  const reasons = [];

  if (bullishTrend) reasons.push('Trend confirmation remains bullish.');
  if (pullback.healthyPullback) reasons.push(`Healthy pullback of ${pullback.pullbackPercent}% is near EMA support.`);
  if (nearSupport) reasons.push('Price is trading close to support.');
  if (overbought) reasons.push('RSI is overbought, so fresh entry risk is higher.');
  if (extendedAboveEma) reasons.push('Price is extended above EMA support.');
  if (!bullishTrend) reasons.push('Trend confirmation is not strong enough for an ideal entry.');

  let entryLabel = 'WAIT';
  let inBuyZone = false;

  if (bullishTrend && pullback.healthyPullback && !overbought && !extendedAboveEma) {
    entryLabel = 'IDEAL';
    inBuyZone = true;
  } else if (bullishTrend && (nearSupport || pullback.holdingEmaZone) && !overbought) {
    entryLabel = 'WAIT';
  } else {
    entryLabel = 'RISKY';
  }

  const atrUnit = atrValue || (livePrice ?? 0) * 0.01;
  const entryRange =
    bullishTrend
      ? {
          min: round(Math.max(supportLevel, (ema21 ?? livePrice ?? 0) - atrUnit * 0.25)),
          max: round(Math.min((ema9 ?? livePrice ?? 0) + atrUnit * 0.15, livePrice ?? 0)),
        }
      : null;

  return {
    inBuyZone,
    entryLabel,
    entryRange,
    reasons: reasons.slice(0, 4),
    pullback,
    nearestSupport: supportLevel,
    nearestResistance: resistanceLevel,
  };
}

export function buildExitPlan({
  livePrice,
  rsi14,
  ema9,
  ema21,
  momentumPercent,
  stopLoss,
  target,
  support,
}) {
  const reasons = [];
  const targetReached = (livePrice ?? 0) >= (target ?? Number.POSITIVE_INFINITY) * 0.995;
  const bearishCross = (ema9 ?? 0) < (ema21 ?? 0);
  const momentumWeakening = (momentumPercent ?? 0) < 0.2;
  const overbought = (rsi14 ?? 50) >= 72;
  const stopLossBroken = (livePrice ?? 0) <= (stopLoss ?? 0);
  const nearSupportBreak = (livePrice ?? 0) <= (support ?? 0) * 0.998;

  let action = 'HOLD';

  if (stopLossBroken || nearSupportBreak) {
    action = 'STOP_LOSS';
    reasons.push('Price has broken the stop-loss or key support.');
  } else if (bearishCross && (momentumWeakening || overbought)) {
    action = 'EXIT';
    reasons.push('Bearish EMA crossover is appearing with weaker momentum.');
  } else if (targetReached || overbought || momentumWeakening) {
    action = 'PARTIAL_EXIT';
    reasons.push('Target is near or momentum is cooling, so partial profit booking is safer.');
  } else {
    reasons.push('Trend and momentum are still good enough to keep holding.');
  }

  if (overbought) reasons.push('RSI is overbought.');
  if (bearishCross) reasons.push('EMA9 is below EMA21.');
  if (momentumWeakening) reasons.push('Recent momentum is weakening.');

  return {
    action,
    reasons: reasons.slice(0, 4),
  };
}

export function buildCombinedTradeGuidance({ prediction, buyZone, exitPlan, stopLoss, target }) {
  return {
    prediction,
    buyZone,
    exitPlan,
    stopLoss,
    target,
  };
}

export function buildEntryZoneEngine({
  livePrice,
  support,
  resistance,
  ema9,
  ema21,
  vwap,
  atrValue,
  trendDirection,
  momentumStrength = 0,
  pullbackProbability = 0,
  predictionDirection = 'SIDEWAYS',
  predictionConfidence = 0,
  expectedMoveMin = 0,
  expectedMoveMax = 0,
  volatilityPercent = 0,
  marketStatus = 'UNKNOWN',
}) {
  const price = livePrice ?? 0;
  const atrUnit = atrValue || price * 0.008;
  const nearestSupport = support ?? Math.min(ema21 ?? price, vwap ?? price, price);
  const nearestResistance = resistance ?? Math.max(ema9 ?? price, vwap ?? price, price);
  const isBullish = predictionDirection === 'UP' || trendDirection === 'Bullish';
  const isBearish = predictionDirection === 'DOWN' || trendDirection === 'Bearish';
  const isSideways = predictionDirection === 'SIDEWAYS' || predictionDirection === 'NONE' || trendDirection === 'Sideways';
  const fairValue = round(((ema9 ?? price) + (ema21 ?? price) + (vwap ?? price)) / 3 || price);
  const bestEntryZone = isBullish
    ? buildRange(Math.max(nearestSupport, fairValue - atrUnit * 0.35), Math.min(price, fairValue + atrUnit * 0.12))
    : isBearish
      ? buildRange(Math.max(price, fairValue - atrUnit * 0.1), Math.min(nearestResistance, fairValue + atrUnit * 0.4))
      : null;
  const earlyEntryZone = isBullish
    ? buildRange(Math.max(nearestSupport, fairValue - atrUnit * 0.1), Math.min(price + atrUnit * 0.18, nearestResistance))
    : isBearish
      ? buildRange(Math.max(price, fairValue + atrUnit * 0.08), Math.min(nearestResistance, price + atrUnit * 0.45))
      : null;
  const safeEntryZone = isBullish
    ? buildRange(Math.max(nearestSupport, (ema21 ?? fairValue) - atrUnit * 0.18), Math.min(fairValue, ema9 ?? fairValue))
    : isBearish
      ? buildRange(Math.max(ema9 ?? fairValue, fairValue), Math.min(nearestResistance, (ema21 ?? fairValue) + atrUnit * 0.18))
      : null;

  const supportGapPercent = round(((price - nearestSupport) / Math.max(price, 1)) * 100);
  const resistanceGapPercent = round(((nearestResistance - price) / Math.max(price, 1)) * 100);
  const fairGapPercent = round((Math.abs(price - fairValue) / Math.max(price, 1)) * 100);
  const chaseRiskValue = clamp(
    round(fairGapPercent * 30 + Math.max(0, volatilityPercent - 2.4) * 8 + (isBullish && resistanceGapPercent < 0.9 ? 18 : 0)),
    0,
    100,
  );
  const stopLossZone = isBullish
    ? buildRange(nearestSupport - atrUnit * 0.75, nearestSupport - atrUnit * 0.35)
    : isBearish
      ? buildRange(nearestResistance + atrUnit * 0.35, nearestResistance + atrUnit * 0.75)
      : buildRange(price - atrUnit * 0.7, price - atrUnit * 0.35);
  const invalidationLevel = isBullish
    ? stopLossZone.max
    : isBearish
      ? stopLossZone.min
      : round(price - atrUnit * 0.4);

  const estimatedUpsidePercent =
    isBullish
      ? round(Math.max(expectedMoveMax || resistanceGapPercent || 0.35, 0.2))
      : isBearish
        ? round(Math.max((expectedMoveMax ? Math.abs(expectedMoveMax) : supportGapPercent) || 0.35, 0.2))
        : round(Math.max(Math.abs(expectedMoveMax || 0.2), 0.2));
  const estimatedDownsidePercent =
    isBullish
      ? round(Math.max(((price - invalidationLevel) / Math.max(price, 1)) * 100, 0.2))
      : isBearish
        ? round(Math.max(((invalidationLevel - price) / Math.max(price, 1)) * 100, 0.2))
        : round(Math.max(volatilityPercent * 0.35, 0.2));
  const rewardRiskRatio = round(estimatedUpsidePercent / Math.max(estimatedDownsidePercent, 0.1));

  let actionSummary = 'No trade';
  if (isBullish && predictionConfidence >= 68 && pullbackProbability >= 45 && chaseRiskValue < 62) {
    actionSummary = 'Buy on dip';
  } else if (isBullish && chaseRiskValue >= 62) {
    actionSummary = 'Avoid chasing';
  } else if (isBullish) {
    actionSummary = 'Wait for pullback';
  } else if (isBearish) {
    actionSummary = 'Avoid weak long entry';
  } else if (isSideways) {
    actionSummary = 'No trade';
  }

  const zoneQualityScore = clamp(
    round(
      predictionConfidence * 0.38 +
        (isBullish || isBearish ? 14 : -8) +
        Math.max(0, 70 - chaseRiskValue) * 0.18 +
        Math.max(0, 55 - Math.abs(volatilityPercent - 2.5) * 10) * 0.16 +
        rewardRiskRatio * 10 +
        (marketStatus === 'CLOSED' ? -8 : 0),
    ),
    18,
    96,
  );

  const setupFailureCondition = isBullish
    ? 'Bullish setup fails if price loses support and closes below the stop-loss zone.'
    : isBearish
      ? 'Bearish setup fails if price reclaims resistance and invalidates the rejection zone.'
      : 'Wait for a clean breakout or breakdown before acting.';

  return {
    bestEntryZone,
    earlyEntryZone,
    safeEntryZone,
    chaseRiskLevel: chaseRiskLabel(chaseRiskValue),
    chaseRiskValue,
    stopLossZone,
    invalidationLevel: round(invalidationLevel),
    setupFailureCondition,
    actionSummary,
    zoneQualityScore,
    planningLabel: marketStatus === 'CLOSED' ? 'Next session planning' : 'Active session planning',
    riskReward: {
      estimatedUpsidePercent,
      estimatedDownsidePercent,
      rewardRiskRatio,
      qualityBadge: qualityBadge(zoneQualityScore),
    },
    display: {
      bestEntryZone: rangeText(bestEntryZone),
      earlyEntryZone: rangeText(earlyEntryZone),
      safeEntryZone: rangeText(safeEntryZone),
      stopLossZone: rangeText(stopLossZone),
    },
  };
}

export function buildExitZoneEngine({
  livePrice,
  support,
  resistance,
  atrValue,
  expectedMoveMax = 0,
  trendDirection,
  signalWeakening = false,
  volatilityPercent = 0,
  marketStatus = 'UNKNOWN',
  predictionDirection = 'SIDEWAYS',
}) {
  const price = livePrice ?? 0;
  const atrUnit = atrValue || price * 0.008;
  const ceiling = resistance ?? price + atrUnit;
  const floor = support ?? price - atrUnit;
  const isBullish = predictionDirection === 'UP' || trendDirection === 'Bullish';
  const isBearish = predictionDirection === 'DOWN' || trendDirection === 'Bearish';
  const movePercent = Math.abs(expectedMoveMax || 0.35);

  const profitBookingZone = isBullish
    ? buildRange(Math.min(ceiling, price + atrUnit * 0.45), Math.min(ceiling, price + atrUnit * 0.72))
    : buildRange(Math.max(floor, price - atrUnit * 0.72), Math.max(floor, price - atrUnit * 0.45));
  const partialExitZone = isBullish
    ? buildRange(price + atrUnit * 0.28, price + atrUnit * 0.48)
    : buildRange(price - atrUnit * 0.48, price - atrUnit * 0.28);
  const fullExitZone = isBullish
    ? buildRange(Math.min(ceiling, price + atrUnit * 0.62), Math.min(ceiling + atrUnit * 0.2, price + atrUnit * 0.95))
    : buildRange(Math.max(floor - atrUnit * 0.2, price - atrUnit * 0.95), Math.max(floor, price - atrUnit * 0.62));
  const riskyHoldWarning =
    signalWeakening || volatilityPercent > 4.8
      ? 'Risky hold: momentum is weakening or volatility is expanding.'
      : isBearish
        ? 'Risky hold for longs if weakness continues.'
        : 'Hold is acceptable only while momentum remains intact.';
  const actionSummary = isBullish
    ? signalWeakening
      ? 'Partial profit near resistance'
      : 'Hold and trail profits carefully'
    : isBearish
      ? 'Exit if weakness increases'
      : 'No trade';

  return {
    profitBookingZone,
    partialExitZone,
    fullExitZone,
    riskyHoldWarning,
    actionSummary,
    planningLabel: marketStatus === 'CLOSED' ? 'Next session planning' : 'Active session planning',
    display: {
      profitBookingZone: rangeText(profitBookingZone),
      partialExitZone: rangeText(partialExitZone),
      fullExitZone: rangeText(fullExitZone),
      expectedMoveCeiling: `${movePercent}%`,
    },
  };
}
