function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  return Number((value ?? 0).toFixed(decimals));
}

function avg(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function absPercentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return Math.abs(((current - previous) / previous) * 100);
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function recentCloses(stock = {}) {
  return (stock?.candles ?? [])
    .slice(-10)
    .map((candle) => candle?.close)
    .filter((value) => Number.isFinite(value));
}

function averageMove(closes = []) {
  if (closes.length < 3) return 0.18;
  const moves = [];
  for (let index = 1; index < closes.length; index += 1) {
    moves.push(absPercentChange(closes[index], closes[index - 1]));
  }
  return avg(moves) || 0.18;
}

function averageRangePercent(candles = []) {
  const ranges = (candles ?? [])
    .slice(-8)
    .map((candle) => {
      const high = candle?.high;
      const low = candle?.low;
      const close = candle?.close;
      if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || close === 0) return null;
      return ((high - low) / close) * 100;
    })
    .filter((value) => Number.isFinite(value));

  return avg(ranges) || 0.4;
}

function classifySeverity(score) {
  if (score >= 82) return 'extreme';
  if (score >= 68) return 'strong';
  if (score >= 52) return 'moderate';
  return 'mild';
}

function hasClosedMarket(status = 'UNKNOWN') {
  return ['CLOSED', 'POSTMARKET', 'WEEKEND_CLOSED', 'HOLIDAY', 'PREOPEN'].includes(String(status).toUpperCase());
}

function deriveStructureContext({ currentPrice, support, resistance }) {
  const supportDistance = currentPrice > 0 && support > 0 ? ((currentPrice - support) / currentPrice) * 100 : null;
  const resistanceDistance = currentPrice > 0 && resistance > 0 ? ((resistance - currentPrice) / currentPrice) * 100 : null;
  const nearSupport = supportDistance != null && supportDistance >= 0 && supportDistance <= 0.8;
  const nearResistance = resistanceDistance != null && resistanceDistance >= 0 && resistanceDistance <= 0.8;
  return {
    supportDistance: supportDistance != null ? round(supportDistance) : null,
    resistanceDistance: resistanceDistance != null ? round(resistanceDistance) : null,
    nearSupport,
    nearResistance,
  };
}

function deriveConfirmation({ stock, currentMove, volumeRatio, histogramAcceleration, rsiJump }) {
  const confirmations = [];

  if (volumeRatio >= 1.25) confirmations.push('volume');
  if (Math.abs(histogramAcceleration) >= 0.08) confirmations.push('macd');
  if (Math.abs(rsiJump) >= 3.5) confirmations.push('rsi');
  if (Math.abs(currentMove) >= Math.max(0.55, (stock?.prediction?.indicators?.volatility ?? 1) * 0.18)) {
    confirmations.push('momentum');
  }

  const confirmationState =
    confirmations.length >= 3 ? 'strong' : confirmations.length >= 2 ? 'confirmed' : confirmations.length >= 1 ? 'watch' : 'weak';
  const confirmationReason =
    confirmationState === 'strong'
      ? 'Move is confirmed by volume and momentum expansion.'
      : confirmationState === 'confirmed'
        ? 'Move has at least two confirming factors.'
        : confirmationState === 'watch'
          ? 'Move needs more confirmation before acting.'
          : 'Confirmation is weak, so this is only a watch signal.';

  return {
    confirmationState,
    confirmationReason,
    confirmationScore: confirmations.length,
  };
}

function buildActionNote(spikeType, confirmationState, severity) {
  if (spikeType === 'breakout_spike') {
    return confirmationState === 'strong' ? 'Possible breakout setup' : 'Wait for confirmation';
  }
  if (spikeType === 'breakdown_spike') {
    return confirmationState === 'strong' ? 'Breakdown risk' : 'Watch closely';
  }
  if (spikeType === 'reversal_spike') {
    return 'Reversal risk after extreme spike';
  }
  if (spikeType === 'volatility_spike') {
    return 'Avoid chasing';
  }
  if (spikeType === 'spike_up') {
    return severity === 'strong' || severity === 'extreme' ? 'Avoid chasing' : 'Watch closely';
  }
  if (spikeType === 'spike_down') {
    return 'Wait for confirmation';
  }
  return 'Watch closely';
}

export function detectSpikeEvent(currentStock = {}, previousStock = null) {
  const marketStatus = currentStock?.live?.marketStatus ?? currentStock?.marketStatus ?? 'UNKNOWN';
  if (hasClosedMarket(marketStatus)) {
    return {
      spikeDetected: false,
      spikeType: null,
      spikeStrength: 0,
      spikeSeverity: null,
      spikeReason: 'Market is not in a live trading session.',
      confirmationState: 'weak',
      confirmationReason: 'Spike detection is disabled outside live trading.',
      actionNote: 'Next session monitoring only',
    };
  }

  const currentPrice = currentStock?.live?.ltp ?? currentStock?.currentPrice ?? 0;
  const previousPrice =
    previousStock?.live?.ltp ??
    previousStock?.currentPrice ??
    currentStock?.candles?.at(-2)?.close ??
    currentPrice;
  const candles = currentStock?.candles ?? [];
  const closes = recentCloses(currentStock);
  const movePercent = percentChange(currentPrice, previousPrice);
  const baselineMove = averageMove(closes);
  const adaptiveThreshold = Math.max(0.32, baselineMove * 1.9);
  const rangePercent = averageRangePercent(candles);
  const lastCandle = candles.at(-1) ?? {};
  const lastRangePercent =
    Number.isFinite(lastCandle?.high) && Number.isFinite(lastCandle?.low) && Number.isFinite(lastCandle?.close) && lastCandle.close !== 0
      ? ((lastCandle.high - lastCandle.low) / lastCandle.close) * 100
      : rangePercent;
  const rangeExpansion = rangePercent > 0 ? lastRangePercent / rangePercent : 1;
  const momentumValue = currentStock?.prediction?.indicators?.momentum ?? currentStock?.trend?.momentum ?? movePercent;
  const previousMomentum = previousStock?.prediction?.indicators?.momentum ?? previousStock?.trend?.momentum ?? 0;
  const momentumAcceleration = momentumValue - previousMomentum;
  const support = currentStock?.supportResistance?.support ?? currentPrice;
  const resistance = currentStock?.supportResistance?.resistance ?? currentPrice;
  const structure = deriveStructureContext({ currentPrice, support, resistance });
  const volume = currentStock?.live?.volume ?? currentStock?.volume ?? 0;
  const avgVolume = currentStock?.indicators?.averageVolume ?? previousStock?.indicators?.averageVolume ?? volume;
  const volumeRatio = avgVolume > 0 ? volume / avgVolume : 1;
  const rsi = currentStock?.indicators?.rsi14 ?? 50;
  const prevRsi = previousStock?.indicators?.rsi14 ?? rsi;
  const rsiJump = rsi - prevRsi;
  const histogram = currentStock?.indicators?.macdHistogram ?? 0;
  const prevHistogram = previousStock?.indicators?.macdHistogram ?? histogram;
  const histogramAcceleration = histogram - prevHistogram;

  const abnormalMove =
    Math.abs(movePercent) >= adaptiveThreshold &&
    (rangeExpansion >= 1.2 || Math.abs(momentumAcceleration) >= 0.18 || volumeRatio >= 1.2);

  if (!abnormalMove) {
    return {
      spikeDetected: false,
      spikeType: null,
      spikeStrength: 0,
      spikeSeverity: null,
      spikeReason: 'Current move is within the recent baseline.',
      confirmationState: 'weak',
      confirmationReason: 'No abnormal expansion versus the recent baseline.',
      actionNote: 'Monitor',
    };
  }

  const confirmation = deriveConfirmation({
    stock: currentStock,
    currentMove: movePercent,
    volumeRatio,
    histogramAcceleration,
    rsiJump,
  });

  let spikeType = movePercent > 0 ? 'spike_up' : 'spike_down';
  if (movePercent > 0 && currentPrice > resistance * 1.001 && confirmation.confirmationScore >= 2) {
    spikeType = 'breakout_spike';
  } else if (movePercent < 0 && currentPrice < support * 0.999 && confirmation.confirmationScore >= 2) {
    spikeType = 'breakdown_spike';
  } else if (rangeExpansion >= 1.8 && confirmation.confirmationScore <= 1) {
    spikeType = 'volatility_spike';
  } else if (
    ((movePercent > 0 && structure.nearResistance) || (movePercent < 0 && structure.nearSupport)) &&
    Math.abs(momentumAcceleration) >= 0.25 &&
    Math.abs(rsiJump) >= 4
  ) {
    spikeType = 'reversal_spike';
  } else if (volumeRatio >= 1.5 && Math.abs(movePercent) >= adaptiveThreshold * 1.05) {
    spikeType = 'volume_spike';
  }

  const structureScore =
    spikeType === 'breakout_spike' || spikeType === 'breakdown_spike'
      ? 20
      : spikeType === 'reversal_spike'
        ? 16
        : spikeType === 'volatility_spike'
          ? 8
          : 12;
  const spikeStrength = clamp(
    round(
      Math.abs(movePercent) * 30 +
        rangeExpansion * 12 +
        Math.abs(momentumAcceleration) * 18 +
        confirmation.confirmationScore * 10 +
        structureScore,
    ),
    0,
    100,
  );
  const spikeSeverity = classifySeverity(spikeStrength);
  const spikeReason =
    spikeType === 'breakout_spike'
      ? 'Price is pushing through resistance with abnormal expansion.'
      : spikeType === 'breakdown_spike'
        ? 'Price is slipping through support with abnormal expansion.'
        : spikeType === 'reversal_spike'
          ? 'The move is extreme near a key level and reversal risk is rising.'
          : spikeType === 'volatility_spike'
            ? 'Range expansion is high, but structure is still noisy.'
            : spikeType === 'volume_spike'
              ? 'Move is backed by unusually strong volume.'
              : movePercent > 0
                ? 'Price is accelerating upward beyond the recent baseline.'
                : 'Price is accelerating downward beyond the recent baseline.';

  return {
    spikeDetected: true,
    spikeType,
    spikeStrength,
    spikeSeverity,
    spikeReason,
    confirmationState: confirmation.confirmationState,
    confirmationReason: confirmation.confirmationReason,
    actionNote: buildActionNote(spikeType, confirmation.confirmationState, spikeSeverity),
    movePercent: round(movePercent),
    baselineMove: round(baselineMove),
    adaptiveThreshold: round(adaptiveThreshold),
    rangeExpansion: round(rangeExpansion),
    volumeRatio: round(volumeRatio),
    priceAtTrigger: round(currentPrice),
    marketStatus,
    support,
    resistance,
  };
}

export function detectIndexSpike(item = {}) {
  const marketStatus = item?.marketStatus ?? 'UNKNOWN';
  if (hasClosedMarket(marketStatus)) {
    return { spikeDetected: false, spikeType: null, spikeSeverity: null, spikeStrength: 0 };
  }

  const change = Number(item?.change ?? 0);
  const absoluteChange = Math.abs(change);
  if (absoluteChange < 0.55) {
    return { spikeDetected: false, spikeType: null, spikeSeverity: null, spikeStrength: 0 };
  }

  const spikeType = change > 0 ? 'spike_up' : 'spike_down';
  const spikeStrength = clamp(round(absoluteChange * 32), 0, 100);
  return {
    spikeDetected: true,
    spikeType,
    spikeSeverity: classifySeverity(spikeStrength),
    spikeStrength,
    spikeReason: change > 0 ? 'Index is moving sharply higher.' : 'Index is moving sharply lower.',
  };
}

export function recordSpikeHistory(existingHistory = [], alerts = [], limit = 250) {
  const next = [...(existingHistory ?? [])];
  (alerts ?? [])
    .filter((alert) => alert?.type === 'SPIKE')
    .forEach((alert) => {
      const duplicate = next.find(
        (item) =>
          item.symbol === alert.symbol &&
          item.spikeType === alert.spikeType &&
          item.timestamp === alert.timestamp,
      );
      if (!duplicate) {
        next.unshift({
          id: alert.id,
          symbol: alert.symbol,
          timestamp: alert.timestamp,
          spikeType: alert.spikeType,
          severity: alert.severity,
          confirmation: alert.confirmationState,
          actionNote: alert.actionNote,
          reason: alert.reason ?? alert.message,
          priceAtTrigger: alert.priceAtTrigger ?? null,
          marketStatus: alert.marketStatus ?? 'UNKNOWN',
          laterOutcome: null,
        });
      }
    });

  return next.slice(0, limit);
}
