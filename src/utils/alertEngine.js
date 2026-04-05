import { detectSpikeEvent } from '@/utils/spikeDetectionEngine';

const MAX_ALERTS = 20;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

function round(value) {
  return Number((value ?? 0).toFixed(2));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toTimestamp(value) {
  const timestamp = new Date(value ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toMap(stocks) {
  return (stocks ?? []).reduce((accumulator, stock) => {
    accumulator[stock.symbol] = stock;
    return accumulator;
  }, {});
}

function classifyPredictionDirection(stock) {
  return stock?.shortTermPredictions?.oneHour?.direction ?? 'SIDEWAYS';
}

function classifyOneHourBucket(item) {
  if (!item) return 'NONE';
  if (item.direction === 'UP' && (item.confidence ?? 0) >= 62 && (item.opportunityScore ?? 0) >= 6 && item.setupAge !== 'Aging') {
    return 'INCREASE';
  }
  if (item.direction === 'DOWN' && (item.confidence ?? 0) >= 62 && (item.opportunityScore ?? 0) >= 6 && item.setupAge !== 'Aging') {
    return 'DECREASE';
  }
  return 'NO_EDGE';
}

function crossedLevel(previousPrice, currentPrice, level, direction) {
  if (level == null || previousPrice == null || currentPrice == null) return false;
  if (direction === 'below') return previousPrice > level && currentPrice <= level;
  return previousPrice < level && currentPrice >= level;
}

function classifyAlertPriority(score = 0) {
  if (score >= 75) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

function confidenceScore(stock = {}) {
  return clamp(stock?.shortTermPredictions?.oneHour?.confidence ?? stock?.signal?.confidence ?? stock?.prediction?.confidence ?? 0, 0, 100);
}

function momentumScore(stock = {}) {
  const value =
    Math.abs(
      stock?.prediction?.indicators?.momentum ??
      stock?.trend?.momentum ??
      stock?.live?.changePercent ??
      stock?.dayChangePercent ??
      0,
    );
  return clamp(round(value * 22), 0, 100);
}

function structureScore(stock = {}, spike = null) {
  const price = stock?.live?.ltp ?? stock?.currentPrice ?? 0;
  const support = stock?.supportResistance?.support ?? price;
  const resistance = stock?.supportResistance?.resistance ?? price;
  const supportDistance = price > 0 ? ((price - support) / price) * 100 : null;
  const resistanceDistance = price > 0 ? ((resistance - price) / price) * 100 : null;

  if (spike?.spikeType === 'breakout_spike' || spike?.spikeType === 'breakdown_spike') return 92;
  if (spike?.spikeType === 'reversal_spike') return 72;
  if (supportDistance != null && supportDistance <= 0.8) return 64;
  if (resistanceDistance != null && resistanceDistance <= 0.8) return 64;
  return 36;
}

function volatilityScore(stock = {}, spike = null) {
  const volatility =
    stock?.prediction?.indicators?.volatility ??
    (stock?.indicators?.atr14 && stock?.live?.ltp
      ? (stock.indicators.atr14 / Math.max(stock.live.ltp, 1)) * 100
      : 0);

  if (spike?.spikeType === 'volatility_spike') return 88;
  if (volatility >= 4.5) return 78;
  if (volatility >= 2) return 58;
  if (volatility >= 0.8) return 42;
  return 24;
}

function confluenceScore(stock = {}, spike = null) {
  const baseConfidence = confidenceScore(stock);
  const signalStrength = Math.abs(stock?.prediction?.finalSignalScore ?? 0);
  const setupQuality = stock?.zoneQuality ?? stock?.entryZonePlan?.zoneQualityScore ?? stock?.opportunityScore ?? 0;
  const spikeBoost = spike?.confirmationState === 'strong' ? 10 : spike?.confirmationState === 'confirmed' ? 5 : 0;
  return clamp(round(baseConfidence * 0.55 + signalStrength * 0.2 + setupQuality * 0.25 + spikeBoost), 0, 100);
}

function buildAlertIntelligence(stock = {}, spike = null, type = 'GENERIC') {
  const spikeComponent = clamp(spike?.spikeStrength ?? 0, 0, 100);
  const momentumComponent = momentumScore(stock);
  const structureComponent = structureScore(stock, spike);
  const volatilityComponent = volatilityScore(stock, spike);
  const confluenceComponent = confluenceScore(stock, spike);

  const score = clamp(
    round(
      spikeComponent * 0.35 +
      momentumComponent * 0.2 +
      structureComponent * 0.2 +
      volatilityComponent * 0.1 +
      confluenceComponent * 0.15,
    ),
    0,
    100,
  );

  let reason = 'The setup is worth monitoring, but confirmation still matters.';
  if (spike?.spikeType === 'breakout_spike' && ['strong', 'confirmed'].includes(spike?.confirmationState)) {
    reason = 'Breakout strength is confirmed by structure and momentum.';
  } else if (spike?.spikeType === 'breakdown_spike' && ['strong', 'confirmed'].includes(spike?.confirmationState)) {
    reason = 'Breakdown pressure is confirmed near a key structure level.';
  } else if (spike?.spikeType === 'volatility_spike') {
    reason = 'Volatility has expanded sharply, so risk is elevated.';
  } else if (spike?.spikeDetected && spike?.confirmationState === 'watch') {
    reason = 'The move is noticeable, but it still needs confirmation.';
  } else if (type === 'PREDICTION' || type === 'ONE_HOUR_SIGNAL') {
    reason = 'Signal direction changed with enough confluence to merit attention.';
  } else if (type === 'STOP_LOSS') {
    reason = 'Price moved through the invalidation zone, which raises downside risk.';
  } else if (type === 'TARGET') {
    reason = 'Price reached the planned objective, so profit management matters.';
  }

  return {
    alertScore: score,
    alertPriority: classifyAlertPriority(score),
    alertReason: reason,
    scoreBreakdown: {
      spikeScore: round(spikeComponent),
      momentumScore: round(momentumComponent),
      structureScore: round(structureComponent),
      volatilityScore: round(volatilityComponent),
      confluenceScore: round(confluenceComponent),
    },
  };
}

function buildSymbolState(stock = {}, spike = null) {
  return {
    direction: stock?.shortTermPredictions?.oneHour?.direction ?? stock?.prediction?.direction ?? 'SIDEWAYS',
    confidence: confidenceScore(stock),
    actionBias: stock?.decision?.finalDecision ?? stock?.prediction?.actionBias ?? 'WAIT',
    marketStatus: stock?.live?.marketStatus ?? 'UNKNOWN',
    spikeType: spike?.spikeType ?? null,
    spikeSeverity: spike?.spikeSeverity ?? null,
  };
}

function createAlert({ type, symbol, message, timestamp, meta = {}, dedupeKey = null, cooldownMs = DEFAULT_COOLDOWN_MS }) {
  return {
    id: `${type}-${symbol}-${timestamp}-${message.replace(/[^a-z0-9]+/gi, '-').slice(0, 24)}`,
    type,
    message,
    symbol,
    timestamp,
    dedupeKey: dedupeKey ?? `${type}:${symbol}`,
    cooldownMs,
    ...meta,
  };
}

function buildSignalAlert(previousStock, currentStock, timestamp) {
  const previousSignal = previousStock?.tradeGuidance?.prediction?.signal ?? previousStock?.signal?.signal ?? 'HOLD';
  const currentSignal = currentStock?.tradeGuidance?.prediction?.signal ?? currentStock?.signal?.signal ?? 'HOLD';
  if (previousSignal === currentSignal) return null;

  const intelligence = buildAlertIntelligence(currentStock, null, 'SIGNAL');
  return createAlert({
    type: 'SIGNAL',
    symbol: currentStock.symbol,
    timestamp,
    message: `${currentStock.symbol} signal changed from ${previousSignal} to ${currentSignal}.`,
    dedupeKey: `SIGNAL:${currentStock.symbol}:${currentSignal}`,
    meta: {
      signal: currentSignal,
      previousSignal,
      ...intelligence,
      triggerContext: intelligence.alertReason,
      symbolState: buildSymbolState(currentStock),
    },
  });
}

function buildPriceAlerts(previousStock, currentStock, priceLevels, timestamp) {
  const previousPrice = previousStock?.live?.ltp ?? previousStock?.currentPrice ?? null;
  const currentPrice = currentStock?.live?.ltp ?? currentStock?.currentPrice ?? null;
  const intelligence = buildAlertIntelligence(currentStock, null, 'PRICE');

  return (priceLevels ?? [])
    .filter((level) => crossedLevel(previousPrice, currentPrice, level.price, level.direction))
    .map((level) =>
      createAlert({
        type: 'PRICE',
        symbol: currentStock.symbol,
        timestamp,
        message: `${currentStock.symbol} crossed ${level.direction === 'below' ? 'below' : 'above'} ${round(level.price)}.`,
        dedupeKey: `PRICE:${currentStock.symbol}:${level.direction}:${round(level.price)}`,
        meta: {
          level: round(level.price),
          direction: level.direction ?? 'above',
          ...intelligence,
          triggerContext: intelligence.alertReason,
          symbolState: buildSymbolState(currentStock),
        },
      }),
    );
}

function buildStopLossAlert(previousStock, currentStock, timestamp) {
  const previousPrice = previousStock?.live?.ltp ?? previousStock?.currentPrice ?? null;
  const currentPrice = currentStock?.live?.ltp ?? currentStock?.currentPrice ?? null;
  const stopLoss = currentStock?.stopLoss ?? currentStock?.signal?.tradePlan?.stopLoss ?? null;
  if (!crossedLevel(previousPrice, currentPrice, stopLoss, 'below')) return null;

  const intelligence = buildAlertIntelligence(currentStock, null, 'STOP_LOSS');
  return createAlert({
    type: 'STOP_LOSS',
    symbol: currentStock.symbol,
    timestamp,
    message: `${currentStock.symbol} moved below the stop-loss level near ${round(stopLoss)}.`,
    dedupeKey: `STOP_LOSS:${currentStock.symbol}:${round(stopLoss)}`,
    meta: {
      level: round(stopLoss),
      ...intelligence,
      triggerContext: intelligence.alertReason,
      symbolState: buildSymbolState(currentStock),
    },
  });
}

function buildTargetAlert(previousStock, currentStock, timestamp) {
  const previousPrice = previousStock?.live?.ltp ?? previousStock?.currentPrice ?? null;
  const currentPrice = currentStock?.live?.ltp ?? currentStock?.currentPrice ?? null;
  const target = currentStock?.target ?? currentStock?.signal?.tradePlan?.target1 ?? null;
  if (!crossedLevel(previousPrice, currentPrice, target, 'above')) return null;

  const intelligence = buildAlertIntelligence(currentStock, null, 'TARGET');
  return createAlert({
    type: 'TARGET',
    symbol: currentStock.symbol,
    timestamp,
    message: `${currentStock.symbol} reached the target zone near ${round(target)}.`,
    dedupeKey: `TARGET:${currentStock.symbol}:${round(target)}`,
    meta: {
      level: round(target),
      ...intelligence,
      triggerContext: intelligence.alertReason,
      symbolState: buildSymbolState(currentStock),
    },
  });
}

function buildMoveAlert(previousStock, currentStock, timestamp) {
  const previousPrice = previousStock?.live?.ltp ?? previousStock?.currentPrice ?? null;
  const currentPrice = currentStock?.live?.ltp ?? currentStock?.currentPrice ?? null;
  if (previousPrice == null || currentPrice == null || previousPrice === 0) return null;

  const movePercent = round(((currentPrice - previousPrice) / previousPrice) * 100);
  if (Math.abs(movePercent) < 0.9) return null;

  const intelligence = buildAlertIntelligence(currentStock, null, 'PRICE');
  return createAlert({
    type: 'PRICE',
    symbol: currentStock.symbol,
    timestamp,
    message:
      movePercent > 0
        ? `${currentStock.symbol} is spiking quickly with a ${movePercent}% move.`
        : `${currentStock.symbol} is dropping quickly with a ${Math.abs(movePercent)}% move.`,
    dedupeKey: `PRICE_MOVE:${currentStock.symbol}:${movePercent > 0 ? 'UP' : 'DOWN'}`,
    meta: {
      movePercent,
      ...intelligence,
      triggerContext: intelligence.alertReason,
      symbolState: buildSymbolState(currentStock),
    },
  });
}

function buildPredictionAlert(previousStock, currentStock, timestamp) {
  const previousDirection = classifyPredictionDirection(previousStock);
  const currentDirection = classifyPredictionDirection(currentStock);
  if (previousDirection === currentDirection) return null;

  const intelligence = buildAlertIntelligence(currentStock, null, 'PREDICTION');
  const message =
    currentDirection === 'UP'
      ? `${currentStock.symbol} prediction changed to bullish for the next 1 hour.`
      : currentDirection === 'DOWN'
        ? `${currentStock.symbol} prediction changed to bearish for the next 1 hour.`
        : `${currentStock.symbol} moved back to a sideways / no-edge 1-hour view.`;

  return createAlert({
    type: 'PREDICTION',
    symbol: currentStock.symbol,
    timestamp,
    message,
    dedupeKey: `PREDICTION:${currentStock.symbol}:${currentDirection}`,
    meta: {
      direction: currentDirection,
      confidence: currentStock?.shortTermPredictions?.oneHour?.confidence ?? 0,
      ...intelligence,
      triggerContext: intelligence.alertReason,
      symbolState: buildSymbolState(currentStock),
    },
  });
}

function buildSpikeAlert(previousStock, currentStock, timestamp) {
  const spike = detectSpikeEvent(currentStock, previousStock);
  if (!spike?.spikeDetected) return null;

  const previousSpike = previousStock ? detectSpikeEvent(previousStock, null) : null;
  const materiallyChanged =
    !previousSpike?.spikeDetected ||
    previousSpike.spikeType !== spike.spikeType ||
    (spike.spikeStrength ?? 0) - (previousSpike?.spikeStrength ?? 0) >= 8;
  if (!materiallyChanged) return null;

  const intelligence = buildAlertIntelligence(currentStock, spike, 'SPIKE');
  return createAlert({
    type: 'SPIKE',
    symbol: currentStock.symbol,
    timestamp,
    message: `${currentStock.symbol} ${String(spike.spikeType).replace(/_/g, ' ')} (${spike.spikeSeverity}).`,
    dedupeKey: `SPIKE:${currentStock.symbol}:${spike.spikeType}:${spike.spikeSeverity}`,
    cooldownMs: 7 * 60 * 1000,
    meta: {
      spikeType: spike.spikeType,
      severity: spike.spikeSeverity,
      severityScore: spike.spikeStrength,
      reason: spike.spikeReason,
      confirmationState: spike.confirmationState,
      confirmationReason: spike.confirmationReason,
      actionNote: spike.actionNote,
      priceAtTrigger: spike.priceAtTrigger,
      marketStatus: spike.marketStatus,
      context: `${spike.spikeReason} ${spike.confirmationReason}`,
      ...intelligence,
      triggerContext: intelligence.alertReason,
      symbolState: buildSymbolState(currentStock, spike),
    },
  });
}

export function generateAlerts({ previousStocks, currentStocks, priceAlerts = {}, timestamp = new Date().toISOString() }) {
  const previousMap = toMap(previousStocks);
  const currentMap = toMap(currentStocks);
  const alerts = [];

  Object.values(currentMap).forEach((currentStock) => {
    const previousStock = previousMap[currentStock.symbol];
    if (!previousStock) return;

    const signalAlert = buildSignalAlert(previousStock, currentStock, timestamp);
    const stopLossAlert = buildStopLossAlert(previousStock, currentStock, timestamp);
    const targetAlert = buildTargetAlert(previousStock, currentStock, timestamp);
    const moveAlert = buildMoveAlert(previousStock, currentStock, timestamp);
    const predictionAlert = buildPredictionAlert(previousStock, currentStock, timestamp);
    const spikeAlert = buildSpikeAlert(previousStock, currentStock, timestamp);
    const thresholdAlerts = buildPriceAlerts(previousStock, currentStock, priceAlerts[currentStock.symbol], timestamp);

    [signalAlert, stopLossAlert, targetAlert, moveAlert, predictionAlert, spikeAlert, ...thresholdAlerts]
      .filter(Boolean)
      .forEach((alert) => alerts.push(alert));
  });

  return alerts;
}

export function generateOneHourAlerts({
  previousPredictions = [],
  currentPredictions = [],
  timestamp = new Date().toISOString(),
}) {
  const previousMap = toMap(previousPredictions);
  const currentMap = toMap(currentPredictions);
  const alerts = [];

  Object.values(currentMap).forEach((currentItem) => {
    const previousItem = previousMap[currentItem.symbol];
    if (!previousItem) return;

    const previousBucket = classifyOneHourBucket(previousItem);
    const currentBucket = classifyOneHourBucket(currentItem);
    const previousConfidence = previousItem.confidence ?? 0;
    const currentConfidence = currentItem.confidence ?? 0;
    const confidenceChange = Math.abs(currentConfidence - previousConfidence);
    const previousSetup = previousItem.setupType ?? 'No Trade';
    const currentSetup = currentItem.setupType ?? 'No Trade';
    const intelligence = buildAlertIntelligence(currentItem, null, 'ONE_HOUR_SIGNAL');

    if (previousBucket !== currentBucket) {
      let message = `${currentItem.symbol} changed 1-hour state.`;
      if (currentBucket === 'INCREASE') {
        message = `${currentItem.symbol} entered 1-hour bullish ${String(currentSetup).toLowerCase()} setup.`;
      } else if (currentBucket === 'DECREASE') {
        message = `${currentItem.symbol} moved into bearish ${String(currentSetup).toLowerCase()} risk.`;
      } else if (previousBucket !== 'NO_EDGE') {
        message = `${currentItem.symbol} lost 1-hour directional edge.`;
      }

      alerts.push(
        createAlert({
          type: 'ONE_HOUR_SIGNAL',
          symbol: currentItem.symbol,
          timestamp,
          message,
          dedupeKey: `ONE_HOUR_BUCKET:${currentItem.symbol}:${currentBucket}`,
          meta: {
            bucket: currentBucket,
            confidence: currentConfidence,
            setupType: currentSetup,
            ...intelligence,
            triggerContext: intelligence.alertReason,
            symbolState: buildSymbolState(currentItem),
          },
        }),
      );
    }

    if (currentBucket !== 'NO_EDGE' && confidenceChange >= 8) {
      alerts.push(
        createAlert({
          type: 'ONE_HOUR_SIGNAL',
          symbol: currentItem.symbol,
          timestamp,
          message: `${currentItem.symbol} 1-hour confidence changed sharply to ${currentConfidence}%.`,
          dedupeKey: `ONE_HOUR_CONFIDENCE:${currentItem.symbol}:${currentBucket}:${currentConfidence >= previousConfidence ? 'UP' : 'DOWN'}`,
          meta: {
            bucket: currentBucket,
            confidence: currentConfidence,
            previousConfidence,
            ...intelligence,
            triggerContext: intelligence.alertReason,
            symbolState: buildSymbolState(currentItem),
          },
        }),
      );
    }

    if (currentBucket !== 'NO_EDGE' && previousSetup !== currentSetup && currentSetup !== 'No Trade') {
      alerts.push(
        createAlert({
          type: 'ONE_HOUR_SIGNAL',
          symbol: currentItem.symbol,
          timestamp,
          message: `${currentItem.symbol} shifted from ${String(previousSetup).toLowerCase()} to ${String(currentSetup).toLowerCase()} in the 1-hour model.`,
          dedupeKey: `ONE_HOUR_SETUP:${currentItem.symbol}:${currentSetup}`,
          meta: {
            bucket: currentBucket,
            previousSetup,
            setupType: currentSetup,
            ...intelligence,
            triggerContext: intelligence.alertReason,
            symbolState: buildSymbolState(currentItem),
          },
        }),
      );
    }
  });

  return alerts;
}

export function mergeAlerts(existingAlerts, nextAlerts, limit = MAX_ALERTS) {
  const existing = [...(existingAlerts ?? [])].sort((left, right) => toTimestamp(right.timestamp) - toTimestamp(left.timestamp));
  const accepted = [];
  const latestSeenByKey = new Map();

  existing.forEach((alert) => {
    const key = alert.dedupeKey ?? `${alert.type}:${alert.symbol}:${alert.message}`;
    if (!latestSeenByKey.has(key)) {
      latestSeenByKey.set(key, toTimestamp(alert.timestamp));
    }
  });

  for (const alert of nextAlerts ?? []) {
    const key = alert.dedupeKey ?? `${alert.type}:${alert.symbol}:${alert.message}`;
    const lastTimestamp = latestSeenByKey.get(key);
    const cooldownMs = alert.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    if (lastTimestamp && Math.abs(toTimestamp(alert.timestamp) - lastTimestamp) < cooldownMs) {
      continue;
    }
    latestSeenByKey.set(key, toTimestamp(alert.timestamp));
    accepted.push(alert);
  }

  const merged = [...accepted, ...existing]
    .sort((left, right) => {
      const scoreDiff = (right.alertScore ?? 0) - (left.alertScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return toTimestamp(right.timestamp) - toTimestamp(left.timestamp);
    })
    .slice(0, limit);

  return merged;
}

export function notifyBrowserAlerts(alerts) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  (alerts ?? []).forEach((alert) => {
    new Notification(`${alert.symbol} - ${alert.type}`, {
      body: alert.message,
      tag: `${alert.type}-${alert.symbol}`,
    });
  });
}

export function summarizeAlertCount(alerts) {
  return (alerts ?? []).filter((alert) => (alert.alertPriority ?? 'LOW') !== 'LOW').length || (alerts ?? []).length;
}
