import { getExpectedMoveLabel, getPriceLabel, getStatusLabel, UI_LABELS } from '@/utils/displayLabels';

function safeRange(min, max, text = null) {
  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    text: text ?? null,
  };
}

export function buildAnalysisViewModel(stock = {}, latest = null, signalOutcome = null) {
  const quote = latest ?? stock.live ?? {};
  const prediction = stock.prediction ?? {};
  const oneHour = stock.shortTermPredictions?.oneHour ?? {};
  const fifteen = stock.shortTermPredictions?.fifteenMinutes ?? {};
  const thirty = stock.shortTermPredictions?.thirtyMinutes ?? {};
  const isClosedSession = quote.marketStatus === 'CLOSED' || quote.marketStatus === 'POSTMARKET';

  return {
    symbol: stock.symbol ?? quote.symbol ?? 'UNKNOWN',
    displayName: stock.companyName ?? stock.label ?? stock.symbol ?? quote.symbol ?? 'Unknown',
    currentPrice: quote.ltp ?? stock.currentPrice ?? null,
    previousClose: quote.prevClose ?? quote.previousClose ?? null,
    changePercent: quote.changePercent ?? stock.dayChangePercent ?? null,
    marketStatus: quote.marketStatus ?? 'UNKNOWN',
    marketStatusLabel: getStatusLabel(quote.marketStatus, quote.marketStatusDetail),
    marketStatusReason: quote.marketStatusReason ?? null,
    lastUpdated: quote.lastUpdated ?? stock.lastUpdated ?? null,
    freshnessNote: quote.freshnessNote ?? null,

    direction: oneHour.direction ?? prediction.direction ?? 'SIDEWAYS',
    confidence: oneHour.confidence ?? prediction.confidence ?? stock.signal?.confidence ?? 0,
    quality: oneHour.quality ?? prediction.quality ?? stock.signal?.quality ?? 'WEAK',
    bullishScore: oneHour.bullishScore ?? prediction.bullishScore ?? 0,
    bearishScore: oneHour.bearishScore ?? prediction.bearishScore ?? 0,
    sidewaysScore: oneHour.sidewaysScore ?? prediction.sidewaysScore ?? 0,

    trendSummary: prediction.trendSummary ?? stock.trend?.direction ?? null,
    momentumSummary: prediction.momentumSummary ?? null,
    structureSummary: prediction.structureSummary ?? null,
    volatilitySummary: prediction.volatilitySummary ?? null,
    sessionSummary: prediction.sessionSummary ?? null,

    support: stock.supportResistance?.support ?? prediction.support ?? null,
    resistance: stock.supportResistance?.resistance ?? prediction.resistance ?? null,
    invalidation: prediction.invalidation ?? stock.invalidationLevel ?? stock.stopLoss ?? null,
    expectedMove15m: safeRange(fifteen.expectedMoveMin, fifteen.expectedMoveMax, fifteen.expectedMoveText),
    expectedMove30m: safeRange(thirty.expectedMoveMin, thirty.expectedMoveMax, thirty.expectedMoveText),
    expectedMove1h: safeRange(oneHour.expectedMoveMin, oneHour.expectedMoveMax, oneHour.expectedMoveText),

    actionBias:
      prediction.actionBias ??
      stock.entryZonePlan?.actionSummary ??
      stock.exitZonePlan?.actionSummary ??
      stock.tradeGuidance?.actionSummary ??
      'No trade',
    finalDecision: stock.decision?.finalDecision ?? 'WAIT',
    decisionStrength: stock.decision?.decisionStrength ?? 'WEAK',
    decisionReasonShort: stock.decision?.decisionReasonShort ?? 'No clear edge — avoid trading this setup.',
    decisionReasonDetailed: stock.decision?.decisionReasonDetailed ?? [],
    tradeQualityScore: stock.decision?.tradeQualityScore ?? 0,
    tradeQualityBreakdown: stock.decision?.tradeQualityBreakdown ?? null,
    whyPanel: stock.decision?.whyPanel ?? null,
    confidenceExplanation: stock.decision?.confidenceExplanation ?? null,
    riskSummary: stock.decision?.risk ?? null,
    actionClarity: stock.decision?.actionClarity ?? null,
    stabilityScore: stock.decision?.stabilityScore ?? 0,
    lastThreeSignalStates: stock.decision?.lastThreeSignalStates ?? [],
    flipWarning: Boolean(stock.decision?.flipWarning),
    entryZone: stock.entryZonePlan?.display?.bestEntryZone ?? null,
    safeEntryZone: stock.entryZonePlan?.display?.safeEntryZone ?? null,
    aggressiveEntryZone: stock.entryZonePlan?.display?.earlyEntryZone ?? null,
    partialExitZone: stock.exitZonePlan?.display?.partialExitZone ?? null,
    fullExitZone: stock.exitZonePlan?.display?.fullExitZone ?? null,
    stopLossZone: stock.entryZonePlan?.display?.stopLossZone ?? null,
    zoneQuality: stock.entryZonePlan?.zoneQualityScore ?? stock.setupCleanliness ?? null,
    rewardRiskRatio: stock.entryZonePlan?.riskReward?.rewardRiskRatio ?? stock.signal?.riskRewardRatio ?? null,

    whyThisPrediction: prediction.whyThisPrediction ?? stock.signal?.reasons ?? stock.reasons ?? [],
    setupFamily: stock.setupFamily ?? signalOutcome?.setupFamily ?? 'mixed sideways',
    signalOutcome: signalOutcome?.outcome ?? null,
    aiReadyExplanationInput: {
      symbol: stock.symbol ?? quote.symbol ?? 'UNKNOWN',
      marketStatus: quote.marketStatus ?? 'UNKNOWN',
      signal: prediction.signal ?? stock.signal?.signal ?? 'HOLD',
      direction: oneHour.direction ?? prediction.direction ?? 'SIDEWAYS',
      confidence: oneHour.confidence ?? prediction.confidence ?? stock.signal?.confidence ?? 0,
      quality: oneHour.quality ?? prediction.quality ?? stock.signal?.quality ?? 'WEAK',
      bullishScore: oneHour.bullishScore ?? prediction.bullishScore ?? 0,
      bearishScore: oneHour.bearishScore ?? prediction.bearishScore ?? 0,
      sidewaysScore: oneHour.sidewaysScore ?? prediction.sidewaysScore ?? 0,
      trendSummary: prediction.trendSummary ?? null,
      momentumSummary: prediction.momentumSummary ?? null,
      structureSummary: prediction.structureSummary ?? null,
      volatilitySummary: prediction.volatilitySummary ?? null,
      sessionSummary: prediction.sessionSummary ?? null,
      support: stock.supportResistance?.support ?? prediction.support ?? null,
      resistance: stock.supportResistance?.resistance ?? prediction.resistance ?? null,
      invalidation: prediction.invalidation ?? stock.invalidationLevel ?? stock.stopLoss ?? null,
      entryZone: stock.entryZonePlan ?? null,
      exitZone: stock.exitZonePlan ?? null,
      actionBias:
        prediction.actionBias ??
        stock.entryZonePlan?.actionSummary ??
        stock.exitZonePlan?.actionSummary ??
        'No trade',
      decision: stock.decision?.aiReadyDecisionInput ?? null,
      whyThisPrediction: prediction.whyThisPrediction ?? stock.signal?.reasons ?? stock.reasons ?? [],
      lastUpdated: quote.lastUpdated ?? stock.lastUpdated ?? null,
      stale: Boolean(quote.stale),
    },
    aiReadyMarketSummaryInput: null,
    aiReadyAlertContextInput: null,
    labels: {
      price: getPriceLabel(isClosedSession),
      expectedMove: getExpectedMoveLabel(isClosedSession),
      confidence: UI_LABELS.signalConfidence,
      action: UI_LABELS.suggestedAction,
      source: UI_LABELS.liveSource,
    },
  };
}
