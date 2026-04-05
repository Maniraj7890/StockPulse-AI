function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 0) {
  return Number((value ?? 0).toFixed(decimals));
}

function upper(value = '') {
  return String(value ?? '').toUpperCase();
}

function normalizeMarketStatus(status = 'UNKNOWN') {
  return upper(status || 'UNKNOWN');
}

function isClosedSession(status = 'UNKNOWN') {
  return ['CLOSED', 'POSTMARKET', 'WEEKEND_CLOSED', 'HOLIDAY'].includes(normalizeMarketStatus(status));
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function humanizeDirection(direction = 'SIDEWAYS') {
  if (direction === 'UP') return 'bullish';
  if (direction === 'DOWN') return 'bearish';
  return 'sideways';
}

function scoreComponent(value, maxScore = 25, divisor = 4) {
  return clamp(round((Number(value) || 0) / divisor), 0, maxScore);
}

function buildTradeQualityScore({ prediction = {}, entryZonePlan = {}, zoneQuality = 0, rewardRiskRatio = 0 }) {
  const trendAlignment = scoreComponent(
    prediction?.layers?.trend?.strength ?? prediction?.debug?.trendScore ?? prediction?.bullishScore ?? 0,
    25,
    4,
  );
  const momentumStrength = scoreComponent(
    prediction?.layers?.momentum?.strength ?? prediction?.debug?.momentumScore ?? prediction?.confidence ?? 0,
    25,
    4,
  );
  const structureClarity = scoreComponent(
    entryZonePlan?.zoneQualityScore ?? zoneQuality ?? prediction?.layers?.structure?.structureStrength ?? 0,
    25,
    4,
  );
  const riskRewardQuality = clamp(
    round(
      Math.min(25, (Number(rewardRiskRatio) || 0) * 10) +
        Math.min(8, Math.max(0, ((entryZonePlan?.zoneQualityScore ?? zoneQuality ?? 0) - 55) / 8)),
    ),
    0,
    25,
  );

  return {
    total: clamp(trendAlignment + momentumStrength + structureClarity + riskRewardQuality, 0, 100),
    breakdown: {
      trendAlignment,
      momentumStrength,
      structureClarity,
      riskRewardQuality,
    },
  };
}

function buildDecisionStrength(confidence = 0, tradeQualityScore = 0, noTrade = false) {
  if (noTrade && confidence < 55) return 'WEAK';
  if (confidence >= 68 && tradeQualityScore >= 72) return 'STRONG';
  if (confidence >= 50 && tradeQualityScore >= 52) return 'MODERATE';
  return 'WEAK';
}

function buildRiskSummary({
  prediction = {},
  invalidation = null,
  marketStatus = 'UNKNOWN',
  rewardRiskRatio = 0,
}) {
  const confidence = Number(prediction?.confidence) || 0;
  const direction = prediction?.direction ?? 'SIDEWAYS';
  const riskLevel =
    prediction?.riskLevel ??
    (confidence >= 68 && rewardRiskRatio >= 1.6 && !isClosedSession(marketStatus)
      ? 'LOW'
      : confidence >= 52 && rewardRiskRatio >= 1.1
        ? 'MODERATE'
        : 'HIGH');

  const worstCaseScenario =
    direction === 'UP'
      ? 'The setup can fail if price slips through support and momentum weakens further.'
      : direction === 'DOWN'
        ? 'The downside call can fail if price reclaims resistance and selling pressure fades.'
        : 'The setup may stay directionless and produce noisy price movement.';

  const safePositionSizingNote =
    riskLevel === 'LOW'
      ? 'Normal sizing still needs a defined invalidation level.'
      : riskLevel === 'MODERATE'
        ? 'Use smaller sizing until trend and structure stay aligned.'
        : 'Keep size light or avoid the setup until conditions improve.';

  return {
    riskLevel,
    worstCaseScenario,
    invalidationPoint: invalidation,
    safePositionSizingNote,
  };
}

function buildConfidenceExplanation({
  prediction = {},
  marketStatus = 'UNKNOWN',
  rewardRiskRatio = 0,
}) {
  const notes = [];
  if ((prediction?.layers?.momentum?.direction ?? 'mixed') === 'mixed') {
    notes.push('Momentum is mixed, reducing confidence.');
  }
  if ((prediction?.layers?.structure?.direction ?? 'mixed') === 'mixed' || rewardRiskRatio < 1.1) {
    notes.push('Structure is unclear, so risk/reward is less attractive.');
  }
  if ((prediction?.layers?.volatility?.volatilityState ?? 'moderate') === 'elevated') {
    notes.push('Volatility is elevated, which makes the setup noisier.');
  }
  if ((prediction?.layers?.volatility?.volatilityState ?? 'moderate') === 'low') {
    notes.push('Volatility is low, which increases sideways risk.');
  }
  if (isClosedSession(marketStatus)) {
    notes.push('Market is closed, so this is treated as a next-session estimate.');
  }
  if (prediction?.stale) {
    notes.push('Data is stale, so confidence is capped lower.');
  }

  if (!notes.length && (prediction?.confidence ?? 0) >= 65) {
    notes.push('Multiple confluence layers are aligned, which supports higher confidence.');
  }

  return {
    summary: notes[0] ?? 'Confidence is moderate because the setup still needs confirmation.',
    missingForHigherConfidence:
      notes.length > 1
        ? notes.slice(1, 3)
        : ['Cleaner structure and stronger momentum would improve conviction.'],
  };
}

function buildWhyPanel({ prediction = {}, marketStatus = 'UNKNOWN', riskSummary, confidenceExplanation }) {
  return {
    trendExplanation:
      prediction?.trendSummary ??
      `Trend is ${humanizeDirection(prediction?.direction)} but still needs confirmation.`,
    momentumExplanation:
      prediction?.momentumSummary ??
      'Momentum is not giving a strong extra edge right now.',
    structureExplanation:
      prediction?.structureSummary ??
      'Nearby support and resistance are still shaping the setup.',
    riskExplanation: confidenceExplanation.summary ?? riskSummary.worstCaseScenario,
    sessionContext:
      prediction?.sessionSummary ??
      (isClosedSession(marketStatus)
        ? 'Market is closed, so the setup is based on last session data.'
        : 'Live market conditions support a fresher read.'),
  };
}

function buildDecisionReasoning({
  prediction = {},
  entryZonePlan = {},
  exitZonePlan = {},
  riskSummary,
  marketStatus = 'UNKNOWN',
  tradeQuality,
  rewardRiskRatio = 0,
}) {
  const detailed = [];

  if (prediction?.trendSummary) detailed.push(prediction.trendSummary);
  if (prediction?.momentumSummary) detailed.push(prediction.momentumSummary);
  if (prediction?.structureSummary) detailed.push(prediction.structureSummary);
  if (prediction?.volatilitySummary) detailed.push(prediction.volatilitySummary);
  if (entryZonePlan?.actionSummary) detailed.push(`Suggested action: ${entryZonePlan.actionSummary}.`);
  if (exitZonePlan?.actionSummary) detailed.push(`Exit context: ${exitZonePlan.actionSummary}.`);
  if (rewardRiskRatio > 0) {
    detailed.push(
      rewardRiskRatio >= 1.4
        ? `Risk/reward is usable at roughly ${rewardRiskRatio}.`
        : `Risk/reward is weak at roughly ${rewardRiskRatio}, so patience matters.`,
    );
  }
  detailed.push(
    riskSummary?.riskLevel === 'HIGH'
      ? 'Risk is elevated, so avoiding or waiting is safer.'
      : 'Risk stays manageable only while invalidation is respected.',
  );
  if (isClosedSession(marketStatus)) {
    detailed.push('Market is closed, so this should be treated as a next-session plan rather than a live trigger.');
  }

  const short =
    detailed[0] ??
    (prediction?.direction === 'UP'
      ? 'Bullish case is present, but confirmation still matters.'
      : prediction?.direction === 'DOWN'
        ? 'Bearish pressure is present, but confirmation still matters.'
        : 'No clear edge is available, so waiting is safer.');

  return {
    short,
    detailed: [...new Set(detailed)].slice(0, 5),
  };
}

function buildFinalDecision({
  prediction = {},
  entryZonePlan = {},
  exitZonePlan = {},
  tradeQualityScore = 0,
  rewardRiskRatio = 0,
  marketStatus = 'UNKNOWN',
}) {
  const confidence = Number(prediction?.confidence) || 0;
  const direction = prediction?.direction ?? 'SIDEWAYS';
  const signal = upper(prediction?.signal ?? 'HOLD');
  const poorRiskReward = rewardRiskRatio > 0 && rewardRiskRatio < 1.05;
  const lowQuality = tradeQualityScore < 48 || (entryZonePlan?.zoneQualityScore ?? 0) < 42;
  const weakSetup = confidence < 48 || direction === 'SIDEWAYS' || direction === 'NONE';
  const noTrade =
    weakSetup ||
    poorRiskReward ||
    lowQuality ||
    upper(entryZonePlan?.actionSummary ?? '').includes('NO TRADE');

  if (signal.includes('SELL') || ['STOP_LOSS', 'EXIT'].includes(upper(exitZonePlan?.action ?? ''))) {
    return {
      finalDecision: 'SELL',
      noTrade: false,
    };
  }

  if (noTrade) {
    return {
      finalDecision: poorRiskReward || lowQuality ? 'AVOID' : 'WAIT',
      noTrade: true,
    };
  }

  if (direction === 'UP' && confidence >= 56) {
    return {
      finalDecision: isClosedSession(marketStatus) ? 'WAIT' : 'BUY',
      noTrade: false,
    };
  }

  if (direction === 'DOWN' && confidence >= 56) {
    return {
      finalDecision: 'SELL',
      noTrade: false,
    };
  }

  return {
    finalDecision: 'WAIT',
    noTrade: true,
  };
}

export function buildDecisionSupport({
  symbol = 'UNKNOWN',
  prediction = {},
  entryZonePlan = {},
  exitZonePlan = {},
  marketStatus = 'UNKNOWN',
  recentSignals = [],
  zoneQuality = 0,
  rewardRiskRatio = 0,
  invalidation = null,
}) {
  const tradeQuality = buildTradeQualityScore({
    prediction,
    entryZonePlan,
    zoneQuality,
    rewardRiskRatio,
  });
  const decision = buildFinalDecision({
    prediction,
    entryZonePlan,
    exitZonePlan,
    tradeQualityScore: tradeQuality.total,
    rewardRiskRatio,
    marketStatus,
  });
  const riskSummary = buildRiskSummary({
    prediction,
    invalidation,
    marketStatus,
    rewardRiskRatio,
  });
  const confidenceExplanation = buildConfidenceExplanation({
    prediction,
    marketStatus,
    rewardRiskRatio,
  });
  const whyPanel = buildWhyPanel({
    prediction,
    marketStatus,
    riskSummary,
    confidenceExplanation,
  });
  const reasoning = buildDecisionReasoning({
    prediction,
    entryZonePlan,
    exitZonePlan,
    riskSummary,
    marketStatus,
    tradeQuality,
    rewardRiskRatio,
  });
  const lastThreeSignalStates = asArray(recentSignals).slice(0, 3).map((item) => upper(item?.direction ?? item?.signal ?? 'SIDEWAYS'));
  const uniqueRecentStates = [...new Set(lastThreeSignalStates)];
  const stabilityScore = clamp(
    round(
      (prediction?.diagnostics?.consistencyScore ?? 45) * 0.45 +
        Math.max(0, 100 - Math.abs(prediction?.finalSignalScore ?? 0) * 1.1) * 0.08 +
        (prediction?.diagnostics?.persisted ? 12 : 0) +
        (uniqueRecentStates.length <= 1 ? 20 : uniqueRecentStates.length === 2 ? 8 : -8),
    ),
    25,
    92,
  );
  const flipWarning = uniqueRecentStates.length >= 3 || stabilityScore < 44;
  const decisionStrength = buildDecisionStrength(prediction?.confidence ?? 0, tradeQuality.total, decision.noTrade);

  return {
    symbol,
    finalDecision: decision.finalDecision,
    decisionStrength,
    decisionReasonShort: reasoning.short,
    decisionReasonDetailed: reasoning.detailed,
    noTradeMessage: decision.noTrade ? 'No clear edge — avoid trading this setup.' : null,
    tradeQualityScore: tradeQuality.total,
    tradeQualityBreakdown: tradeQuality.breakdown,
    whyPanel,
    confidenceExplanation,
    risk: riskSummary,
    actionClarity: {
      finalAction: decision.finalDecision,
      entryZone: entryZonePlan?.display?.bestEntryZone ?? 'Monitor',
      stopLoss: entryZonePlan?.display?.stopLossZone ?? 'Monitor',
      targetZone: exitZonePlan?.display?.profitBookingZone ?? exitZonePlan?.display?.partialExitZone ?? 'Monitor',
      confidence: prediction?.confidence ?? 0,
    },
    stabilityScore,
    lastThreeSignalStates,
    flipWarning,
    stabilityReason:
      prediction?.diagnostics?.stabilityReason ??
      (flipWarning
        ? 'Signal has been unstable recently, so patience matters more.'
        : 'Signal persistence is acceptable and avoids noisy flips.'),
    trustNote:
      decision.noTrade
        ? 'No trade is also a decision.'
        : decision.finalDecision === 'WAIT'
          ? 'Wait is a valid strategy until structure improves.'
          : 'Respect structure, invalidation, and position sizing.',
    aiReadyDecisionInput: {
      symbol,
      finalDecision: decision.finalDecision,
      decisionStrength,
      decisionReasonShort: reasoning.short,
      decisionReasonDetailed: reasoning.detailed,
      tradeQualityScore: tradeQuality.total,
      riskLevel: riskSummary.riskLevel,
      confidence: prediction?.confidence ?? 0,
      whyPanel,
      marketStatus,
    },
  };
}

export function enrichDecisionWithHistory(decision = null, history = [], symbol = 'UNKNOWN') {
  if (!decision) return decision;

  const recentSignals = asArray(history)
    .filter((item) => item?.symbol === symbol)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 3)
    .map((item) => upper(item?.direction ?? item?.signal ?? 'SIDEWAYS'));
  const uniqueRecentStates = [...new Set(recentSignals)];
  const stabilityScore = clamp(
    round((decision?.stabilityScore ?? 50) * 0.7 + (uniqueRecentStates.length <= 1 ? 24 : uniqueRecentStates.length === 2 ? 10 : -6)),
    20,
    95,
  );
  const flipWarning = uniqueRecentStates.length >= 3 || stabilityScore < 44;

  return {
    ...decision,
    lastThreeSignalStates: recentSignals,
    stabilityScore,
    flipWarning,
    stabilityReason:
      recentSignals.length >= 3 && uniqueRecentStates.length >= 3
        ? 'Recent signal history has flipped often, so the setup needs extra confirmation.'
        : decision?.stabilityReason,
  };
}
