import {
  adx,
  atr,
  averageVolume,
  basicVolatility,
  breakoutState,
  detectVolumeSpike,
  ema,
  emaCrossover,
  macd,
  priceMomentum,
  rsi,
  supportResistance,
  trendStrength,
  vwap,
} from '@/utils/indicators';

export {
  adx,
  atr,
  averageVolume,
  basicVolatility,
  breakoutState,
  detectVolumeSpike,
  ema,
  emaCrossover,
  macd,
  priceMomentum,
  rsi,
  supportResistance,
  trendStrength,
  vwap,
};

export function buildIndicatorSnapshot(candles = []) {
  const closes = (candles ?? []).map((candle) => candle.close);

  return {
    ema9: ema(closes, Math.min(9, closes.length)),
    ema21: ema(closes, Math.min(21, closes.length)),
    emaCross: emaCrossover(closes, 9, 21),
    rsi14: rsi(closes, 14),
    macdResult: macd(closes),
    momentum: priceMomentum(closes, 3),
    volatility: basicVolatility(candles, 10),
    supportResistance: supportResistance(candles, 8),
    vwapValue: vwap(candles),
    averageVolume: averageVolume(candles, 10),
    atr14: atr(candles, 14),
    adx14: adx(candles, 14),
    trend: trendStrength(candles),
    volumeSpike: detectVolumeSpike(candles),
    breakoutState: breakoutState(candles, supportResistance(candles, 8)),
  };
}
