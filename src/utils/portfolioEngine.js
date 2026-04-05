function round(value, decimals = 2) {
  return Number((value ?? 0).toFixed(decimals));
}

function safeNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function quotePrice(analysis = {}) {
  return analysis?.live?.ltp ?? analysis?.currentPrice ?? null;
}

function marketValueLabel(analysis = {}) {
  const status = analysis?.live?.marketStatus ?? 'UNKNOWN';
  return status === 'OPEN' ? 'Current market value' : 'Last session market value';
}

function normalizeHolding(holding = {}) {
  const quantity = Math.max(0, safeNumber(holding.quantity, 0));
  const averageBuyPrice = Math.max(0, safeNumber(holding.averageBuyPrice, 0));
  return {
    id: holding.id ?? `${holding.symbol}-${Date.now()}`,
    symbol: holding.symbol ?? 'UNKNOWN',
    quantity,
    averageBuyPrice,
    totalInvestedAmount:
      safeNumber(holding.totalInvestedAmount, round(quantity * averageBuyPrice)),
    createdAt: holding.createdAt ?? new Date().toISOString(),
    updatedAt: holding.updatedAt ?? holding.createdAt ?? new Date().toISOString(),
  };
}

export function mergeHolding(existingHoldings = [], input = {}) {
  const normalized = normalizeHolding(input);
  const existing = existingHoldings.find((item) => item.symbol === normalized.symbol);

  if (!existing) {
    return [...existingHoldings, normalized];
  }

  const combinedQuantity = safeNumber(existing.quantity, 0) + normalized.quantity;
  const combinedInvested =
    safeNumber(existing.totalInvestedAmount, existing.quantity * existing.averageBuyPrice) +
    safeNumber(normalized.totalInvestedAmount, normalized.quantity * normalized.averageBuyPrice);
  const averageBuyPrice = combinedQuantity > 0 ? round(combinedInvested / combinedQuantity) : 0;

  return existingHoldings.map((item) =>
    item.symbol === normalized.symbol
      ? {
          ...item,
          quantity: combinedQuantity,
          averageBuyPrice,
          totalInvestedAmount: round(combinedInvested),
          updatedAt: new Date().toISOString(),
        }
      : item,
  );
}

export function updateHolding(existingHoldings = [], holdingId, updates = {}) {
  return existingHoldings.map((item) => {
    if (item.id !== holdingId) return item;
    const quantity = Math.max(0, safeNumber(updates.quantity, item.quantity));
    const averageBuyPrice = Math.max(0, safeNumber(updates.averageBuyPrice, item.averageBuyPrice));
    return {
      ...item,
      quantity,
      averageBuyPrice,
      totalInvestedAmount: round(quantity * averageBuyPrice),
      updatedAt: new Date().toISOString(),
    };
  });
}

export function removeHolding(existingHoldings = [], holdingId) {
  return existingHoldings.filter((item) => item.id !== holdingId);
}

export function moveWatchlistItem(watchlist = [], symbol, direction = 'up') {
  const index = watchlist.findIndex((item) => item === symbol);
  if (index === -1) return watchlist;
  const nextIndex = direction === 'down' ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= watchlist.length) return watchlist;
  const next = [...watchlist];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export function buildHoldingSnapshots(holdings = [], analysisData = {}, alerts = []) {
  return holdings.map((holding) => {
    const analysis = analysisData?.[holding.symbol] ?? null;
    const currentPrice = quotePrice(analysis) ?? holding.averageBuyPrice;
    const totalInvestedAmount = safeNumber(
      holding.totalInvestedAmount,
      holding.quantity * holding.averageBuyPrice,
    );
    const currentValue = round(holding.quantity * currentPrice);
    const unrealizedPnL = round(currentValue - totalInvestedAmount);
    const pnlPercent = totalInvestedAmount > 0 ? round((unrealizedPnL / totalInvestedAmount) * 100) : 0;
    const decision = analysis?.decision ?? analysis?.signal?.decision ?? null;
    const signal = analysis?.signal ?? {};
    const riskLevel = decision?.risk?.riskLevel ?? analysis?.prediction?.riskLevel ?? 'MODERATE';
    const relevantAlerts = (alerts ?? []).filter((alert) => alert.symbol === holding.symbol).slice(0, 3);

    return {
      ...holding,
      currentPrice,
      currentValue,
      unrealizedPnL,
      pnlPercent,
      lastUpdated: analysis?.live?.lastUpdated ?? holding.updatedAt ?? null,
      marketStatus: analysis?.live?.marketStatus ?? 'UNKNOWN',
      marketValueLabel: marketValueLabel(analysis),
      direction: analysis?.shortTermPredictions?.oneHour?.direction ?? analysis?.prediction?.direction ?? 'SIDEWAYS',
      confidence: signal?.confidence ?? analysis?.prediction?.confidence ?? 0,
      quality: analysis?.prediction?.quality ?? analysis?.shortTermPredictions?.oneHour?.strength ?? 'WEAK',
      actionBias: decision?.finalDecision ?? analysis?.prediction?.actionBias ?? 'WAIT',
      riskLevel,
      setupQuality: analysis?.zoneQuality ?? analysis?.entryZonePlan?.zoneQualityScore ?? 0,
      stopLossWarning:
        currentPrice <= (analysis?.stopLoss ?? signal?.tradePlan?.stopLoss ?? -Infinity)
          ? 'Price is near or below the stop-loss zone.'
          : 'Stop-loss still holds for now.',
      downsideRiskNote:
        decision?.risk?.worstCaseScenario ??
        analysis?.decision?.risk?.worstCaseScenario ??
        'Review invalidation and downside room before holding through volatility.',
      holdBias:
        decision?.finalDecision === 'SELL'
          ? 'EXIT'
          : decision?.finalDecision === 'AVOID'
            ? 'REDUCE'
            : decision?.finalDecision === 'WAIT'
              ? 'WATCH'
              : 'HOLD',
      alerts: relevantAlerts,
      spike: analysis?.live?.spike ?? analysis?.spike ?? null,
    };
  });
}

export function buildPortfolioSummary(holdingSnapshots = [], watchlistRows = [], alerts = []) {
  const totalInvested = round(
    holdingSnapshots.reduce((sum, item) => sum + safeNumber(item.totalInvestedAmount, 0), 0),
  );
  const currentValue = round(
    holdingSnapshots.reduce((sum, item) => sum + safeNumber(item.currentValue, 0), 0),
  );
  const totalPnL = round(currentValue - totalInvested);
  const totalReturnPercent = totalInvested > 0 ? round((totalPnL / totalInvested) * 100) : 0;
  const sortedByPnL = [...holdingSnapshots].sort((left, right) => (right.pnlPercent ?? 0) - (left.pnlPercent ?? 0));
  const bestHolding = sortedByPnL[0] ?? null;
  const worstHolding = sortedByPnL.at(-1) ?? null;
  const highRiskHolding =
    [...holdingSnapshots]
      .sort((left, right) => {
        const riskRank = { HIGH: 3, MODERATE: 2, LOW: 1 };
        return (riskRank[right.riskLevel] ?? 0) - (riskRank[left.riskLevel] ?? 0);
      })[0] ?? null;
  const strongestWatchlistOpportunity =
    [...watchlistRows]
      .sort((left, right) => (right.signal?.confidence ?? 0) - (left.signal?.confidence ?? 0))[0] ?? null;
  const relevantAlerts = (alerts ?? []).filter((alert) => {
    const symbols = new Set([
      ...holdingSnapshots.map((item) => item.symbol),
      ...watchlistRows.map((item) => item.symbol),
    ]);
    return symbols.has(alert.symbol);
  });

  return {
    totalInvested,
    currentValue,
    totalPnL,
    totalReturnPercent,
    bestHolding,
    worstHolding,
    highRiskHolding,
    strongestWatchlistOpportunity,
    relevantAlerts: relevantAlerts.slice(0, 6),
  };
}

export function buildPersonalWatchlistSummary(rows = [], alerts = []) {
  const source = rows ?? [];
  const bestOpportunity =
    [...source].sort((left, right) => (right.signal?.confidence ?? 0) - (left.signal?.confidence ?? 0))[0] ?? null;
  return {
    total: source.length,
    bestOpportunity,
    breakoutWatch: source.filter((item) => String(item.entryType ?? item.prediction?.actionBias ?? '').includes('BREAKOUT')).slice(0, 5),
    avoid: source.filter((item) => item.decision?.finalDecision === 'AVOID' || item.monitoringTag === 'AVOID').slice(0, 5),
    spikeActive: source.filter((item) => item.spike?.spikeDetected).slice(0, 5),
    highRisk: source.filter((item) => item.decision?.risk?.riskLevel === 'HIGH').slice(0, 5),
    alerts: (alerts ?? []).filter((alert) => source.some((item) => item.symbol === alert.symbol)).slice(0, 6),
  };
}
