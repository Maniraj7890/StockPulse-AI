import { loadVersionedState, saveVersionedState } from '@/utils/storage';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const STORAGE_NAMESPACE = 'signal-history';
const STORAGE_VERSION = 2;

function round(value, decimals = 2) {
  return Number((value ?? 0).toFixed(decimals));
}

function toTimestamp(value) {
  const time = new Date(value ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function safeNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function safeDirection(value) {
  if (value === 'UP' || value === 'DOWN' || value === 'NO_EDGE') return value;
  return 'NO_EDGE';
}

function confidenceBucket(confidence = 0) {
  if (confidence >= 60) return '60-100';
  if (confidence >= 30) return '30-60';
  return '0-30';
}

function confidenceStrength(confidence = 0) {
  if (confidence >= 70) return 'STRONG';
  if (confidence >= 55) return 'MODERATE';
  return 'WEAK';
}

function createSignalId(item) {
  return `${item.symbol}-${item.direction}-${toTimestamp(item.timestamp)}`;
}

function normalizeExpectedMove(value) {
  if (value && typeof value === 'object') {
    return {
      min: safeNumber(value.min, 0),
      max: safeNumber(value.max, 0),
      text: value.text ?? null,
    };
  }

  return {
    min: 0,
    max: 0,
    text: null,
  };
}

function deriveSetupFamily(item = {}) {
  if (item.setupFamily) return item.setupFamily;
  const direction = item.direction ?? 'NO_EDGE';
  const setupType = item.setupType ?? 'No Trade';
  const actionSummary = String(item.actionSummary ?? '').toLowerCase();

  if (direction === 'NO_EDGE') return 'mixed sideways';
  if (setupType === 'Breakout' && direction === 'UP') return 'trend-follow bullish';
  if (setupType === 'Breakdown' && direction === 'DOWN') return 'trend-follow bearish';
  if (setupType === 'Pullback') return 'pullback continuation';
  if (setupType === 'Reversal') return direction === 'UP' ? 'support bounce' : 'resistance rejection';
  if (actionSummary.includes('breakout')) return 'breakout watch';
  if (actionSummary.includes('pullback')) return 'pullback continuation';
  if (actionSummary.includes('support')) return 'support bounce';
  if (actionSummary.includes('resistance')) return 'resistance rejection';
  return direction === 'UP' ? 'trend-follow bullish' : 'trend-follow bearish';
}

function normalizeSignalRecord(item = {}) {
  const direction = safeDirection(item.direction);
  const timestamp = item.timestamp ?? new Date().toISOString();
  const entryPrice = safeNumber(item.entryPrice ?? item.currentPrice);
  const evaluated = Boolean(item.evaluated);
  const exitPrice = item.exitPrice == null ? null : safeNumber(item.exitPrice, null);
  const expectedMove15m = normalizeExpectedMove(item.expectedMove15m);
  const expectedMove30m = normalizeExpectedMove(item.expectedMove30m);
  const expectedMove1h = normalizeExpectedMove(item.expectedMove1h ?? item.expectedMove);
  const outcome = item.outcome ?? (evaluated ? 'PENDING' : null);
  const expectedMoveMid =
    safeNumber(item.expectedMoveMid, round((safeNumber(item.expectedMoveMin, expectedMove1h.min) + safeNumber(item.expectedMoveMax, expectedMove1h.max)) / 2));

  return {
    id: item.id ?? createSignalId({ symbol: item.symbol ?? 'UNKNOWN', direction, timestamp }),
    symbol: item.symbol ?? 'UNKNOWN',
    timestamp,
    marketStatus: item.marketStatus ?? 'UNKNOWN',
    direction,
    confidence: safeNumber(item.confidence),
    confidenceBucket: item.confidenceBucket ?? confidenceBucket(item.confidence),
    quality: String(item.quality ?? confidenceStrength(item.confidence)).toUpperCase(),
    bullishScore: safeNumber(item.bullishScore),
    bearishScore: safeNumber(item.bearishScore),
    sidewaysScore: safeNumber(item.sidewaysScore),
    entryPrice,
    expectedMove15m,
    expectedMove30m,
    expectedMove1h,
    expectedMoveMin: safeNumber(item.expectedMoveMin, expectedMove1h.min),
    expectedMoveMax: safeNumber(item.expectedMoveMax, expectedMove1h.max),
    setupType: item.setupType ?? 'No Trade',
    setupAge: item.setupAge ?? 'Unknown',
    setupFamily: deriveSetupFamily(item),
    entryType: item.entryType ?? 'No Trade',
    actionSummary: item.actionSummary ?? 'Monitor',
    targetZone: item.targetZone ?? null,
    stopLoss: safeNumber(item.stopLoss, item.invalidation ?? entryPrice),
    zoneQuality: safeNumber(item.zoneQuality, item.opportunityScore ?? 0),
    opportunityScore: safeNumber(item.opportunityScore),
    modelHitRate: safeNumber(item.modelHitRate),
    evaluated,
    outcome: evaluated ? outcome ?? 'PENDING' : 'PENDING',
    exitPrice,
    trend: item.trend ?? 'sideways',
    riskLevel: item.riskLevel ?? 'medium',
    support: safeNumber(item.support, entryPrice),
    resistance: safeNumber(item.resistance, entryPrice),
    invalidation: safeNumber(item.invalidation, entryPrice),
    expectedMoveMid,
    moveAchievedPercent: safeNumber(item.moveAchievedPercent, 0),
    drawdownPercent: safeNumber(item.drawdownPercent, 0),
    maxFavorableExcursionPercent: safeNumber(item.maxFavorableExcursionPercent, 0),
    maxAdverseExcursionPercent: safeNumber(item.maxAdverseExcursionPercent, 0),
    reasons: Array.isArray(item.reasons) ? item.reasons : [],
    usefulness: item.usefulness ?? null,
    lastEvaluatedAt: item.lastEvaluatedAt ?? null,
  };
}

export function loadSignalHistory() {
  const parsed = loadVersionedState(STORAGE_NAMESPACE, {
    version: STORAGE_VERSION,
    fallback: [],
    legacyKeys: ['stockpulse.signal-history.v2'],
    validate: (value) => Array.isArray(value),
  });

  return Array.isArray(parsed) ? parsed.map(normalizeSignalRecord) : [];
}

export function saveSignalHistory(history = []) {
  saveVersionedState(STORAGE_NAMESPACE, (history ?? []).slice(0, 400), STORAGE_VERSION);
}

export function recordOneHourSignals(history = [], predictions = [], options = {}) {
  const dedupeWindowMs = options.dedupeWindowMs ?? 15 * 60 * 1000;
  const maxHistory = options.maxHistory ?? 400;
  const nextHistory = (history ?? []).map(normalizeSignalRecord);

  (predictions ?? [])
    .filter((item) => item?.direction === 'UP' || item?.direction === 'DOWN' || item?.direction === 'NO_EDGE')
    .forEach((item) => {
      const timestamp = item?.lastUpdated ?? options.timestamp ?? new Date().toISOString();
      const record = normalizeSignalRecord({
        symbol: item?.symbol,
        timestamp,
        marketStatus: item?.marketStatus ?? item?.live?.marketStatus,
        direction: item?.direction,
        confidence: item?.confidence,
        quality: item?.tier ?? item?.quality,
        bullishScore: item?.bullishScore,
        bearishScore: item?.bearishScore,
        sidewaysScore: item?.sidewaysScore,
        entryPrice: item?.currentPrice ?? item?.live?.ltp ?? 0,
        expectedMove15m: item?.shortTermPredictions?.fifteenMinutes?.expectedMovePercent ?? item?.fifteenMinutes ?? null,
        expectedMove30m: item?.shortTermPredictions?.thirtyMinutes?.expectedMovePercent ?? item?.thirtyMinutes ?? null,
        expectedMove1h:
          item?.horizonForecast
            ? {
                min: item?.expectedMoveMin,
                max: item?.expectedMoveMax,
                text: item?.expectedMoveText,
              }
            : item?.shortTermPredictions?.oneHour?.expectedMovePercent ?? {
                min: item?.expectedMoveMin,
                max: item?.expectedMoveMax,
                text: item?.expectedMoveText,
              },
        expectedMoveMin: item?.expectedMoveMin,
        expectedMoveMax: item?.expectedMoveMax,
        setupType: item?.setupType,
        setupAge: item?.setupAge,
        setupFamily: item?.setupFamily,
        entryType: item?.entryType ?? item?.setupType,
        actionSummary:
          item?.entryZonePlan?.actionSummary ??
          item?.exitZonePlan?.actionSummary ??
          item?.actionBias ??
          item?.buyZone?.entryLabel ??
          'Monitor',
        targetZone:
          item?.exitZonePlan?.display?.profitBookingZone ??
          item?.targets?.standard?.price ??
          item?.target ??
          null,
        stopLoss:
          item?.entryZonePlan?.invalidationLevel ??
          item?.entryZonePlan?.stopLossZone?.max ??
          item?.signal?.tradePlan?.stopLoss ??
          item?.invalidation,
        trend: item?.trend,
        riskLevel: item?.riskLevel,
        support: item?.support,
        resistance: item?.resistance,
        invalidation: item?.invalidation,
        reasons: item?.reasons,
        zoneQuality:
          item?.entryZonePlan?.zoneQualityScore ??
          item?.setupCleanliness ??
          item?.opportunityScore,
        opportunityScore: item?.opportunityScore,
        modelHitRate: item?.modelHitRate,
      });

      const recordTime = toTimestamp(record.timestamp);
      const duplicate = nextHistory.find((existing) => {
        if (existing.symbol !== record.symbol) return false;
        if (existing.direction !== record.direction) return false;
        return Math.abs(recordTime - toTimestamp(existing.timestamp)) < dedupeWindowMs;
      });

      if (!duplicate) {
        nextHistory.unshift(record);
      }
    });

  return nextHistory
    .sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp))
    .slice(0, maxHistory);
}

function evaluateDirectionalOutcome(item, movePercent, threshold, sidewaysThreshold, mfe = 0, mae = 0) {
  if (item.direction === 'UP') {
    if (mfe >= threshold || movePercent >= threshold) return 'SUCCESS';
    if (mae <= -threshold && movePercent <= 0) return 'FAILURE';
    if (mfe > 0) return 'PARTIAL';
    return 'PENDING';
  }

  if (item.direction === 'DOWN') {
    if (mfe <= -threshold || movePercent <= -threshold) return 'SUCCESS';
    if (mae >= threshold && movePercent >= 0) return 'FAILURE';
    if (movePercent < 0 || mfe < 0) return 'PARTIAL';
    return 'PENDING';
  }

  if (Math.abs(movePercent) <= sidewaysThreshold && Math.abs(mae) <= threshold) return 'SUCCESS';
  if (Math.abs(movePercent) >= threshold || Math.abs(mae) >= threshold * 1.25) return 'FAILURE';
  return 'PARTIAL';
}

export function evaluateOneHourSignals(history = [], livePrices = {}, options = {}) {
  const evaluationWindowMs = options.evaluationWindowMs ?? 60 * 60 * 1000;
  const successThresholdPercent = options.successThresholdPercent ?? 0.35;
  const sidewaysThresholdPercent = options.sidewaysThresholdPercent ?? 0.25;
  const now = toTimestamp(options.now ?? new Date().toISOString());

  return (history ?? []).map((rawItem) => {
    const item = normalizeSignalRecord(rawItem);
    if (item.evaluated && item.outcome && item.outcome !== 'PENDING') return item;

    const ageMs = now - toTimestamp(item.timestamp);
    if (ageMs < evaluationWindowMs) {
      return {
        ...item,
        evaluated: false,
        outcome: 'PENDING',
      };
    }

    const quote = livePrices?.[item.symbol];
    const exitPrice = safeNumber(quote?.ltp, null);
    const quoteTime = toTimestamp(quote?.lastUpdated);
    const signalTime = toTimestamp(item.timestamp);

    if (exitPrice == null || quoteTime < signalTime) {
      return {
        ...item,
        evaluated: false,
        outcome: 'PENDING',
        exitPrice: exitPrice ?? item.exitPrice,
        lastEvaluatedAt: options.now ?? new Date().toISOString(),
        usefulness: 'Insufficient later price data.',
      };
    }

    const movePercent = round(((exitPrice - item.entryPrice) / Math.max(item.entryPrice, 1)) * 100);
    const high = safeNumber(quote?.high ?? quote?.dayHigh, exitPrice);
    const low = safeNumber(quote?.low ?? quote?.dayLow, exitPrice);
    const upExcursion = round(((high - item.entryPrice) / Math.max(item.entryPrice, 1)) * 100);
    const downExcursion = round(((low - item.entryPrice) / Math.max(item.entryPrice, 1)) * 100);
    const targetZone = typeof item.targetZone === 'object' ? item.targetZone : null;
    const targetLevel =
      targetZone?.max ??
      targetZone?.min ??
      (typeof item.targetZone === 'number' ? item.targetZone : item.entryPrice + item.expectedMoveMid);
    const stopLossLevel = item.stopLoss ?? item.invalidation ?? null;
    const targetReached =
      item.direction === 'UP'
        ? Number.isFinite(targetLevel) && high >= targetLevel
        : item.direction === 'DOWN'
          ? Number.isFinite(targetLevel) && low <= targetLevel
          : false;
    const stopLossHit =
      item.direction === 'UP'
        ? Number.isFinite(stopLossLevel) && low <= stopLossLevel
        : item.direction === 'DOWN'
          ? Number.isFinite(stopLossLevel) && high >= stopLossLevel
          : false;
    const outcome = evaluateDirectionalOutcome(
      item,
      movePercent,
      successThresholdPercent,
      sidewaysThresholdPercent,
      item.direction === 'DOWN' ? downExcursion : upExcursion,
      item.direction === 'DOWN' ? upExcursion : downExcursion,
    );
    const usefulness =
      targetReached
        ? 'Target zone was reached within the evaluation window.'
        : stopLossHit
          ? 'Stop-loss was hit before the setup could work.'
          : outcome === 'SUCCESS'
            ? 'Prediction aligned with the later move.'
            : outcome === 'PARTIAL'
              ? 'Direction was partly useful, but follow-through was limited.'
              : outcome === 'FAILURE'
                ? 'Prediction did not align with the later move.'
                : 'Not enough movement to judge the setup clearly.';

    return {
      ...item,
      evaluated: outcome !== 'PENDING',
      outcome,
      exitPrice,
      moveAchievedPercent: movePercent,
      drawdownPercent: round(Math.abs(item.direction === 'DOWN' ? upExcursion : downExcursion)),
      maxFavorableExcursionPercent: round(item.direction === 'DOWN' ? Math.abs(downExcursion) : upExcursion),
      maxAdverseExcursionPercent: round(item.direction === 'DOWN' ? Math.abs(upExcursion) : Math.abs(downExcursion)),
      targetReached,
      stopLossHit,
      lastEvaluatedAt: quote?.lastUpdated ?? options.now ?? new Date().toISOString(),
      usefulness,
    };
  });
}

export function calculateSignalAccuracy(history = [], symbol = null) {
  const filtered = (history ?? []).filter(
    (item) =>
      item?.outcome &&
      item.outcome !== 'PENDING' &&
      (!symbol || item.symbol === symbol),
  );
  const success = filtered.filter((item) => item.outcome === 'SUCCESS').length;
  const failure = filtered.filter((item) => item.outcome === 'FAILURE').length;
  const partial = filtered.filter((item) => item.outcome === 'PARTIAL').length;
  const totalSignals = filtered.length;

  return {
    totalSignals,
    success,
    failure,
    partial,
    accuracyPercent: totalSignals ? round(((success + partial * 0.5) / totalSignals) * 100) : 0,
  };
}

function buildStatsBucket() {
  return {
    total: 0,
    success: 0,
    failure: 0,
    partial: 0,
    pending: 0,
    averageConfidence: 0,
    averageExpectedMove: 0,
    reputationScore: 0,
  };
}

function finalizeStatsBucket(bucket) {
  const completed = bucket.total - bucket.pending;
  const weightedSuccess = bucket.success + bucket.partial * 0.5;
  return {
    ...bucket,
    successRate: completed ? round((bucket.success / completed) * 100) : 0,
    failureRate: completed ? round((bucket.failure / completed) * 100) : 0,
    partialRate: completed ? round((bucket.partial / completed) * 100) : 0,
    reputationScore: completed ? round((weightedSuccess / completed) * 100) : 0,
  };
}

export function calculateSetupAccuracy(history = []) {
  const setupMap = {};

  (history ?? []).forEach((item) => {
    const key = item?.setupType ?? 'No Trade';
    setupMap[key] ??= buildStatsBucket();
    setupMap[key].total += 1;
    setupMap[key].averageConfidence += safeNumber(item.confidence);
    setupMap[key].averageExpectedMove += Math.abs(safeNumber(item.expectedMove1h?.max, item.expectedMoveMax));
    if (item.outcome === 'SUCCESS') setupMap[key].success += 1;
    else if (item.outcome === 'FAILURE') setupMap[key].failure += 1;
    else if (item.outcome === 'PARTIAL') setupMap[key].partial += 1;
    else setupMap[key].pending += 1;
  });

  return Object.fromEntries(
    Object.entries(setupMap).map(([key, bucket]) => [
      key,
      finalizeStatsBucket({
        ...bucket,
        averageConfidence: bucket.total ? round(bucket.averageConfidence / bucket.total) : 0,
        averageExpectedMove: bucket.total ? round(bucket.averageExpectedMove / bucket.total) : 0,
      }),
    ]),
  );
}

export function calculateSetupFamilyPerformance(history = []) {
  const familyMap = {};

  (history ?? []).forEach((item) => {
    const key = item?.setupFamily ?? 'mixed sideways';
    familyMap[key] ??= buildStatsBucket();
    familyMap[key].total += 1;
    familyMap[key].averageConfidence += safeNumber(item.confidence);
    familyMap[key].averageExpectedMove += Math.abs(safeNumber(item.expectedMove1h?.max, item.expectedMoveMax));
    if (item.outcome === 'SUCCESS') familyMap[key].success += 1;
    else if (item.outcome === 'FAILURE') familyMap[key].failure += 1;
    else if (item.outcome === 'PARTIAL') familyMap[key].partial += 1;
    else familyMap[key].pending += 1;
  });

  return Object.fromEntries(
    Object.entries(familyMap).map(([key, bucket]) => [
      key,
      finalizeStatsBucket({
        ...bucket,
        averageConfidence: bucket.total ? round(bucket.averageConfidence / bucket.total) : 0,
        averageExpectedMove: bucket.total ? round(bucket.averageExpectedMove / bucket.total) : 0,
      }),
    ]),
  );
}

export function buildSignalHistorySummary(history = []) {
  const normalized = (history ?? []).map(normalizeSignalRecord);
  const evaluated = normalized.filter((item) => item.outcome !== 'PENDING');
  const overall = calculateSignalAccuracy(normalized);
  const setupAccuracy = calculateSetupAccuracy(normalized);
  const setupFamilyPerformance = calculateSetupFamilyPerformance(normalized);
  const directionPerformance = {
    UP: calculateSignalAccuracy(normalized.filter((item) => item.direction === 'UP')),
    DOWN: calculateSignalAccuracy(normalized.filter((item) => item.direction === 'DOWN')),
    NO_EDGE: calculateSignalAccuracy(normalized.filter((item) => item.direction === 'NO_EDGE')),
  };
  const qualityPerformance = ['WEAK', 'MODERATE', 'STRONG'].reduce((accumulator, key) => {
    accumulator[key] = calculateSignalAccuracy(normalized.filter((item) => item.quality === key));
    return accumulator;
  }, {});
  const confidenceBuckets = ['0-30', '30-60', '60-100'].reduce((accumulator, key) => {
    accumulator[key] = calculateSignalAccuracy(normalized.filter((item) => item.confidenceBucket === key));
    return accumulator;
  }, {});
  const averageConfidence = normalized.length
    ? round(normalized.reduce((sum, item) => sum + safeNumber(item.confidence), 0) / normalized.length)
    : 0;
  const averageMoveAchieved = evaluated.length
    ? round(evaluated.reduce((sum, item) => sum + safeNumber(item.moveAchievedPercent), 0) / evaluated.length)
    : 0;
  const averageDrawdown = evaluated.length
    ? round(evaluated.reduce((sum, item) => sum + safeNumber(item.drawdownPercent), 0) / evaluated.length)
    : 0;
  const pendingSignals = normalized.filter((item) => item.outcome === 'PENDING').length;
  const setupRows = Object.entries(setupAccuracy).sort((left, right) => (right[1]?.reputationScore ?? 0) - (left[1]?.reputationScore ?? 0));
  const familyRows = Object.entries(setupFamilyPerformance).sort((left, right) => (right[1]?.reputationScore ?? 0) - (left[1]?.reputationScore ?? 0));
  const bySymbol = normalized.reduce((accumulator, item) => {
    const stats = calculateSignalAccuracy(normalized, item.symbol);
    const relevant = normalized.filter((row) => row.symbol === item.symbol);
    const avgConfidence = relevant.length
      ? round(relevant.reduce((sum, row) => sum + safeNumber(row.confidence), 0) / relevant.length)
      : 0;
    accumulator[item.symbol] = {
      ...stats,
      averageConfidence: avgConfidence,
    };
    return accumulator;
  }, {});

  return {
    totalSignals: normalized.length,
    completedSignals: evaluated.length,
    evaluatedSignals: evaluated.length,
    overallAccuracy: overall.accuracyPercent,
    success: overall.success,
    failure: overall.failure,
    partial: overall.partial,
    wins: overall.success,
    losses: overall.failure,
    pendingSignals,
    averageConfidence,
    averageMoveAchieved,
    averageDrawdown,
    bestSetupType: setupRows[0]?.[0] ?? 'N/A',
    worstSetupType: setupRows.at(-1)?.[0] ?? 'N/A',
    bestSetupFamily: familyRows[0]?.[0] ?? 'N/A',
    worstSetupFamily: familyRows.at(-1)?.[0] ?? 'N/A',
    setupAccuracy,
    setupFamilyPerformance,
    directionPerformance,
    qualityPerformance,
    confidenceBuckets,
    bySymbol,
  };
}
