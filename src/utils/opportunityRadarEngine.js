function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
  return Number((value ?? 0).toFixed(decimals));
}

function qualityRank(quality = 'weak') {
  if (String(quality).toLowerCase() === 'strong') return 3;
  if (String(quality).toLowerCase() === 'moderate') return 2;
  return 1;
}

function buildSpikeMap(snapshot = {}) {
  const merged = [
    ...(snapshot?.watchlistPulse ?? []),
    ...(snapshot?.movers ?? []),
    ...(snapshot?.unusuallyActiveNames ?? []),
    ...(snapshot?.stableNames ?? []),
    ...(snapshot?.weakNames ?? []),
    ...(snapshot?.spikeEvents ?? []),
  ];

  return merged.reduce((accumulator, item) => {
    if (item?.symbol && item?.spike) {
      accumulator[item.symbol] = item.spike;
    }
    return accumulator;
  }, {});
}

function buildRow(stock = {}, spikeMap = {}) {
  const prediction = stock?.prediction ?? {};
  const oneHour = stock?.shortTermPredictions?.oneHour ?? {};
  const decision = stock?.decision ?? stock?.signal?.decision ?? {};
  const direction = oneHour?.direction ?? prediction?.direction ?? 'SIDEWAYS';
  const confidence = oneHour?.confidence ?? prediction?.confidence ?? stock?.signal?.confidence ?? 0;
  const quality = oneHour?.quality ?? prediction?.quality ?? stock?.signal?.quality ?? 'weak';
  const trendStrength =
    prediction?.layers?.trend?.strength ??
    prediction?.debug?.trendScore ??
    stock?.trend?.strengthScore ??
    0;
  const momentumStrength =
    prediction?.layers?.momentum?.strength ??
    prediction?.debug?.momentumScore ??
    0;
  const confluenceScore = Math.max(
    prediction?.bullishScore ?? 0,
    prediction?.bearishScore ?? 0,
    prediction?.sidewaysScore ?? 0,
  );
  const spike = spikeMap[stock.symbol] ?? null;
  const spikeSeverityScore = spike?.spikeStrength ?? 0;
  const actionBias = decision?.finalDecision ?? prediction?.actionBias ?? stock?.signal?.signal ?? 'WAIT';
  const noTrade = Boolean(decision?.noTradeMessage) || direction === 'SIDEWAYS' || direction === 'NONE';
  const setupType = stock?.setupType ?? oneHour?.setupType ?? 'No Trade';
  const score = round(
    confidence * 0.34 +
      confluenceScore * 0.24 +
      trendStrength * 0.16 +
      momentumStrength * 0.12 +
      spikeSeverityScore * 0.14 -
      (noTrade ? 18 : 0),
  );

  return {
    symbol: stock?.symbol ?? 'UNKNOWN',
    displayName: stock?.companyName ?? stock?.symbol ?? 'Unknown',
    sector: stock?.sector ?? 'Unknown',
    direction,
    confidence,
    quality: String(quality).toUpperCase(),
    actionBias,
    actionSummary: decision?.decisionReasonShort ?? stock?.signal?.explanation ?? 'Monitoring',
    spike,
    setupType,
    noTrade,
    score,
    trendStrength,
    momentumStrength,
    confluenceScore,
    currentPrice: stock?.live?.ltp ?? stock?.currentPrice ?? 0,
    lastUpdated: stock?.live?.lastUpdated ?? stock?.lastUpdated ?? null,
    marketStatus: stock?.live?.marketStatus ?? 'UNKNOWN',
  };
}

function byStrength(left, right) {
  return (
    right.score - left.score ||
    right.confidence - left.confidence ||
    qualityRank(right.quality) - qualityRank(left.quality) ||
    (right.spike?.spikeStrength ?? 0) - (left.spike?.spikeStrength ?? 0)
  );
}

function matchesFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'strong') return item.quality === 'STRONG';
  if (filter === 'moderate') return item.quality === 'MODERATE';
  if (filter === 'weak') return item.quality === 'WEAK';
  if (filter === 'high-confidence') return item.confidence >= 68;
  if (filter === 'spike-active') return Boolean(item.spike?.spikeDetected);
  if (filter === 'breakout-watch') return ['Breakout', 'Breakdown'].includes(item.setupType) || ['BUY', 'SELL'].includes(item.actionBias);
  if (filter === 'avoid') return item.noTrade || ['WAIT', 'AVOID'].includes(item.actionBias);
  return true;
}

function summarizeActionStrip(rows = []) {
  const bullish = rows.filter((item) => item.direction === 'UP' && !item.noTrade);
  const bearish = rows.filter((item) => item.direction === 'DOWN' && !item.noTrade);
  const spikes = rows.filter((item) => item.spike?.spikeDetected);
  const sideways = rows.filter((item) => item.noTrade);
  const sectors = rows.reduce((accumulator, item) => {
    accumulator[item.sector] ??= { bullish: 0, bearish: 0 };
    if (item.direction === 'UP' && !item.noTrade) accumulator[item.sector].bullish += 1;
    if (item.direction === 'DOWN' && !item.noTrade) accumulator[item.sector].bearish += 1;
    return accumulator;
  }, {});
  const strongestSector = Object.entries(sectors).sort(
    (left, right) => (right[1].bullish - right[1].bearish) - (left[1].bullish - left[1].bearish),
  )[0]?.[0];

  if (spikes.length >= 4) {
    return 'Spike activity is elevated — volatile conditions need extra confirmation.';
  }
  if (bullish.length >= bearish.length + 2 && strongestSector && strongestSector !== 'Unknown') {
    return `Bullish strength is concentrated in ${strongestSector} stocks.`;
  }
  if (sideways.length >= Math.ceil(rows.length * 0.45)) {
    return 'Most tracked stocks are sideways, so opportunity quality is limited right now.';
  }
  if (bearish.length > bullish.length + 1) {
    return 'Bearish pressure is leading the board, so defensive setups deserve more attention.';
  }
  return 'Opportunity conditions are mixed, so selective setups matter more than broad direction.';
}

export function buildOpportunityRadar(stocks = [], monitoringSnapshot = {}, filter = 'all') {
  const spikeMap = buildSpikeMap(monitoringSnapshot);
  const normalized = (stocks ?? []).map((stock) => buildRow(stock, spikeMap));
  const filtered = normalized.filter((item) => matchesFilter(item, filter));

  const strongBullish = filtered
    .filter((item) => item.direction === 'UP' && !item.noTrade)
    .sort(byStrength)
    .slice(0, 8);
  const strongBearish = filtered
    .filter((item) => item.direction === 'DOWN' && !item.noTrade)
    .sort(byStrength)
    .slice(0, 8);
  const volatileActive = filtered
    .filter((item) => item.spike?.spikeDetected)
    .sort(byStrength)
    .slice(0, 8);
  const noClearEdge = filtered
    .filter((item) => item.noTrade)
    .sort(byStrength)
    .slice(0, 8);

  const ranking = [...filtered].sort(byStrength);
  const heatmap = ranking.map((item) => ({
    ...item,
    intensity: clamp(round((item.confidence * 0.6 + item.score * 0.4) / 100, 2), 0.2, 1),
  }));

  const sectorGroups = Object.entries(
    filtered.reduce((accumulator, item) => {
      const key = item.sector || 'Unknown';
      accumulator[key] ??= [];
      accumulator[key].push(item);
      return accumulator;
    }, {}),
  )
    .map(([sector, items]) => ({
      sector,
      score: round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(items.length, 1)),
      bullish: items.filter((item) => item.direction === 'UP' && !item.noTrade).length,
      bearish: items.filter((item) => item.direction === 'DOWN' && !item.noTrade).length,
      count: items.length,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  return {
    strongBullish,
    strongBearish,
    volatileActive,
    noClearEdge,
    ranking,
    heatmap,
    sectorGroups,
    summaryStrip: summarizeActionStrip(filtered),
    counts: {
      bullish: strongBullish.length,
      bearish: strongBearish.length,
      volatile: volatileActive.length,
      noEdge: noClearEdge.length,
    },
  };
}
