function round(value) {
  return Number(value.toFixed(2));
}

export function sma(values, period) {
  const slice = values.slice(-Math.max(1, period));
  return slice.length ? slice.reduce((sum, value) => sum + value, 0) / slice.length : 0;
}

export function ema(values, period) {
  if (!values.length) {
    return 0;
  }

  const multiplier = 2 / (period + 1);
  let current = values[0];

  for (let index = 1; index < values.length; index += 1) {
    current = values[index] * multiplier + current * (1 - multiplier);
  }

  return round(current);
}

export function emaCrossover(values, shortPeriod = 9, longPeriod = 21) {
  if (!values.length) {
    return {
      short: 0,
      long: 0,
      spreadPercent: 0,
      direction: 'flat',
      bullish: false,
      bearish: false,
    };
  }

  const short = ema(values, Math.min(shortPeriod, values.length));
  const long = ema(values, Math.min(longPeriod, values.length));
  const spreadPercent = round(((short - long) / Math.max(Math.abs(long), 1)) * 100);
  const bullish = short > long;
  const bearish = short < long;

  return {
    short,
    long,
    spreadPercent,
    direction: bullish ? 'bullish' : bearish ? 'bearish' : 'flat',
    bullish,
    bearish,
  };
}

export function priceMomentum(values, lookback = 3) {
  if (!values.length) {
    return {
      changePercent: 0,
      direction: 'flat',
      strength: 0,
    };
  }

  const latest = values.at(-1) ?? 0;
  const referenceIndex = Math.max(0, values.length - 1 - Math.max(1, lookback));
  const reference = values[referenceIndex] ?? latest ?? 1;
  const changePercent = round(((latest - reference) / Math.max(reference, 1)) * 100);

  return {
    changePercent,
    direction: changePercent > 0.35 ? 'up' : changePercent < -0.35 ? 'down' : 'flat',
    strength: Math.abs(changePercent),
  };
}

export function rsi(values, period = 14) {
  if (values.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let index = values.length - period; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (!losses) {
    return 100;
  }

  const rs = gains / losses;
  return round(100 - 100 / (1 + rs));
}

export function macd(values) {
  const macdSeries = values.map((_, index) => {
    const slice = values.slice(0, index + 1);
    return ema(slice, Math.min(12, slice.length)) - ema(slice, Math.min(26, slice.length));
  });

  const macdLine = macdSeries.at(-1) ?? 0;
  const signalLine = ema(macdSeries, Math.min(9, macdSeries.length));

  return {
    macd: round(macdLine),
    signal: round(signalLine),
    histogram: round(macdLine - signalLine),
  };
}

export function bollingerBands(values, period = 20, multiplier = 2) {
  const slice = values.slice(-Math.max(1, period));
  const mean = sma(slice, slice.length);
  const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / slice.length;
  const deviation = Math.sqrt(variance);

  return {
    middle: round(mean),
    upper: round(mean + deviation * multiplier),
    lower: round(mean - deviation * multiplier),
  };
}

export function vwap(candles) {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  candles.forEach((candle) => {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativePriceVolume += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;
  });

  return cumulativeVolume ? round(cumulativePriceVolume / cumulativeVolume) : 0;
}

export function atr(candles, period = 14) {
  const ranges = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    ranges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      ),
    );
  }

  return round(sma(ranges, Math.min(period, ranges.length)));
}

export function averageVolume(candles, period = 10) {
  return round(sma(candles.map((candle) => candle.volume), period));
}

export function detectVolumeSpike(candles, threshold = 1.35) {
  const lastVolume = candles.at(-1)?.volume ?? 0;
  const average = averageVolume(candles, 10);
  return average ? lastVolume >= average * threshold : false;
}

export function supportResistance(candles, lookback = 8) {
  const slice = candles.slice(-Math.max(2, lookback));
  return {
    support: round(Math.min(...slice.map((candle) => candle.low))),
    resistance: round(Math.max(...slice.map((candle) => candle.high))),
  };
}

export function breakoutState(candles, levels, tolerance = 0.0025) {
  const last = candles.at(-1);
  if (!last) {
    return { breakout: false, breakdown: false, nearResistance: false, nearSupport: false };
  }

  return {
    breakout: last.close > levels.resistance * (1 + tolerance),
    breakdown: last.close < levels.support * (1 - tolerance),
    nearResistance: last.close >= levels.resistance * (1 - tolerance) && last.close <= levels.resistance,
    nearSupport: last.close <= levels.support * (1 + tolerance) && last.close >= levels.support,
  };
}

export function adx(candles, period = 14) {
  if (candles.length < 3) {
    return 18;
  }

  const directionalMoves = [];
  const trueRanges = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    directionalMoves.push({
      plus: upMove > downMove && upMove > 0 ? upMove : 0,
      minus: downMove > upMove && downMove > 0 ? downMove : 0,
    });

    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      ),
    );
  }

  const sliceMoves = directionalMoves.slice(-period);
  const sliceRanges = trueRanges.slice(-period);
  const plusDm = sliceMoves.reduce((sum, move) => sum + move.plus, 0);
  const minusDm = sliceMoves.reduce((sum, move) => sum + move.minus, 0);
  const tr = sliceRanges.reduce((sum, value) => sum + value, 0) || 1;
  const plusDi = (plusDm / tr) * 100;
  const minusDi = (minusDm / tr) * 100;
  const dx = (Math.abs(plusDi - minusDi) / Math.max(1, plusDi + minusDi)) * 100;

  return round(dx + 18);
}

export function supertrend(candles, period = 10, multiplier = 3) {
  const atrValue = atr(candles, period);
  const last = candles.at(-1);

  if (!last) {
    return { value: 0, direction: 'Sideways' };
  }

  const hl2 = (last.high + last.low) / 2;
  const upperBand = hl2 + multiplier * atrValue;
  const lowerBand = hl2 - multiplier * atrValue;
  const direction = last.close >= hl2 ? 'Bullish' : 'Bearish';

  return {
    value: round(direction === 'Bullish' ? lowerBand : upperBand),
    direction,
  };
}

export function trendStrength(candles) {
  const closes = candles.map((candle) => candle.close);
  const lastClose = closes.at(-1) ?? 0;
  const ema9 = ema(closes, Math.min(9, closes.length));
  const ema21 = ema(closes, Math.min(21, closes.length));
  const ema50 = ema(closes, Math.min(50, closes.length));
  const ema200 = ema(closes, Math.min(200, closes.length));
  const bullishAlignment = lastClose > ema9 && ema9 > ema21 && ema21 > ema50;
  const bearishAlignment = lastClose < ema9 && ema9 < ema21 && ema21 < ema50;
  const direction = bullishAlignment ? 'Bullish' : bearishAlignment ? 'Bearish' : 'Sideways';

  let score = 50;
  if (bullishAlignment) score += 24;
  if (bearishAlignment) score -= 24;
  score += Math.min(18, Math.max(-18, ((lastClose - ema21) / Math.max(1, ema21)) * 300));
  score += lastClose > ema200 ? 8 : -8;

  return {
    direction,
    strengthScore: clamp(round(score), 0, 100),
  };
}

export function sidewaysDetection(candles, options = {}) {
  const {
    lookback = 10,
    rangeThresholdPercent = 2.4,
    emaCompressionThreshold = 0.45,
    adxThreshold = 20,
  } = options;

  const slice = (candles ?? []).slice(-Math.max(3, lookback));
  if (slice.length < 3) {
    return {
      isSideways: true,
      score: 70,
      rangePercent: 0,
      emaCompressionPercent: 0,
      reason: 'Not enough candles for reliable trend confirmation.',
    };
  }

  const closes = slice.map((candle) => candle.close);
  const highs = slice.map((candle) => candle.high);
  const lows = slice.map((candle) => candle.low);
  const latest = closes.at(-1) ?? 0;
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const rangePercent = round(((high - low) / Math.max(latest, 1)) * 100);
  const ema9 = ema(closes, Math.min(9, closes.length));
  const ema21 = ema(closes, Math.min(21, closes.length));
  const emaCompressionPercent = round((Math.abs(ema9 - ema21) / Math.max(latest, 1)) * 100);
  const adxValue = adx(slice, Math.min(lookback, 14));

  const compressionScore = emaCompressionPercent <= emaCompressionThreshold ? 38 : 0;
  const rangeScore = rangePercent <= rangeThresholdPercent ? 34 : 0;
  const adxScore = adxValue <= adxThreshold ? 28 : 0;
  const score = clamp(round(compressionScore + rangeScore + adxScore), 0, 100);

  let reason = 'Trend is directional enough for signal evaluation.';
  if (score >= 65) {
    reason = 'EMA compression, narrow range, and weak ADX point to a sideways market.';
  } else if (score >= 45) {
    reason = 'Price action is mixed, so breakout follow-through needs caution.';
  }

  return {
    isSideways: score >= 60,
    score,
    rangePercent,
    emaCompressionPercent,
    reason,
  };
}

export function basicVolatility(candles, lookback = 10) {
  const slice = (candles ?? []).slice(-Math.max(3, lookback));
  if (!slice.length) {
    return {
      rangePercent: 0,
      lowVolatility: true,
      label: 'Low volatility',
    };
  }

  const highs = slice.map((candle) => candle.high);
  const lows = slice.map((candle) => candle.low);
  const closes = slice.map((candle) => candle.close);
  const latest = closes.at(-1) ?? 0;
  const rangePercent = round(((Math.max(...highs) - Math.min(...lows)) / Math.max(latest, 1)) * 100);
  const lowVolatility = rangePercent <= 2.2;

  return {
    rangePercent,
    lowVolatility,
    label: lowVolatility ? 'Low volatility' : rangePercent >= 4.5 ? 'High volatility' : 'Normal volatility',
  };
}

export function reversalWarning(candles, rsiValue) {
  const latest = candles.at(-1);
  if (!latest) {
    return 'None';
  }

  const rejection = latest.high - latest.close > (latest.close - latest.low) * 1.25;
  const weakBull = latest.close < latest.open && rejection && rsiValue > 68;
  const weakBear = latest.close > latest.open && latest.close - latest.low > (latest.high - latest.close) * 1.25 && rsiValue < 35;

  if (weakBull) {
    return 'Bearish reversal risk';
  }
  if (weakBear) {
    return 'Bullish reversal risk';
  }
  return 'None';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
