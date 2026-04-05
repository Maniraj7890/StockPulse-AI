import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';

const WEAK_LIMIT = 5;
const DEFAULT_ACTIVE_TIER = 'STRONG';

function safeStock(s) {
  return {
    ...s,
    symbol: s?.symbol || 'UNKNOWN',
    companyName: s?.companyName || 'Unknown company',
    direction: s?.direction || 'NONE',
    setupType: s?.setupType || 'No Trade',
    setupAge: s?.setupAge || 'Unknown',
    opportunityScore: typeof s?.opportunityScore === 'number' ? s.opportunityScore : 0,
    modelHitRate: typeof s?.modelHitRate === 'number' ? s.modelHitRate : 0,
    setupCleanliness: typeof s?.setupCleanliness === 'number' ? s.setupCleanliness : 0,
    learningAdjustment: typeof s?.learningAdjustment === 'number' ? s.learningAdjustment : 0,
    learningReason: s?.learningReason || 'Limited history, so confidence stays close to the base engine.',
    learningBadge: s?.learningBadge || 'Neutral history',
    confidence: typeof s?.confidence === 'number' ? s.confidence : 0,
    trend: s?.trend || 'sideways',
    riskLevel: s?.riskLevel || 'medium',
    support: typeof s?.support === 'number' ? s.support : 0,
    resistance: typeof s?.resistance === 'number' ? s.resistance : 0,
    invalidation: typeof s?.invalidation === 'number' ? s.invalidation : 0,
    expectedMoveMin: typeof s?.expectedMoveMin === 'number' ? s.expectedMoveMin : 0,
    expectedMoveMax: typeof s?.expectedMoveMax === 'number' ? s.expectedMoveMax : 0,
    currentPrice: typeof s?.currentPrice === 'number' ? s.currentPrice : 0,
    expectedMoveText: s?.expectedMoveText || 'No clear directional edge',
    basisLabel: s?.horizonForecast?.basisLabel || s?.basisLabel || 'Estimate',
    reasons: Array.isArray(s?.reasons) ? s.reasons : [],
    live: s?.live ?? null,
    marketStatus: s?.marketStatus || 'UNKNOWN',
    lastUpdated: s?.lastUpdated ?? null,
    rankingScore: typeof s?.rankingScore === 'number' ? s.rankingScore : 0,
    horizonForecast: s?.horizonForecast ?? null,
    decision: s?.decision ?? null,
  };
}

function isRenderableRow(row) {
  if (!row) return false;
  if (!row.symbol || row.symbol === 'UNKNOWN') return false;
  if (!Number.isFinite(row.confidence)) return false;
  return true;
}

function getTier(item) {
  if (
    item.direction !== 'NONE' &&
    item.confidence >= 72 &&
    item.opportunityScore >= 7 &&
    item.setupCleanliness >= 66 &&
    item.setupAge !== 'Aging'
  ) {
    return 'STRONG';
  }

  if (
    item.direction !== 'NONE' &&
    item.confidence >= 60 &&
    item.opportunityScore >= 5.4 &&
    item.setupCleanliness >= 52
  ) {
    return 'MODERATE';
  }

  if (
    item.direction !== 'NONE' &&
    item.confidence >= 52 &&
    item.opportunityScore >= 4.2 &&
    item.setupCleanliness >= 44
  ) {
    return 'WEAK';
  }

  return 'NO_EDGE';
}

function rankCandidates(left, right) {
  const leftRealism = Math.abs(left.expectedMoveMax ?? 0) - Math.abs(left.expectedMoveMin ?? 0);
  const rightRealism = Math.abs(right.expectedMoveMax ?? 0) - Math.abs(right.expectedMoveMin ?? 0);

  return (
    right.rankingScore - left.rankingScore ||
    right.confidence - left.confidence ||
    right.setupCleanliness - left.setupCleanliness ||
    right.opportunityScore - left.opportunityScore ||
    leftRealism - rightRealism
  );
}

function pushRanked(target, item, limit) {
  target.push(item);
  target.sort(rankCandidates);

  if (target.length > limit) {
    target.length = limit;
  }
}

export function useHourPrediction(options = {}) {
  const { includeDetails = false, activeTier = DEFAULT_ACTIVE_TIER, includeNoClearEdge = false } = options;
  const predictions = useMarketStore((state) => state.oneHourPredictions ?? []);
  const marketStatus = useMarketStore((state) => state.data?.NIFTY?.latest?.marketStatus ?? 'UNKNOWN');
  const lastUpdated = useMarketStore((state) => state.lastUpdated);
  const hitRate = useMarketStore((state) => state.backtestStats?.accuracy ?? null);
  const learningProfile = useMarketStore((state) => state.learningProfile);

  return useMemo(() => {
    const normalizedPredictions = [];
    const tierCounts = {
      increase: { STRONG: 0, MODERATE: 0, WEAK: 0 },
      decrease: { STRONG: 0, MODERATE: 0, WEAK: 0 },
    };
    const detailedRows = {
      increase: [],
      decrease: [],
      noClearEdge: [],
    };

    let total = 0;
    let confidenceSum = 0;
    let hitRateSum = 0;

    for (const prediction of predictions ?? []) {
      const safePrediction = safeStock(prediction);
      if (!isRenderableRow(safePrediction)) {
        continue;
      }

      const tier = getTier(safePrediction);
      const item = { ...safePrediction, tier };
      normalizedPredictions.push(item);
      total += 1;
      confidenceSum += item.confidence ?? 0;
      hitRateSum += item.modelHitRate ?? 0;

      if (item.direction === 'UP' && tier !== 'NO_EDGE') {
        tierCounts.increase[tier] += 1;
        if (includeDetails && tier === activeTier) {
          pushRanked(detailedRows.increase, item, activeTier === 'WEAK' ? WEAK_LIMIT : 5);
        }
        continue;
      }

      if (item.direction === 'DOWN' && tier !== 'NO_EDGE') {
        tierCounts.decrease[tier] += 1;
        if (includeDetails && tier === activeTier) {
          pushRanked(detailedRows.decrease, item, activeTier === 'WEAK' ? WEAK_LIMIT : 5);
        }
        continue;
      }

      if (includeDetails && includeNoClearEdge && (item.direction === 'NONE' || tier === 'NO_EDGE')) {
        detailedRows.noClearEdge.push(item);
      }
    }

    if (includeDetails && includeNoClearEdge) {
      detailedRows.noClearEdge.sort(
        (left, right) => right.confidence - left.confidence || right.opportunityScore - left.opportunityScore,
      );
      detailedRows.noClearEdge = detailedRows.noClearEdge.slice(0, 8);
    }

    const averageConfidence = total ? Math.round(confidenceSum / total) : 0;
    const averageHitRate = total ? Math.round(hitRateSum / total) : 0;
    const noClearEdgeCount =
      total -
      Object.values(tierCounts.increase).reduce((sum, value) => sum + value, 0) -
      Object.values(tierCounts.decrease).reduce((sum, value) => sum + value, 0);

    const visibleTier =
      tierCounts.increase.STRONG || tierCounts.decrease.STRONG
        ? 'STRONG'
        : tierCounts.increase.MODERATE || tierCounts.decrease.MODERATE
          ? 'MODERATE'
          : 'WEAK';

    const notes = [
      marketStatus === 'CLOSED'
        ? 'Based on last session data because the market is closed.'
        : 'Signals use the latest store-backed market snapshot and refresh with the main prediction cycle.',
      'Mixed indicators are moved to No Clear Edge instead of forcing UP or DOWN.',
      'Overextended bullish setups and deeply oversold bearish setups are filtered down for accuracy.',
    ];

    const setupRows = Object.entries(learningProfile?.setupFamilyAccuracy ?? learningProfile?.setupAccuracy ?? {})
      .filter(([, value]) => (value?.total ?? 0) > 0)
      .sort(
        (left, right) =>
          (right[1]?.reputationScore ?? right[1]?.accuracy ?? 0) -
          (left[1]?.reputationScore ?? left[1]?.accuracy ?? 0),
      );

    return {
      increase: includeDetails ? detailedRows.increase : [],
      decrease: includeDetails ? detailedRows.decrease : [],
      noClearEdge: includeDetails && includeNoClearEdge ? detailedRows.noClearEdge : [],
      marketStatus,
      lastUpdated,
      total,
      averageConfidence,
      averageHitRate,
      hitRate,
      learningProfile,
      learningSummary: {
        overallAccuracy: learningProfile?.overallAccuracy ?? 0,
        bestSetupType: setupRows[0]?.[0] ?? 'N/A',
        weakestSetupType: setupRows.at(-1)?.[0] ?? 'N/A',
      },
      notes,
      tierCounts,
      noClearEdgeCount,
      visibleTier,
      hasAnyRows: total > 0,
      normalizedPredictions: includeDetails ? normalizedPredictions : [],
    };
  }, [activeTier, hitRate, includeDetails, includeNoClearEdge, lastUpdated, learningProfile, marketStatus, predictions]);
}
