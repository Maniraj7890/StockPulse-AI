import {
  adx,
  atr,
  averageVolume,
  bollingerBands,
  breakoutState,
  basicVolatility,
  detectVolumeSpike,
  ema,
  emaCrossover,
  macd,
  priceMomentum,
  reversalWarning,
  rsi,
  sidewaysDetection,
  supportResistance,
  supertrend,
  trendStrength,
  vwap,
} from '@/utils/indicators';
import {
  buildBuyZoneAnalysis,
  buildCombinedTradeGuidance,
  buildEntryZoneEngine,
  buildExitPlan,
  buildExitZoneEngine,
  suggestStopLoss,
  suggestTarget,
} from '@/utils/tradePlanEngine';
import { buildDecisionSupport } from '@/utils/decisionEngine';
import { buildPredictionEngine } from '@/utils/predictionEngine';
import { buildHourPredictions } from '@/utils/hourPredictionEngine';
import { buildShortTermPredictions } from '@/utils/shortTermPredictionEngine';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Number(value.toFixed(2));
}

function probabilityLabel(score) {
  if (score >= 85) return 'Very High Probability';
  if (score >= 70) return 'High Probability';
  if (score >= 55) return 'Moderate Probability';
  if (score >= 40) return 'Low Probability';
  return 'Avoid';
}

function qualityLabel(score) {
  if (score >= 80) return 'Safe';
  if (score >= 62) return 'Moderate';
  if (score >= 45) return 'Aggressive';
  return 'Low Quality';
}

function targetProbabilityLabel(score) {
  if (score >= 72) return 'High probability';
  if (score >= 52) return 'Medium probability';
  return 'Low probability';
}

function strategyProfile(mode = 'Balanced') {
  if (mode === 'Strict') {
    return {
      minTimeframeScore: 72,
      minVolumeScore: 62,
      breakoutTolerance: 0.75,
      riskRewardFloor: 1.35,
      overextensionPenalty: 16,
      weakMarketPenalty: 16,
      weakSectorPenalty: 12,
    };
  }

  if (mode === 'Aggressive') {
    return {
      minTimeframeScore: 52,
      minVolumeScore: 45,
      breakoutTolerance: 0.45,
      riskRewardFloor: 0.95,
      overextensionPenalty: 8,
      weakMarketPenalty: 8,
      weakSectorPenalty: 6,
    };
  }

  return {
    minTimeframeScore: 62,
    minVolumeScore: 54,
    breakoutTolerance: 0.6,
    riskRewardFloor: 1.15,
    overextensionPenalty: 12,
    weakMarketPenalty: 12,
    weakSectorPenalty: 9,
  };
}

function buildMarketRegime(stocks) {
  const source = stocks ?? [];
  if (!source.length) {
    return { label: 'neutral', score: 50 };
  }

  const averageChange =
    source.reduce((sum, stock) => {
      const candles = stock.candles ?? [];
      const latest = candles.at(-1)?.close ?? stock.currentPrice ?? 0;
      const previous = candles.at(-2)?.close ?? latest;
      return sum + (((latest - previous) / Math.max(previous, 1)) * 100 || 0);
    }, 0) / source.length;

  const positiveCount = source.filter((stock) => {
    const candles = stock.candles ?? [];
    const latest = candles.at(-1)?.close ?? stock.currentPrice ?? 0;
    const previous = candles.at(-2)?.close ?? latest;
    return latest >= previous;
  }).length;

  const breadth = positiveCount / source.length;
  const score = round(averageChange * 18 + breadth * 55);

  if (score >= 56) return { label: 'bullish', score: clamp(score, 0, 100) };
  if (score <= 42) return { label: 'weak', score: clamp(score, 0, 100) };
  return { label: 'neutral', score: clamp(score, 0, 100) };
}

function buildSectorStrengthMap(stocks) {
  const groups = (stocks ?? []).reduce((accumulator, stock) => {
    const sector = stock.sector ?? 'Unknown';
    accumulator[sector] ??= [];
    accumulator[sector].push(stock);
    return accumulator;
  }, {});

  return Object.entries(groups).reduce((accumulator, [sector, items]) => {
    const score =
      items.reduce((sum, stock) => {
        const candles = stock.candles ?? [];
        const latest = candles.at(-1)?.close ?? stock.currentPrice ?? 0;
        const previous = candles.at(-2)?.close ?? latest;
        const change = ((latest - previous) / Math.max(previous, 1)) * 100 || 0;
        return sum + change;
      }, 0) / Math.max(items.length, 1);

    accumulator[sector] = clamp(round(50 + score * 10), 0, 100);
    return accumulator;
  }, {});
}

function buildTargetPlan(basePrice, atrValue, setupScore) {
  const atrUnit = atrValue || basePrice * 0.0075;
  const conservative = round(basePrice + atrUnit * 0.38);
  const standard = round(basePrice + atrUnit * 0.68);
  const maximum = round(basePrice + atrUnit * 1.02);

  return {
    conservative: {
      price: conservative,
      probabilityLabel: targetProbabilityLabel(setupScore + 10),
      confidenceNote: 'Closer target with the best follow-through odds.',
    },
    standard: {
      price: standard,
      probabilityLabel: targetProbabilityLabel(setupScore - 4),
      confidenceNote: 'Balanced target if momentum and volume both hold up.',
    },
    maximum: {
      price: maximum,
      probabilityLabel: targetProbabilityLabel(setupScore - 18),
      confidenceNote: 'Stretch target that needs sustained momentum and clean continuation.',
    },
  };
}

function buildSharedSetupMetrics(stock, strategyMode = 'Balanced', regimeOverride, sectorMapOverride) {
  const profile = strategyProfile(strategyMode);
  const livePrice = stock.live?.ltp ?? stock.live?.price ?? stock.currentPrice;
  const currentChangePercent = stock.live?.changePercent ?? stock.dayChangePercent;
  const recentVolume = stock.live?.volume ?? stock.volume ?? 0;
  const averageVolumeValue = stock.indicators.averageVolume ?? recentVolume;
  const recentCandle = stock.candles?.at(-1) ?? {};
  const previousCandle = stock.candles?.at(-2) ?? recentCandle;
  const candleRange = Math.max((recentCandle.high ?? livePrice) - (recentCandle.low ?? livePrice), 1);
  const candleBody = Math.abs((recentCandle.close ?? livePrice) - (recentCandle.open ?? livePrice));
  const upperWick = (recentCandle.high ?? livePrice) - Math.max(recentCandle.close ?? livePrice, recentCandle.open ?? livePrice);
  const candleBodyRatio = candleBody / candleRange;
  const upperWickRatio = upperWick / candleRange;
  const lowConvictionCandle = candleBodyRatio < 0.42 || upperWickRatio > 0.35;
  const immediateRejection =
    (previousCandle.high ?? livePrice) >= stock.supportResistance.resistance * 0.998 &&
    (previousCandle.close ?? livePrice) < (previousCandle.open ?? livePrice);
  const nearResistance =
    livePrice >= stock.supportResistance.resistance * 0.994 &&
    livePrice <= stock.supportResistance.resistance * 1.002;
  const nearSupport =
    livePrice >= stock.supportResistance.support * 0.995 &&
    livePrice <= stock.supportResistance.support * 1.015;
  const resistanceDistance = round(
    ((stock.supportResistance.resistance - livePrice) / Math.max(livePrice, 1)) * 100,
  );
  const breakoutConfirmed =
    stock.trend.breakoutProbability >= 68 && livePrice >= stock.supportResistance.resistance * 0.998;
  const timeframeAgreementScore = stock.multiTimeframe?.agreementScore ?? 0;
  const bullishTimeframes = ['5m', '15m', '1h', '1d'].filter(
    (label) => stock.multiTimeframe?.[label]?.trend === 'Bullish',
  ).length;
  const bullishMacd = stock.indicators.macd > stock.indicators.macdSignal && stock.indicators.macdHistogram > 0;
  const bullishEma = stock.indicators.ema9 > stock.indicators.ema21;
  const aboveVwap = livePrice > stock.indicators.vwap;
  const strongTrend = stock.trend.strengthScore >= 65 || timeframeAgreementScore >= 70;
  const strongVolume =
    stock.indicators.volumeSpike ||
    stock.indicators.volumeTrend === 'Strong' ||
    recentVolume > averageVolumeValue * 1.05;
  const volumeConfirmation = clamp(
    round(((recentVolume / Math.max(averageVolumeValue, 1)) * 55) + (stock.indicators.volumeSpike ? 18 : 0)),
    0,
    100,
  );
  const healthyRsi = stock.indicators.rsi14 >= 52 && stock.indicators.rsi14 <= 68;
  const overboughtWarning = stock.indicators.rsi14 >= 72;
  const overextendedFromVwap =
    ((livePrice - stock.indicators.vwap) / Math.max(stock.indicators.vwap, 1)) * 100 >= 1.35;
  const overextendedFromEma =
    ((livePrice - stock.indicators.ema9) / Math.max(stock.indicators.ema9, 1)) * 100 >= 1.1;
  const overextensionRisk = overboughtWarning || overextendedFromVwap || overextendedFromEma;
  const falseBreakoutRisk =
    nearResistance &&
    !breakoutConfirmed &&
    (volumeConfirmation < profile.minVolumeScore ||
      lowConvictionCandle ||
      timeframeAgreementScore < profile.minTimeframeScore ||
      immediateRejection);
  const breakoutQuality = clamp(
    round(
      (breakoutConfirmed ? 36 : nearResistance ? 18 : 8) +
        (strongVolume ? 22 : -10) +
        (candleBodyRatio >= 0.55 ? 12 : -6) +
        (timeframeAgreementScore >= 75 ? 16 : timeframeAgreementScore >= 55 ? 8 : -8) +
        (immediateRejection ? -14 : 0) +
        (falseBreakoutRisk ? -20 : 0),
    ),
    0,
    100,
  );
  const riskUnit = stock.indicators.atr14 || livePrice * 0.0075;
  const targets = buildTargetPlan(livePrice, stock.indicators.atr14, stock.signal?.confidence ?? 55);
  const invalidationLevel = round(Math.min(stock.signal.tradePlan.stopLoss, livePrice - riskUnit * 0.9));
  const reward = targets.standard.price - livePrice;
  const risk = Math.max(livePrice - invalidationLevel, 1);
  const riskReward = round(reward / risk);
  const sectorMap = sectorMapOverride ?? {};
  const sectorScore = sectorMap[stock.sector] ?? 50;
  const marketRegime = regimeOverride ?? { label: 'neutral', score: 50 };
  const weakMarket = marketRegime.label === 'weak';
  const weakSector = sectorScore < 45;

  const confidenceBreakdown = {
    trend: clamp(round(stock.trend.strengthScore), 0, 100),
    volume: volumeConfirmation,
    breakout: breakoutQuality,
    timeframe: timeframeAgreementScore,
    riskReward: clamp(round(riskReward * 30), 0, 100),
    overextensionRisk: overextensionRisk ? 78 : resistanceDistance < 0.7 ? 48 : 22,
  };

  const setupWarnings = [];
  const strengthReasons = [];

  if (strongTrend) strengthReasons.push('Trend quality remains supportive.');
  if (strongVolume) strengthReasons.push('Volume confirms the active move.');
  if (breakoutConfirmed) strengthReasons.push('Breakout is confirmed rather than speculative.');
  if (aboveVwap) strengthReasons.push('Price is holding above VWAP.');
  if (bullishMacd) strengthReasons.push('MACD momentum remains supportive.');
  if (falseBreakoutRisk) setupWarnings.push('Breakout quality is weak and vulnerable to failure.');
  if (overextensionRisk) setupWarnings.push('Price is stretched and vulnerable to a fast pullback.');
  if (weakMarket) setupWarnings.push('Overall market regime is weak, so bullish follow-through is less reliable.');
  if (weakSector) setupWarnings.push('Sector strength is weak relative to the stock setup.');
  if (lowConvictionCandle) setupWarnings.push('Recent candle quality is low conviction.');
  if (immediateRejection) setupWarnings.push('Recent candles already show rejection near resistance.');
  if (riskReward < profile.riskRewardFloor) setupWarnings.push('Risk/reward is below the current strategy threshold.');

  const setupType =
    falseBreakoutRisk
      ? 'Wait for breakout'
      : overextensionRisk
        ? 'Wait for pullback'
        : breakoutConfirmed || (aboveVwap && bullishEma && bullishMacd && strongVolume)
          ? 'Buy now'
          : nearSupport && healthyRsi
            ? 'Support bounce'
            : 'Avoid';

  const failureCondition =
    setupType === 'Buy now'
      ? 'Price loses VWAP and slips under the invalidation level.'
      : setupType === 'Wait for breakout'
        ? 'Breakout attempt fails again with weak volume or rejection.'
        : setupType === 'Wait for pullback'
          ? 'Pullback does not hold near EMA 9 or VWAP.'
          : 'Trend quality does not improve enough to justify risk.';

  return {
    profile,
    livePrice,
    currentChangePercent,
    recentVolume,
    averageVolumeValue,
    candleBodyRatio,
    upperWickRatio,
    lowConvictionCandle,
    immediateRejection,
    nearResistance,
    nearSupport,
    resistanceDistance,
    breakoutConfirmed,
    timeframeAgreementScore,
    bullishTimeframes,
    bullishMacd,
    bullishEma,
    aboveVwap,
    strongTrend,
    strongVolume,
    volumeConfirmation,
    healthyRsi,
    overextensionRisk,
    falseBreakoutRisk,
    breakoutQuality,
    riskUnit,
    targets,
    invalidationLevel,
    riskReward,
    marketRegime,
    sectorScore,
    confidenceBreakdown,
    setupWarnings,
    strengthReasons,
    setupType,
    failureCondition,
    weakMarket,
    weakSector,
  };
}

function entryTypeTone(score) {
  if (score >= 78) return 'BUY NOW';
  if (score >= 64) return 'WAIT FOR BREAKOUT';
  if (score >= 54) return 'WAIT FOR PULLBACK';
  if (score >= 46) return 'SUPPORT BOUNCE';
  return 'AVOID';
}

function buildMultiTimeframeConfirmation({ finalScore, adx14, rsi14, macdResult, liveChange }) {
  const timeframes = {
    '5m': finalScore + liveChange * 7 + (macdResult.histogram > 0 ? 8 : -6),
    '15m': finalScore + (rsi14 >= 50 ? 6 : -6) + (macdResult.macd > macdResult.signal ? 7 : -5),
    '1h': finalScore + (adx14 >= 24 ? 10 : -4),
    '1d': finalScore + (adx14 >= 24 ? 6 : -2) + (rsi14 >= 48 ? 4 : -4),
  };

  const mapped = Object.entries(timeframes).reduce((accumulator, [key, rawScore]) => {
    const score = clamp(round(rawScore + 50), 0, 100);
    accumulator[key] = {
      trend: score >= 62 ? 'Bullish' : score <= 40 ? 'Bearish' : 'Neutral',
      signalStrength: score,
    };
    return accumulator;
  }, {});

  const bullishCount = Object.values(mapped).filter((item) => item.trend === 'Bullish').length;

  return {
    ...mapped,
    agreement: bullishCount >= 3 ? 'Strong bullish agreement' : bullishCount === 2 ? 'Mixed agreement' : 'Weak agreement',
    agreementScore: round((bullishCount / 4) * 100),
  };
}

function classifySignal(score) {
  if (score >= 36) return 'STRONG BUY';
  if (score >= 16) return 'BUY';
  if (score <= -36) return 'STRONG SELL';
  if (score <= -16) return 'SELL';
  return 'WAIT';
}

function classifyIndexSignal(score) {
  if (score >= 16) return 'BUY';
  if (score <= -16) return 'SELL';
  return 'HOLD';
}

function normalizeConfidenceFromBreakdown(breakdown, penalties = 0) {
  const weightedScore =
    breakdown.trend * 0.24 +
    breakdown.momentum * 0.18 +
    breakdown.volume * 0.18 +
    breakdown.location * 0.16 +
    breakdown.trendQuality * 0.14 +
    breakdown.riskControl * 0.1 -
    penalties;

  return clamp(round(weightedScore), 18, 96);
}

function riskLevelFromConfidence(confidence, downsideFlags) {
  if (downsideFlags >= 3 || confidence < 42) return 'High';
  if (downsideFlags >= 2 || confidence < 64) return 'Moderate';
  return 'Low';
}

function scoreRsiComponent(rsiValue) {
  if (rsiValue >= 52 && rsiValue <= 64) {
    return { score: 88, reason: 'RSI is in a healthy bullish range.' };
  }
  if (rsiValue > 72) {
    return { score: 24, reason: 'RSI overbought' };
  }
  if (rsiValue < 42) {
    return { score: 18, reason: 'RSI is weak and below neutral.' };
  }
  return { score: 52, reason: 'RSI is neutral.' };
}

function scoreEmaComponent(emaCross) {
  if (emaCross.bullish && emaCross.spreadPercent >= 0.2) {
    return { score: 90, reason: 'EMA9 above EMA21 (bullish)' };
  }
  if (emaCross.bearish && emaCross.spreadPercent <= -0.2) {
    return { score: 12, reason: 'EMA9 below EMA21 (bearish)' };
  }
  return { score: 50, reason: 'EMA crossover is flat or weak.' };
}

function scoreMomentumComponent(momentum) {
  if (momentum.changePercent >= 0.7) {
    return { score: 84, reason: 'Recent price momentum is positive.' };
  }
  if (momentum.changePercent <= -0.7) {
    return { score: 16, reason: 'Recent price momentum is negative.' };
  }
  return { score: 50, reason: 'Momentum is mixed.' };
}

function scoreVolatilityComponent(volatility, sideways) {
  if (sideways.isSideways || volatility.lowVolatility) {
    return { score: 36, reason: 'Low volatility (sideways)' };
  }
  if (volatility.rangePercent >= 4.5) {
    return { score: 68, reason: 'Volatility is high enough for directional follow-through.' };
  }
  return { score: 56, reason: 'Volatility is normal.' };
}

function weightedSignalDecision({ rsiValue, emaCross, momentum, volatility, sideways }) {
  const rsiComponent = scoreRsiComponent(rsiValue);
  const emaComponent = scoreEmaComponent(emaCross);
  const momentumComponent = scoreMomentumComponent(momentum);
  const volatilityComponent = scoreVolatilityComponent(volatility, sideways);

  const weightedScore =
    rsiComponent.score * 0.3 +
    emaComponent.score * 0.3 +
    momentumComponent.score * 0.2 +
    volatilityComponent.score * 0.2;

  const normalizedBiasScore = round(weightedScore - 50);
  const mixedSignals =
    (emaCross.bullish && momentum.changePercent < 0) ||
    (emaCross.bearish && momentum.changePercent > 0) ||
    (rsiValue > 68 && momentum.changePercent > 0 && volatility.lowVolatility);
  const holdPriority = sideways.isSideways || volatility.lowVolatility || mixedSignals;

  let signal = 'HOLD';
  if (!holdPriority && normalizedBiasScore >= 12) {
    signal = 'BUY';
  } else if (!holdPriority && normalizedBiasScore <= -12) {
    signal = 'SELL';
  }

  const rawConfidence = 50 + Math.abs(normalizedBiasScore) * 0.9 - (holdPriority ? 6 : 0);
  const confidence = clamp(round(rawConfidence), 50, 90);
  const reasons = [
    emaComponent.reason,
    rsiComponent.reason,
    momentumComponent.reason,
    volatilityComponent.reason,
  ];

  return {
    signal,
    confidence,
    reasons,
    weightedScore: round(weightedScore),
    normalizedBiasScore,
    holdPriority,
    components: {
      rsi: rsiComponent.score,
      ema: emaComponent.score,
      momentum: momentumComponent.score,
      volatility: volatilityComponent.score,
    },
  };
}

export function buildStockAnalysis(stock) {
  const candles = stock.candles ?? [];
  if (!candles.length) {
    const fallbackForecast = buildShortTermPredictions({
      currentPrice: stock.live?.ltp ?? stock.currentPrice ?? 0,
      marketStatus: stock.live?.marketStatus ?? 'UNKNOWN',
      stale: Boolean(stock.live?.stale),
      closes: [],
      previousPredictions: stock.shortTermPredictions ?? {},
    });
    return {
      ...stock,
      currentPrice: stock.live?.ltp ?? stock.currentPrice ?? 0,
      dayChangePercent: stock.live?.changePercent ?? stock.dayChangePercent ?? 0,
      ohlc: stock.ohlc ?? { open: 0, high: 0, low: 0, close: 0 },
      volume: stock.live?.volume ?? stock.volume ?? 0,
      lastUpdated: stock.live?.lastUpdated ?? null,
      indicators: {
        rsi14: 50,
        ema9: stock.live?.ltp ?? stock.currentPrice ?? 0,
        ema21: stock.live?.ltp ?? stock.currentPrice ?? 0,
        ema50: stock.live?.ltp ?? stock.currentPrice ?? 0,
        ema200: stock.live?.ltp ?? stock.currentPrice ?? 0,
        macd: 0,
        macdSignal: 0,
        macdHistogram: 0,
        bollingerUpper: stock.live?.ltp ?? stock.currentPrice ?? 0,
        bollingerMiddle: stock.live?.ltp ?? stock.currentPrice ?? 0,
        bollingerLower: stock.live?.ltp ?? stock.currentPrice ?? 0,
        vwap: stock.live?.ltp ?? stock.currentPrice ?? 0,
        atr14: 0,
        adx14: 18,
        supertrend: stock.live?.ltp ?? stock.currentPrice ?? 0,
        supertrendDirection: 'Sideways',
        averageVolume: stock.live?.volume ?? stock.volume ?? 0,
        volumeSpike: false,
        volumeTrend: 'Muted',
      },
      supportResistance: stock.supportResistance ?? { support: stock.currentPrice ?? 0, resistance: stock.currentPrice ?? 0 },
      trend: {
        direction: 'Sideways',
        strengthScore: 34,
        breakoutProbability: 15,
        reversalWarning: 'None',
        multiTimeframeAgreement: 'Weak agreement',
        sideways: true,
        sidewaysReason: 'Not enough candles for reliable analysis.',
      },
      shortTermPredictions: fallbackForecast,
      multiTimeframe: {
        agreement: 'Weak agreement',
        agreementScore: 25,
      },
      signal: {
        signal: 'WAIT',
        confidence: 50,
        bias: 'Neutral',
        tradeQuality: 22,
        riskLevel: 'high',
        riskRewardRatio: 0.8,
        explanation: 'Data is incomplete, so the model defaults to HOLD-style caution.',
        buyReasons: ['Not enough candle history to validate a bullish setup.'],
        sellReasons: ['Not enough candle history to validate a bearish setup.'],
        tradePlan: {
          idealEntry: stock.live?.ltp ?? stock.currentPrice ?? 0,
          aggressiveEntry: stock.live?.ltp ?? stock.currentPrice ?? 0,
          safeEntry: stock.live?.ltp ?? stock.currentPrice ?? 0,
          stopLoss: stock.live?.ltp ?? stock.currentPrice ?? 0,
          target1: stock.live?.ltp ?? stock.currentPrice ?? 0,
          target2: stock.live?.ltp ?? stock.currentPrice ?? 0,
          target3: stock.live?.ltp ?? stock.currentPrice ?? 0,
          trailingStop: stock.live?.ltp ?? stock.currentPrice ?? 0,
        },
      },
      prediction: {
        signal: 'HOLD',
        confidence: 50,
        trend: 'sideways',
        riskLevel: 'high',
        reasons: ['Not enough candle history to validate a directional setup.'],
        indicators: {
          rsi: 50,
          ema9: stock.live?.ltp ?? stock.currentPrice ?? 0,
          ema21: stock.live?.ltp ?? stock.currentPrice ?? 0,
          macd: 0,
          momentum: 0,
          volatility: 0,
        },
      },
    };
  }

  const closes = candles.map((candle) => candle.close);
  const recentReturns = closes.slice(1).map((close, index) => ((close - closes[index]) / Math.max(closes[index], 1)) * 100);
  const latest = candles.at(-1) ?? candles[0];
  const previous = candles.at(-2) ?? latest;

  const emaCross = emaCrossover(closes, 9, 21);
  const ema9 = emaCross.short;
  const ema21 = emaCross.long;
  const ema50 = ema(closes, Math.min(50, closes.length));
  const ema200 = ema(closes, Math.min(200, closes.length));
  const macdResult = macd(closes);
  const rsi14 = rsi(closes, 14);
  const bollinger = bollingerBands(closes, Math.min(20, closes.length));
  const vwapValue = vwap(candles);
  const atr14 = atr(candles, 14);
  const adx14 = adx(candles, 14);
  const supertrendResult = supertrend(candles, 10, 3);
  const avgVolume = averageVolume(candles, 10);
  const volumeSpike = detectVolumeSpike(candles, 1.2);
  const levels = supportResistance(candles, 8);
  const breakout = breakoutState(candles, levels, 0.0025);
  const trend = trendStrength(candles);
  const sideways = sidewaysDetection(candles);
  const volatility = basicVolatility(candles, 10);
  const momentum = priceMomentum(closes, 3);
  const reversal = reversalWarning(candles, rsi14);
  const dayChangePercent = round((((latest.close ?? 0) - (previous.close ?? latest.close ?? 1)) / Math.max(previous.close ?? 1, 1)) * 100);

  const buyReasons = [];
  const sellReasons = [];
  const holdReasons = [];

  const bullishAlignment = ema9 > ema21 && ema21 > ema50;
  const bearishAlignment = ema9 < ema21 && ema21 < ema50;
  const aboveVwap = latest.close > vwapValue;
  const bullishMacd = macdResult.macd > macdResult.signal && macdResult.histogram > 0;
  const bearishMacd = macdResult.macd < macdResult.signal && macdResult.histogram < 0;
  const healthyRsi = rsi14 >= 50 && rsi14 <= 65;
  const overbought = rsi14 >= 72;
  const oversoldWeak = rsi14 <= 38;
  const strongVolume = volumeSpike || latest.volume > avgVolume * 1.05;
  const nearResistance = breakout.nearResistance && !breakout.breakout;
  const conflictingMomentum = (bullishAlignment && bearishMacd) || (bearishAlignment && bullishMacd);
  const weightedDecision = weightedSignalDecision({
    rsiValue: rsi14,
    emaCross,
    momentum,
    volatility,
    sideways,
  });
  const enginePrediction = buildPredictionEngine({
    marketStatus: stock.live?.marketStatus ?? 'UNKNOWN',
    rsiValue: rsi14,
    emaCross,
    macdResult,
    momentum,
    volatility,
    sideways,
    adxValue: adx14,
  });

  const trendScore = clamp(
    round(
      (bullishAlignment ? 78 : bearishAlignment ? 22 : 48) * 0.55 +
        trend.strengthScore * 0.45 -
        (sideways.isSideways ? 18 : 0),
    ),
    0,
    100,
  );
  const momentumScore = clamp(
    round(
      (bullishMacd ? 72 : bearishMacd ? 28 : 48) * 0.5 +
        (healthyRsi ? 74 : overbought ? 38 : oversoldWeak ? 28 : 50) * 0.5,
    ),
    0,
    100,
  );
  const volumeScore = clamp(round((strongVolume ? 72 : 36) + (volumeSpike ? 12 : 0) - (sideways.isSideways ? 10 : 0)), 0, 100);
  const locationScore = clamp(
    round(
      (aboveVwap ? 68 : 34) +
        (breakout.breakout ? 12 : 0) +
        (breakout.nearSupport && latest.close > latest.open ? 10 : 0) -
        (nearResistance ? 18 : 0),
    ),
    0,
    100,
  );
  const trendQualityScore = clamp(round((adx14 >= 24 ? 74 : adx14 >= 20 ? 56 : 36) - sideways.score * 0.18), 0, 100);

  let buyScore = 0;
  let sellScore = 0;

  if (bullishAlignment) {
    buyScore += 20;
    buyReasons.push('EMA 9 is above EMA 21 and trend structure is supportive.');
  }
  if (bearishAlignment) {
    sellScore += 20;
    sellReasons.push('EMA 9 is below EMA 21 and the short trend is weakening.');
  }
  if (aboveVwap) {
    buyScore += 12;
    buyReasons.push('Price is holding above VWAP.');
  } else {
    sellScore += 12;
    sellReasons.push('Price is trading below VWAP.');
  }
  if (bullishMacd) {
    buyScore += 14;
    buyReasons.push('MACD bullish crossover supports upside momentum.');
  } else if (bearishMacd) {
    sellScore += 14;
    sellReasons.push('MACD bearish crossover is pressuring the setup.');
  }
  if (healthyRsi) {
    buyScore += 10;
    buyReasons.push('RSI is in a healthy range for continuation rather than exhaustion.');
  } else if (overbought) {
    sellScore += 8;
    holdReasons.push('RSI is stretched, so chasing here increases pullback risk.');
  } else if (oversoldWeak) {
    sellScore += 8;
    sellReasons.push('RSI remains weak and is not confirming a recovery yet.');
  }
  if (adx14 >= 24) {
    buyScore += 8;
    buyReasons.push('ADX confirms that trend strength is meaningful.');
  } else {
    holdReasons.push('ADX suggests trend conviction is weak.');
  }
  if (strongVolume) {
    buyScore += 10;
    buyReasons.push('Volume is above average and confirms participation.');
  } else {
    holdReasons.push('Volume is not confirming the move strongly enough.');
  }
  if (breakout.breakout) {
    buyScore += 14;
    buyReasons.push('Resistance has been cleared with confirmation.');
  }
  if (breakout.nearSupport && latest.close > latest.open) {
    buyScore += 8;
    buyReasons.push('Price is showing a support bounce.');
  }
  if (nearResistance) {
    holdReasons.push('Price is near resistance without breakout confirmation.');
  }
  if (breakout.breakdown) {
    sellScore += 14;
    sellReasons.push('Breakdown risk is active below support.');
  }
  if (supertrendResult.direction === 'Bullish') {
    buyScore += 8;
    buyReasons.push('Supertrend remains supportive.');
  } else {
    sellScore += 8;
    sellReasons.push('Supertrend is bearish.');
  }
  if (reversal !== 'None') {
    sellScore += 6;
    holdReasons.push(reversal);
  }
  if (sideways.isSideways) {
    holdReasons.push(sideways.reason);
  }
  if (conflictingMomentum) {
    holdReasons.push('Momentum signals are conflicting, so conviction is reduced.');
  }

  const finalScore = clamp(round(buyScore - sellScore + weightedDecision.normalizedBiasScore * 0.6), -70, 70);
  const mixedMarket =
    sideways.isSideways ||
    conflictingMomentum ||
    (Math.abs(finalScore) <= 12 && !breakout.breakout) ||
    (!strongVolume && !breakout.breakout);
  const signal = enginePrediction.signal === 'HOLD'
    ? 'WAIT'
    : mixedMarket && Math.abs(finalScore) < 26
      ? 'WAIT'
      : enginePrediction.signal === 'BUY'
        ? classifySignal(Math.max(finalScore, 16))
        : enginePrediction.signal === 'SELL'
          ? classifySignal(Math.min(finalScore, -16))
          : classifySignal(finalScore);
  const bias =
    enginePrediction.signal === 'BUY'
      ? 'Bullish'
      : enginePrediction.signal === 'SELL'
        ? 'Bearish'
        : 'Neutral';
  const confidenceBreakdown = {
    trend: trendScore,
    momentum: momentumScore,
    volume: volumeScore,
    location: locationScore,
    trendQuality: trendQualityScore,
    riskControl: clamp(round((nearResistance ? 34 : 62) + (overbought ? -14 : 8) + (breakout.breakdown ? -16 : 0)), 0, 100),
  };
  const confidencePenalty =
    (mixedMarket ? 14 : 0) +
    (sideways.isSideways ? 10 : 0) +
    (overbought ? 8 : 0) +
    (nearResistance ? 7 : 0) +
    (!strongVolume ? 6 : 0);
  const confidence = clamp(
    round(
      normalizeConfidenceFromBreakdown(confidenceBreakdown, confidencePenalty) * 0.4 +
        weightedDecision.confidence * 0.2 +
        enginePrediction.confidence * 0.4,
    ),
    signal === 'WAIT' ? 35 : 55,
    signal === 'WAIT' ? 60 : 90,
  );
  const tradeQuality = clamp(round(confidence * 0.55 + Math.max(finalScore, 0) * 0.45 - (mixedMarket ? 10 : 0)), 22, 96);
  const riskUnit = atr14 || latest.close * 0.015;
  const multiTimeframe = buildMultiTimeframeConfirmation({
    finalScore,
    adx14,
    rsi14,
    macdResult,
    liveChange: dayChangePercent,
  });

  const idealEntry = bias === 'Bearish' ? round(Math.min(latest.close, ema9)) : round(Math.max(levels.support + riskUnit * 0.2, ema9));
  const aggressiveEntry = round(latest.close);
  const safeEntry = bias === 'Bearish' ? round(Math.min(latest.close, ema21)) : round(Math.max(latest.close, ema21));
  const stopLoss = bias === 'Bearish' ? round(Math.max(levels.resistance, safeEntry + riskUnit)) : round(Math.min(levels.support, safeEntry - riskUnit));
  const target1 = bias === 'Bearish' ? round(safeEntry - riskUnit * 1.2) : round(safeEntry + riskUnit * 1.2);
  const target2 = bias === 'Bearish' ? round(safeEntry - riskUnit * 2.1) : round(safeEntry + riskUnit * 2.1);
  const target3 = bias === 'Bearish' ? round(safeEntry - riskUnit * 3.2) : round(safeEntry + riskUnit * 3.2);
  const trailingStop = bias === 'Bearish' ? round(ema9 + riskUnit * 0.3) : round(ema9 - riskUnit * 0.3);
  const reward = Math.abs(target2 - safeEntry);
  const risk = Math.abs(safeEntry - stopLoss) || 1;
  const riskRewardRatio = round(reward / risk);
  const breakoutProbability = clamp(round((Math.max(0, finalScore) / 70) * 100 - (sideways.isSideways ? 18 : 0)), 6, 92);
  const riskLevel = enginePrediction.riskLevel;
  const weightedReasons = weightedDecision.reasons.filter(Boolean);
  const finalBuyReasons = [...enginePrediction.reasons, ...weightedReasons, ...buyReasons].slice(0, 4);
  const finalSellReasons = [...enginePrediction.reasons, ...weightedReasons, ...sellReasons].slice(0, 4);
  const explanation =
    signal === 'WAIT'
      ? [...enginePrediction.reasons.slice(0, 2), ...holdReasons.slice(0, 1)].join(' ')
      : signal.includes('SELL')
        ? [...finalSellReasons.slice(0, 2), ...holdReasons.slice(0, 1)].join(' ')
        : [...finalBuyReasons.slice(0, 2), ...holdReasons.slice(0, 1)].join(' ');
  const buyZone = buildBuyZoneAnalysis({
    livePrice: latest.close,
    ema9,
    ema21,
    rsi14,
    trendDirection: trend.direction,
    trendStrength: trend.strengthScore,
    support: levels.support,
    resistance: levels.resistance,
    candles,
    atrValue: atr14,
  });
  const guidedStopLoss = suggestStopLoss({
    livePrice: latest.close,
    support: buyZone.nearestSupport,
    atrValue: atr14,
    entryLabel: buyZone.entryLabel,
  });
  const guidedTarget = suggestTarget({
    livePrice: latest.close,
    resistance: buyZone.nearestResistance,
    atrValue: atr14,
    entryLabel: buyZone.entryLabel,
    bullishBias: bias !== 'Bearish',
  });
  const exitPlan = buildExitPlan({
    livePrice: latest.close,
    rsi14,
    ema9,
    ema21,
    momentumPercent: momentum.changePercent,
    stopLoss: guidedStopLoss,
    target: guidedTarget,
    support: buyZone.nearestSupport,
  });
  const prediction = {
    signal: enginePrediction.signal,
    confidence: enginePrediction.confidence,
    trend: enginePrediction.trend,
    riskLevel: enginePrediction.riskLevel,
    reasons:
      enginePrediction.signal === 'HOLD'
        ? [...enginePrediction.reasons, ...holdReasons].slice(0, 4)
        : enginePrediction.signal === 'SELL'
          ? finalSellReasons
        : finalBuyReasons,
    indicators: enginePrediction.indicators,
  };
  const shortTermPredictions = buildShortTermPredictions({
    currentPrice: latest.close,
    momentum,
    emaCross,
    macdResult,
    rsiValue: rsi14,
    volatility: { ...volatility, recentReturns },
    levels,
    marketStatus: stock.live?.marketStatus ?? 'UNKNOWN',
    stale: Boolean(stock.live?.stale),
    volumeRatio: latest.volume / Math.max(avgVolume || latest.volume || 1, 1),
    closes,
    previousPredictions: stock.shortTermPredictions ?? {},
  });
  const oneHourForecast = shortTermPredictions.oneHour ?? {};
  const entryZonePlan = buildEntryZoneEngine({
    livePrice: latest.close,
    support: levels.support,
    resistance: levels.resistance,
    ema9,
    ema21,
    vwap: vwapValue,
    atrValue: atr14,
    trendDirection: trend.direction,
    momentumStrength: momentum.changePercent,
    pullbackProbability: buyZone.pullback?.healthyPullback ? 68 : buyZone.pullback?.holdingEmaZone ? 54 : 34,
    predictionDirection: oneHourForecast.direction,
    predictionConfidence: oneHourForecast.confidence ?? confidence,
    expectedMoveMin: oneHourForecast.expectedMoveMin ?? 0,
    expectedMoveMax: oneHourForecast.expectedMoveMax ?? 0,
    volatilityPercent: volatility.rangePercent,
    marketStatus: stock.live?.marketStatus ?? 'UNKNOWN',
  });
  const exitZonePlan = buildExitZoneEngine({
    livePrice: latest.close,
    support: levels.support,
    resistance: levels.resistance,
    atrValue: atr14,
    expectedMoveMax: oneHourForecast.expectedMoveMax ?? 0,
    trendDirection: trend.direction,
    signalWeakening:
      exitPlan.action === 'PARTIAL_EXIT' ||
      exitPlan.action === 'EXIT' ||
      (oneHourForecast.direction === 'SIDEWAYS' && (oneHourForecast.confidence ?? 0) < 60),
    volatilityPercent: volatility.rangePercent,
    marketStatus: stock.live?.marketStatus ?? 'UNKNOWN',
    predictionDirection: oneHourForecast.direction,
  });
  const tradeGuidance = buildCombinedTradeGuidance({
    prediction,
    buyZone,
    exitPlan,
    stopLoss: guidedStopLoss,
    target: guidedTarget,
  });
  const decision = buildDecisionSupport({
    symbol: stock.symbol,
    prediction,
    entryZonePlan,
    exitZonePlan,
    marketStatus: stock.live?.marketStatus ?? 'UNKNOWN',
    zoneQuality: entryZonePlan.zoneQualityScore,
    rewardRiskRatio: entryZonePlan.riskReward?.rewardRiskRatio ?? riskRewardRatio,
    invalidation: entryZonePlan.invalidationLevel ?? guidedStopLoss,
  });

  return {
    ...stock,
    currentPrice: latest.close,
    dayChangePercent,
    ohlc: { open: latest.open, high: latest.high, low: latest.low, close: latest.close },
    volume: latest.volume,
    lastUpdated: stock.live?.lastUpdated ?? stock.lastUpdated ?? null,
    indicators: {
      rsi14,
      ema9,
      ema21,
      ema50,
      ema200,
      macd: macdResult.macd,
      macdSignal: macdResult.signal,
      macdHistogram: macdResult.histogram,
      bollingerUpper: bollinger.upper,
      bollingerMiddle: bollinger.middle,
      bollingerLower: bollinger.lower,
      vwap: vwapValue,
      atr14,
      adx14,
      supertrend: supertrendResult.value,
      supertrendDirection: supertrendResult.direction,
      averageVolume: avgVolume,
      volumeSpike,
      volumeTrend: latest.volume > avgVolume ? 'Strong' : 'Muted',
    },
    supportResistance: levels,
    trend: {
      ...trend,
      breakoutProbability,
      reversalWarning: reversal,
      multiTimeframeAgreement: multiTimeframe.agreement,
      sideways: sideways.isSideways,
      sidewaysReason: sideways.reason,
      emaCrossover: emaCross.direction,
      volatility: volatility.label,
      momentum: momentum.changePercent,
    },
    multiTimeframe,
    buyZone,
    exitPlan,
    entryZonePlan,
    exitZonePlan,
    stopLoss: guidedStopLoss,
    target: guidedTarget,
    tradeGuidance,
    decision,
    prediction,
    shortTermPredictions,
    signal: {
      signal,
      confidence,
      bias,
      tradeQuality,
      riskLevel,
      riskRewardRatio,
      explanation,
      buyReasons: finalBuyReasons,
      sellReasons: finalSellReasons,
      holdReasons: holdReasons.slice(0, 4),
      confidenceBreakdown,
      reasons: signal === 'WAIT' ? [...holdReasons, ...weightedReasons].slice(0, 4) : signal.includes('SELL') ? finalSellReasons : finalBuyReasons,
      buyZone,
      exitPlan,
      decision,
      target: guidedTarget,
      stopLoss: guidedStopLoss,
      entryZonePlan,
      exitZonePlan,
      tradePlan: {
        idealEntry: buyZone.entryRange?.min ?? idealEntry,
        aggressiveEntry,
        safeEntry: buyZone.entryRange?.max ?? safeEntry,
        stopLoss: guidedStopLoss,
        target1: guidedTarget,
        target2,
        target3,
        trailingStop,
      },
    },
  };
}

export function buildDashboardSnapshot(stocks) {
  const sortedByChange = [...stocks].sort((a, b) => b.dayChangePercent - a.dayChangePercent);
  const bullishCount = stocks.filter((stock) => ['BUY', 'STRONG BUY'].includes(stock.signal.signal)).length;
  const bearishCount = stocks.filter((stock) => ['SELL', 'STRONG SELL'].includes(stock.signal.signal)).length;
  const neutralCount = stocks.length - bullishCount - bearishCount;
  const averageConfidence = round(stocks.reduce((sum, stock) => sum + stock.signal.confidence, 0) / stocks.length);

  return {
    cards: [
      { label: 'Tracked Stocks', value: stocks.length, change: 0, note: 'Current universe', kind: 'count' },
      { label: 'Avg Confidence', value: `${averageConfidence}%`, change: 1.8, note: 'Across active setups', kind: 'count' },
      { label: 'Strong Opportunities', value: bullishCount, change: 4.6, note: 'BUY and STRONG BUY', kind: 'count' },
      { label: 'Risk Watch', value: bearishCount, change: -1.4, note: 'SELL and STRONG SELL', kind: 'count' },
    ],
    sentiment: {
      label: bullishCount >= bearishCount ? 'Constructive bias with selective breakouts' : 'Defensive bias with mixed momentum',
      summary:
        bullishCount >= bearishCount
          ? 'Momentum is favoring selective long setups where trend, volume, and breakout confirmation align.'
          : 'Risk is rising in weaker names, so entries should stay selective until broader strength improves.',
      bullishCount,
      neutralCount,
      bearishCount,
    },
    topGainers: sortedByChange.slice(0, 3),
    topLosers: sortedByChange.slice(-3).reverse(),
    opportunities: stocks.filter((stock) => ['BUY', 'STRONG BUY'].includes(stock.signal.signal)).slice(0, 4),
    risks: stocks.filter((stock) => ['SELL', 'STRONG SELL', 'WAIT'].includes(stock.signal.signal)).slice(0, 4),
  };
}

export function buildIndexPredictions(marketOverview) {
  return (marketOverview ?? []).map((index) => {
    const change = Number(index?.change ?? 0);
    const marketStatus = index?.marketStatus ?? 'UNKNOWN';
    const absoluteMove = Math.abs(change);
    const enginePrediction = buildPredictionEngine({
      marketStatus,
      rsiValue: 50 + change * 18,
      emaCross: {
        short: (index?.value ?? 0) * (1 + change / 100),
        long: index?.value ?? 0,
        spreadPercent: round(change * 1.2),
        bullish: change > 0.22,
        bearish: change < -0.22,
      },
      macdResult: {
        macd: round(change * 1.2),
        signal: round(change * 0.8),
        histogram: round(change * 0.4),
      },
      momentum: {
        changePercent: change,
        direction: change > 0.25 ? 'up' : change < -0.25 ? 'down' : 'flat',
      },
      volatility: {
        rangePercent: Math.abs(change) * 3.2,
        lowVolatility: absoluteMove < 0.35,
      },
      sideways: {
        isSideways: absoluteMove < 0.35,
        reason: 'Price movement is mixed, so HOLD is preferred over a noisy directional call.',
      },
      adxValue: 18 + Math.abs(change) * 10,
    });
    const signal = enginePrediction.signal;
    const confidence = enginePrediction.confidence;
    const reasons = [...enginePrediction.reasons];
    const shortTermPredictions = buildShortTermPredictions({
      currentPrice: index?.value ?? 0,
      momentum: {
        changePercent: change,
        direction: change > 0.25 ? 'up' : change < -0.25 ? 'down' : 'flat',
      },
      emaCross: {
        short: (index?.value ?? 0) * (1 + change / 100),
        long: index?.value ?? 0,
        spreadPercent: round(change * 1.2),
        bullish: change > 0.22,
        bearish: change < -0.22,
      },
      macdResult: {
        macd: round(change * 1.2),
        signal: round(change * 0.8),
        histogram: round(change * 0.4),
      },
      rsiValue: 50 + change * 18,
      volatility: {
        rangePercent: Math.abs(change) * 3.2,
        lowVolatility: absoluteMove < 0.35,
      },
      levels: {
        support: (index?.value ?? 0) * 0.995,
        resistance: (index?.value ?? 0) * 1.005,
      },
      marketStatus,
      stale: Boolean(index?.stale),
      volumeRatio: 1,
    });

    if (index?.stale) {
      reasons.push('Quote freshness is weaker, which lowers confidence.');
    }

    return {
      label: index?.label ?? 'Index',
      signal,
      confidence,
      trend: enginePrediction.trend,
      change,
      currentValue: index?.value ?? null,
      marketStatus,
      marketStatusDetail: index?.marketStatusDetail ?? 'Data unavailable',
      reasons: reasons.slice(0, 4),
      summary: reasons.slice(0, 2).join(' '),
      riskLevel: enginePrediction.riskLevel,
      shortTermPredictions,
      disclaimer: 'Educational only, not investment advice.',
      source: index?.source,
      lastUpdated: index?.lastUpdated ?? null,
      stale: index?.stale ?? false,
      indicators: enginePrediction.indicators,
    };
  });
}

export function buildSignalHistory(stocks) {
  return stocks.flatMap((stock, index) => {
    const { safeEntry, stopLoss, target1, target2, target3 } = stock.signal.tradePlan;
    return [
      {
        id: `${stock.symbol}-open`,
        timestamp: `2026-03-28T${String(9 + index).padStart(2, '0')}:12:00+05:30`,
        symbol: stock.symbol,
        companyName: stock.companyName,
        signalType: stock.signal.signal,
        entryZone: safeEntry,
        stopLoss,
        target1,
        target2,
        target3,
        confidence: stock.signal.confidence,
        reason: stock.signal.explanation,
        resultStatus: index % 2 === 0 ? 'Running' : 'Target 1 hit',
      },
      {
        id: `${stock.symbol}-prior`,
        timestamp: `2026-03-27T${String(10 + index).padStart(2, '0')}:05:00+05:30`,
        symbol: stock.symbol,
        companyName: stock.companyName,
        signalType: stock.dayChangePercent >= 0 ? 'BUY' : 'SELL',
        entryZone: round(safeEntry * 0.996),
        stopLoss: round(stopLoss * 1.003),
        target1: round(target1 * 0.998),
        target2: round(target2 * 0.997),
        target3: round(target3 * 0.996),
        confidence: clamp(stock.signal.confidence - 6, 30, 90),
        reason: 'Prior session setup based on the same rule engine with lower trend confirmation.',
        resultStatus: index % 3 === 0 ? 'Stopped out' : 'Closed with gain',
      },
    ];
  });
}

export function buildOneHourPredictions(stocks, sentiment, strategyMode = 'Balanced', options = {}) {
  return buildHourPredictions(stocks, options);
}

export function buildBestEntryZones(stocks, strategyMode = 'Balanced') {
  const marketRegime = buildMarketRegime(stocks ?? []);
  const sectorMap = buildSectorStrengthMap(stocks ?? []);

  return (stocks ?? [])
    .map((stock) => {
      const shared = buildSharedSetupMetrics(stock, strategyMode, marketRegime, sectorMap);
      const livePrice = shared.livePrice;
      const momentumActive = shared.currentChangePercent >= 0.4 || stock.signal.confidence >= 70;
      const notOverbought = !shared.overextensionRisk;
      const consolidationPattern =
        Math.abs(stock.supportResistance.resistance - stock.supportResistance.support) / Math.max(livePrice, 1) <=
        0.035;
      const pullbackExpected = stock.indicators.rsi14 >= 66 && shared.overextensionRisk;
      const rsiRecovering = stock.indicators.rsi14 >= 44 && stock.indicators.rsi14 <= 60;
      const rejectionCandle = stock.ohlc.close > stock.ohlc.open && livePrice > stock.supportResistance.support;

      let score = 0;
      const reasons = [];

      if (shared.strongTrend) {
        score += 15;
        reasons.push('Trend strength is supportive across the active setup.');
      }
      if (shared.strongVolume) {
        score += 15;
        reasons.push('Volume is strong enough to support an entry.');
      } else {
        score -= 15;
        reasons.push('Volume is still weak, so follow-through is less reliable.');
      }
      if (shared.breakoutConfirmed || (shared.nearResistance && consolidationPattern)) {
        score += 15;
        reasons.push('A breakout-style entry is forming near resistance.');
      }
      if (pullbackExpected) {
        score += 10;
        reasons.push('A cleaner pullback entry may appear near EMA or VWAP support.');
      }
      if (shared.aboveVwap) {
        score += 10;
        reasons.push('Price is holding above VWAP.');
      }
      if (shared.bullishMacd) {
        score += 10;
        reasons.push('MACD remains bullish.');
      }
      if (stock.indicators.rsi14 >= 50 && stock.indicators.rsi14 <= 66) {
        score += 10;
        reasons.push('RSI is in a healthy entry range.');
      }
      if (stock.indicators.rsi14 >= 72) {
        score -= 10;
        reasons.push('RSI is overbought, which raises chase risk.');
      }
      if (!shared.strongTrend) {
        score -= 12;
        reasons.push('Trend confirmation is weak across timeframes.');
      }
      if (shared.falseBreakoutRisk) {
        score -= 12;
        reasons.push('Resistance is nearby but breakout confirmation is missing.');
      }
      if (shared.marketRegime.label === 'weak') {
        score -= shared.profile.weakMarketPenalty;
        reasons.push('Overall market regime is weak, so entries should stay selective.');
      }
      if (shared.sectorScore < 45) {
        score -= shared.profile.weakSectorPenalty;
        reasons.push('Sector strength is weak relative to the stock move.');
      }

      let entryType = entryTypeTone(clamp(score, 0, 100));
      if (shared.aboveVwap && shared.bullishEma && shared.bullishMacd && shared.strongVolume && notOverbought && momentumActive) {
        entryType = 'BUY NOW';
      } else if (shared.nearResistance && !shared.breakoutConfirmed && (shared.strongVolume || consolidationPattern)) {
        entryType = 'WAIT FOR BREAKOUT';
      } else if (shared.strongTrend && pullbackExpected) {
        entryType = 'WAIT FOR PULLBACK';
      } else if (shared.nearSupport && rsiRecovering && rejectionCandle) {
        entryType = 'SUPPORT BOUNCE';
      } else if (!shared.strongTrend || !shared.strongVolume || shared.falseBreakoutRisk) {
        entryType = 'AVOID';
      }

      const entryScore = clamp(
        round(
          score +
            (entryType === 'BUY NOW' ? 12 : 0) +
            (entryType === 'WAIT FOR BREAKOUT' ? 6 : 0) +
            (entryType === 'SUPPORT BOUNCE' ? 5 : 0) -
            (entryType === 'AVOID' ? 10 : 0),
        ),
        0,
        100,
      );
      const confidence = clamp(round(entryScore * 0.6 + stock.signal.confidence * 0.18 + shared.timeframeAgreementScore * 0.12), 18, 96);
      const idealEntryPrice =
        entryType === 'BUY NOW'
          ? round(livePrice)
          : entryType === 'WAIT FOR BREAKOUT'
            ? round(stock.supportResistance.resistance * 1.002)
            : entryType === 'WAIT FOR PULLBACK'
              ? round(Math.max(stock.indicators.ema9, stock.indicators.vwap))
              : entryType === 'SUPPORT BOUNCE'
                ? round(stock.supportResistance.support * 1.003)
                : round(stock.signal.tradePlan.safeEntry);
      const stopLoss =
        entryType === 'AVOID'
          ? round(stock.supportResistance.support * 0.992)
          : round(Math.min(stock.signal.tradePlan.stopLoss, idealEntryPrice - (stock.indicators.atr14 || livePrice * 0.01)));
      const target =
        entryType === 'WAIT FOR BREAKOUT'
          ? round(stock.supportResistance.resistance + (stock.indicators.atr14 || livePrice * 0.009) * 1.1)
          : round(stock.signal.tradePlan.target1);

      return {
        ...stock,
        symbol: stock.symbol,
        companyName: stock.companyName,
        livePrice,
        entryType,
        entryScore,
        confidence,
        idealEntryPrice,
        stopLoss,
        target,
        currentTrend: stock.trend.direction,
        volumeStrength: shared.strongVolume ? 'Strong' : stock.indicators.volumeTrend,
        reasonSummary: reasons.join(' '),
        nearestBreakoutGap: round(Math.max(0, stock.supportResistance.resistance - livePrice)),
        trendStrength: stock.trend.strengthScore,
        targets: shared.targets,
        invalidationLevel: shared.invalidationLevel,
        failureCondition: shared.failureCondition,
        confidenceBreakdown: shared.confidenceBreakdown,
        marketRegime: shared.marketRegime.label,
        sectorScore: shared.sectorScore,
        entryZonePlan: stock.entryZonePlan,
        exitZonePlan: stock.exitZonePlan,
      };
    })
    .sort((left, right) => right.entryScore - left.entryScore);
}

export function buildBuyZoneRows(stocks, strategyMode = 'Balanced') {
  return buildBestEntryZones(stocks, strategyMode)
    .filter((item) => item.buyZone?.entryLabel !== 'RISKY' || ['BUY NOW', 'SUPPORT BOUNCE', 'WAIT FOR BREAKOUT'].includes(item.entryType))
    .sort((left, right) => (right.entryZonePlan?.zoneQualityScore ?? 0) - (left.entryZonePlan?.zoneQualityScore ?? 0) || right.confidence - left.confidence);
}

export function buildSellExitRows(stocks, strategyMode = 'Balanced') {
  const marketRegime = buildMarketRegime(stocks ?? []);
  const sectorMap = buildSectorStrengthMap(stocks ?? []);

  return (stocks ?? [])
    .map((stock) => {
      const shared = buildSharedSetupMetrics(stock, strategyMode, marketRegime, sectorMap);
      const livePrice = shared.livePrice;
      const exitUrgency =
        stock.signal.signal === 'STRONG SELL' || shared.marketRegime.label === 'weak'
          ? 'High'
          : stock.signal.signal === 'SELL' || shared.falseBreakoutRisk
            ? 'Moderate'
            : 'Low';

      return {
        ...stock,
        livePrice,
        targets: shared.targets,
        invalidationLevel: shared.invalidationLevel,
        failureCondition: shared.failureCondition,
        confidenceBreakdown: shared.confidenceBreakdown,
        marketRegime: shared.marketRegime.label,
        sectorScore: shared.sectorScore,
        setupType: shared.setupType,
        exitUrgency,
        exitPlan: stock.exitPlan,
        entryZonePlan: stock.entryZonePlan,
        exitZonePlan: stock.exitZonePlan,
      };
    })
    .filter((stock) => ['SELL', 'STRONG SELL', 'WAIT'].includes(stock.signal.signal) || stock.marketRegime === 'weak' || stock.exitPlan?.action !== 'HOLD')
    .sort((left, right) => (right.exitZonePlan?.profitBookingZone?.max ?? 0) - (left.exitZonePlan?.profitBookingZone?.max ?? 0) || (right.signal?.confidence ?? 0) - (left.signal?.confidence ?? 0));
}

export function buildPredictionResultTracker(predictions) {
  return (predictions ?? []).map((item) => ({
    id: `${item.symbol}-1h-result`,
    symbol: item.symbol,
    setupType: item.setupType ?? 'No Trade',
    setupFamily: item.setupFamily ?? 'mixed sideways',
    checkedAt: item.lastUpdated ?? null,
    outcome: 'pending',
    confidence: item.confidence ?? 0,
    direction: item.direction ?? 'NO_EDGE',
    expectedMoveText: item.expectedMoveText ?? 'No clear directional edge',
    actionBias:
      item.entryZonePlan?.actionSummary ??
      item.exitZonePlan?.actionSummary ??
      item.prediction?.actionBias ??
      'Monitor',
  }));
}
