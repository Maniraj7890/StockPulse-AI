import { buildStockAnalysis } from '@/utils/signalEngine';

function round(value) {
  return Number((value ?? 0).toFixed(2));
}

function normalizeSignal(signal) {
  if (signal === 'BUY' || signal === 'STRONG BUY') return 'BUY';
  if (signal === 'SELL' || signal === 'STRONG SELL') return 'SELL';
  return 'HOLD';
}

function evaluateSignal(signal, changePercent, holdTolerance = 1.2) {
  if (signal === 'BUY') {
    return changePercent > holdTolerance * 0.5;
  }

  if (signal === 'SELL') {
    return changePercent < holdTolerance * -0.5;
  }

  return Math.abs(changePercent) <= holdTolerance;
}

function bandFromConfidence(confidence) {
  if (confidence >= 75) return 'High';
  if (confidence >= 60) return 'Medium';
  return 'Low';
}

function safeDivide(value, total) {
  if (!total) return 0;
  return round((value / total) * 100);
}

function buildBreakdownSeed() {
  return {
    BUY: { total: 0, correct: 0 },
    SELL: { total: 0, correct: 0 },
    HOLD: { total: 0, correct: 0 },
  };
}

function buildConfidenceSeed() {
  return {
    High: { total: 0, correct: 0 },
    Medium: { total: 0, correct: 0 },
    Low: { total: 0, correct: 0 },
  };
}

function buildSampleStock(stock, candles) {
  return {
    ...stock,
    candles,
    live: null,
    currentPrice: candles.at(-1)?.close ?? stock.currentPrice ?? 0,
    volume: candles.at(-1)?.volume ?? stock.volume ?? 0,
  };
}

function simulateWindow(stocks, steps, options = {}) {
  const holdTolerance = options.holdTolerance ?? 1.2;
  const maxSignalsPerStock = options.maxSignalsPerStock ?? 8;
  const breakdown = buildBreakdownSeed();
  const confidenceBands = buildConfidenceSeed();
  const evaluations = [];
  let totalSignals = 0;
  let correctSignals = 0;
  let cumulativeGain = 0;
  let cumulativeLoss = 0;
  let wins = 0;
  let losses = 0;
  let noMove = 0;

  (stocks ?? []).forEach((stock) => {
    const candles = stock.candles ?? [];
    const startIndex = Math.max(6, candles.length - (steps + maxSignalsPerStock));
    const endIndex = candles.length - steps - 1;

    for (let index = startIndex; index <= endIndex; index += 1) {
      const sampleCandles = candles.slice(0, index + 1);
      const futureCandle = candles[index + steps];
      const entryCandle = candles[index];

      if (!futureCandle || !entryCandle) {
        continue;
      }

      const analysis = buildStockAnalysis(buildSampleStock(stock, sampleCandles));
      const signal = normalizeSignal(analysis.signal.signal);
      const entryPrice = entryCandle.close;
      const futurePrice = futureCandle.close;
      const changePercent = round(((futurePrice - entryPrice) / Math.max(entryPrice, 1)) * 100);
      const correct = evaluateSignal(signal, changePercent, holdTolerance);
      const confidenceBand = bandFromConfidence(analysis.signal.confidence);

      totalSignals += 1;
      if (correct) {
        correctSignals += 1;
      }

      breakdown[signal].total += 1;
      breakdown[signal].correct += correct ? 1 : 0;
      confidenceBands[confidenceBand].total += 1;
      confidenceBands[confidenceBand].correct += correct ? 1 : 0;

      if (changePercent > 0) {
        cumulativeGain += changePercent;
        wins += correct ? 1 : 0;
      } else if (changePercent < 0) {
        cumulativeLoss += changePercent;
        losses += !correct && signal !== 'HOLD' ? 1 : 0;
      } else {
        noMove += 1;
      }

      evaluations.push({
        id: `${stock.symbol}-${steps}-${entryCandle.time}`,
        symbol: stock.symbol,
        companyName: stock.companyName,
        signal,
        confidence: analysis.signal.confidence,
        confidenceBand,
        entryPrice,
        futurePrice,
        changePercent,
        correct,
        evaluationSteps: steps,
        timestamp: entryCandle.time,
        evaluatedAt: futureCandle.time,
        reasons: analysis.signal.reasons ?? [],
      });
    }
  });

  return {
    steps,
    totalSignals,
    correctSignals,
    accuracy: safeDivide(correctSignals, totalSignals),
    breakdown,
    confidenceBands,
    averageGain: wins ? round(cumulativeGain / Math.max(wins, 1)) : 0,
    averageLoss: losses ? round(cumulativeLoss / Math.max(losses, 1)) : 0,
    evaluations,
    noMove,
  };
}

export function buildBacktestStats(stocks, options = {}) {
  const windows = options.windows ?? [5, 10];
  const windowResults = windows.map((steps) => simulateWindow(stocks, steps, options));
  const primary = windowResults[0] ?? simulateWindow(stocks, 5, options);
  const allEvaluations = windowResults.flatMap((result) => result.evaluations);
  const highBand = primary.confidenceBands.High;
  const lowBand = primary.confidenceBands.Low;
  const recentPredictions = [...allEvaluations]
    .sort((left, right) => new Date(right.evaluatedAt).getTime() - new Date(left.evaluatedAt).getTime())
    .slice(0, 20);

  const bestSetupType =
    primary.breakdown.BUY.correct >= primary.breakdown.SELL.correct
      ? 'BUY setups with supportive trend continuation'
      : 'SELL setups during weakening momentum';
  const weakSetupType =
    primary.breakdown.HOLD.total && primary.breakdown.HOLD.correct < primary.breakdown.BUY.correct
      ? 'HOLD calls in expanding volatility'
      : 'Late directional signals with mixed confirmation';

  return {
    totalSignals: primary.totalSignals,
    correctSignals: primary.correctSignals,
    accuracy: primary.accuracy,
    breakdown: primary.breakdown,
    windowResults,
    confidenceBands: {
      High: { ...highBand, accuracy: safeDivide(highBand.correct, highBand.total) },
      Medium: {
        ...primary.confidenceBands.Medium,
        accuracy: safeDivide(primary.confidenceBands.Medium.correct, primary.confidenceBands.Medium.total),
      },
      Low: { ...lowBand, accuracy: safeDivide(lowBand.correct, lowBand.total) },
    },
    recentPredictions,
    wins: primary.breakdown.BUY.correct + primary.breakdown.SELL.correct,
    losses: primary.totalSignals - primary.correctSignals,
    successRate: primary.accuracy,
    averageGain: primary.averageGain,
    averageLoss: primary.averageLoss,
    maxDrawdown: round(Math.min(primary.averageLoss * 1.8, 0)),
    bestSetupType,
    weakSetupType,
    notes:
      'This backtest replays the existing rule engine across recent mock candle history using only stored data. It is educational and should not be treated as live execution evidence.',
  };
}
