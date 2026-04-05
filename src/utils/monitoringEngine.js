import { detectIndexSpike, detectSpikeEvent } from '@/utils/spikeDetectionEngine';

function round(value, decimals = 2) {
  return Number((value ?? 0).toFixed(decimals));
}

function classifyPulse({ changePercent = 0, confidence = 0, volatility = 0, stale = false }) {
  if (stale) return 'weak';
  if (Math.abs(changePercent) >= 1 || confidence >= 68 || volatility >= 4.5) return 'active';
  if (Math.abs(changePercent) >= 0.35 || confidence >= 52) return 'stable';
  return 'weak';
}

function classifyMonitoringTag({ stock, prediction, spike, pulse, volatility = 0 }) {
  const finalDecision = stock?.decision?.finalDecision ?? prediction?.decision?.finalDecision ?? 'WAIT';
  const confidence = prediction?.confidence ?? stock?.signal?.confidence ?? 0;

  if (finalDecision === 'AVOID' || stock?.decision?.risk?.riskLevel === 'HIGH') return 'AVOID';
  if (spike?.spikeDetected && (spike?.spikeStrength ?? 0) >= 70 && confidence >= 60) return 'HOT';
  if (pulse === 'active' && confidence >= 55) return 'HOT';
  if (pulse === 'stable' || confidence >= 50 || (spike?.spikeDetected && volatility >= 1)) return 'WATCH';
  return 'QUIET';
}

function buildAttentionContext({ stock, spike, volatility = 0 }) {
  if (spike?.spikeType === 'breakout_spike' && ['strong', 'confirmed'].includes(spike?.confirmationState)) {
    return {
      attentionFlag: 'HIGHLIGHT',
      attentionReason: 'Sudden move is pushing through resistance with confirmation.',
    };
  }
  if (spike?.spikeType === 'breakdown_spike' && ['strong', 'confirmed'].includes(spike?.confirmationState)) {
    return {
      attentionFlag: 'HIGHLIGHT',
      attentionReason: 'Sudden weakness is breaking below support with confirmation.',
    };
  }
  if (spike?.spikeDetected && spike?.confirmationState === 'watch') {
    return {
      attentionFlag: 'CAUTION',
      attentionReason: 'The move is notable, but it still needs confirmation before acting.',
    };
  }
  if (spike?.spikeType === 'reversal_spike' || stock?.decision?.stability?.flipWarning) {
    return {
      attentionFlag: 'WARNING',
      attentionReason: 'Setup looks unstable and reversal risk is elevated.',
    };
  }
  if (volatility >= 4.5) {
    return {
      attentionFlag: 'RISK',
      attentionReason: 'Volatility is elevated, so risk control matters more than speed.',
    };
  }
  return {
    attentionFlag: 'NORMAL',
    attentionReason: 'No urgent monitoring flag right now.',
  };
}

export function buildMonitoringSnapshot({
  stocks = [],
  previousStocks = [],
  oneHourPredictions = [],
  watchlist = [],
  marketOverview = [],
  lastUpdated = null,
} = {}) {
  const previousMap = (previousStocks ?? []).reduce((accumulator, item) => {
    accumulator[item.symbol] = item;
    return accumulator;
  }, {});
  const predictionMap = (oneHourPredictions ?? []).reduce((accumulator, item) => {
    accumulator[item.symbol] = item;
    return accumulator;
  }, {});

  const items = (stocks ?? []).map((stock) => {
    const prediction = predictionMap[stock.symbol];
    const spike = detectSpikeEvent(stock, previousMap[stock.symbol]);
    const changePercent = stock.live?.changePercent ?? stock.dayChangePercent ?? 0;
    const volatility = stock.prediction?.indicators?.volatility ?? stock.indicators?.atr14 ?? 0;
    const pulse = classifyPulse({
      changePercent,
      confidence: prediction?.confidence ?? stock.signal?.confidence ?? 0,
      volatility,
      stale: Boolean(stock.live?.stale),
    });

    return {
      symbol: stock.symbol,
      companyName: stock.companyName,
      pulse,
      changePercent,
      confidence: prediction?.confidence ?? stock.signal?.confidence ?? 0,
      direction: prediction?.direction ?? stock.shortTermPredictions?.oneHour?.direction ?? 'SIDEWAYS',
      actionBias:
        prediction?.entryZonePlan?.actionSummary ??
        stock.prediction?.actionBias ??
        stock.tradeGuidance?.actionSummary ??
        'Monitor',
      spike,
      monitoringTag: classifyMonitoringTag({ stock, prediction, spike, pulse, volatility }),
      ...buildAttentionContext({ stock, spike, volatility }),
      lastUpdated: stock.live?.lastUpdated ?? lastUpdated,
      stale: Boolean(stock.live?.stale),
      marketStatus: stock.live?.marketStatus ?? 'UNKNOWN',
    };
  });

  const watchlistPulse = items.filter((item) => watchlist.includes(item.symbol));
  const movers = [...items]
    .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
    .slice(0, 6);
  const unusuallyActiveNames = items.filter((item) => item.pulse === 'active').slice(0, 8);
  const stableNames = items.filter((item) => item.pulse === 'stable').slice(0, 8);
  const weakNames = items.filter((item) => item.pulse === 'weak').slice(0, 8);
  const spikeEvents = items.filter((item) => item.spike?.spikeDetected).sort((left, right) => (right.spike?.spikeStrength ?? 0) - (left.spike?.spikeStrength ?? 0));
  const hotNames = items.filter((item) => item.monitoringTag === 'HOT').slice(0, 8);
  const avoidNames = items.filter((item) => item.monitoringTag === 'AVOID').slice(0, 8);
  const indicesPulse = (marketOverview ?? []).map((item) => ({
    label: item.label,
    change: item.change,
    marketStatus: item.marketStatus,
    stale: item.stale,
    lastUpdated: item.lastUpdated,
    spike: detectIndexSpike(item),
  }));
  const averageVolatility = items.length
    ? items.reduce((sum, item) => sum + Math.abs(item.changePercent ?? 0), 0) / items.length
    : 0;
  const staleShare = items.length ? items.filter((item) => item.stale).length / items.length : 0;
  const marketBias =
    movers.filter((item) => item.changePercent > 0).length >= movers.filter((item) => item.changePercent < 0).length
      ? 'bullish'
      : 'bearish';
  const volatilityState =
    averageVolatility >= 1.1 ? 'high' : averageVolatility <= 0.35 ? 'low' : 'normal';
  const sessionQuality =
    staleShare >= 0.4
      ? 'uncertain'
      : volatilityState === 'high'
        ? 'choppy'
        : 'clean';

  return {
    watchlistPulse,
    movers,
    unusuallyActiveNames,
    stableNames,
    weakNames,
    hotNames,
    avoidNames,
    spikeEvents,
    indicesPulse,
    marketTone: marketBias === 'bullish' ? 'Constructive' : 'Defensive',
    marketContext: {
      marketBias,
      volatilityState,
      sessionQuality,
    },
    lastUpdated,
  };
}
