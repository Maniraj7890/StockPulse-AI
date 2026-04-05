const dates = [
  '2026-03-06',
  '2026-03-09',
  '2026-03-10',
  '2026-03-11',
  '2026-03-12',
  '2026-03-13',
  '2026-03-16',
  '2026-03-17',
  '2026-03-18',
  '2026-03-19',
  '2026-03-20',
  '2026-03-23',
  '2026-03-24',
  '2026-03-25',
  '2026-03-26',
  '2026-03-27',
];

function createCandles(symbol, companyName, seed) {
  return dates.map((time, index) => {
    const base = seed.base + seed.step * index + seed.wave[index % seed.wave.length];
    const close = Number(base.toFixed(2));
    const open = Number((close - seed.openBias[index % seed.openBias.length]).toFixed(2));
    const high = Number((Math.max(open, close) + seed.highOffset[index % seed.highOffset.length]).toFixed(2));
    const low = Number((Math.min(open, close) - seed.lowOffset[index % seed.lowOffset.length]).toFixed(2));
    const volume = seed.volumeBase + index * seed.volumeSlope + seed.volumeWave[index % seed.volumeWave.length];

    return {
      time,
      open,
      high,
      low,
      close,
      volume,
      symbol,
      companyName,
    };
  });
}

export const mockStocks = [
  {
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries',
    sector: 'Energy',
    candles: createCandles('RELIANCE', 'Reliance Industries', {
      base: 2870,
      step: 9.8,
      wave: [-8, -5, -3, 4, 7, 13, 16, 10],
      openBias: [9, -4, 6, -2],
      highOffset: [16, 20, 14, 18],
      lowOffset: [13, 11, 15, 10],
      volumeBase: 8400000,
      volumeSlope: 95000,
      volumeWave: [0, 350000, -180000, 420000],
    }),
  },
  {
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services',
    sector: 'IT',
    candles: createCandles('TCS', 'Tata Consultancy Services', {
      base: 4185,
      step: 6.4,
      wave: [-12, -9, -4, 5, 8, 6, 12, 16],
      openBias: [7, -5, 4, -3],
      highOffset: [15, 17, 14, 19],
      lowOffset: [11, 10, 12, 13],
      volumeBase: 2600000,
      volumeSlope: 28000,
      volumeWave: [0, 90000, -45000, 130000],
    }),
  },
  {
    symbol: 'INFY',
    companyName: 'Infosys',
    sector: 'IT',
    candles: createCandles('INFY', 'Infosys', {
      base: 1635,
      step: 4.5,
      wave: [-10, -5, -1, 3, 5, 9, 13, 8],
      openBias: [5, -2, 4, -1],
      highOffset: [9, 12, 10, 13],
      lowOffset: [8, 7, 9, 8],
      volumeBase: 6200000,
      volumeSlope: 65000,
      volumeWave: [0, 160000, -80000, 210000],
    }),
  },
  {
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank',
    sector: 'Financials',
    candles: createCandles('HDFCBANK', 'HDFC Bank', {
      base: 1610,
      step: 2.8,
      wave: [5, 2, -3, -6, -8, -10, -12, -7],
      openBias: [-4, 3, -2, 4],
      highOffset: [8, 7, 10, 9],
      lowOffset: [7, 9, 8, 10],
      volumeBase: 7800000,
      volumeSlope: 52000,
      volumeWave: [0, -120000, 90000, -160000],
    }),
  },
  {
    symbol: 'ICICIBANK',
    companyName: 'ICICI Bank',
    sector: 'Financials',
    candles: createCandles('ICICIBANK', 'ICICI Bank', {
      base: 1125,
      step: 5.1,
      wave: [-6, -2, 1, 3, 7, 11, 10, 13],
      openBias: [4, -3, 5, -2],
      highOffset: [7, 9, 8, 10],
      lowOffset: [6, 7, 6, 8],
      volumeBase: 9500000,
      volumeSlope: 84000,
      volumeWave: [0, 230000, -110000, 310000],
    }),
  },
  {
    symbol: 'LT',
    companyName: 'Larsen & Toubro',
    sector: 'Industrials',
    candles: createCandles('LT', 'Larsen & Toubro', {
      base: 3540,
      step: 8.2,
      wave: [-4, 3, 9, 13, 16, 14, 11, 6],
      openBias: [8, -6, 5, -3],
      highOffset: [13, 15, 12, 17],
      lowOffset: [12, 10, 11, 9],
      volumeBase: 3200000,
      volumeSlope: 48000,
      volumeWave: [0, 140000, -70000, 180000],
    }),
  },
  {
    symbol: 'SBIN',
    companyName: 'State Bank of India',
    sector: 'Financials',
    candles: createCandles('SBIN', 'State Bank of India', {
      base: 742,
      step: -1.9,
      wave: [7, 4, 1, -3, -5, -7, -9, -6],
      openBias: [-3, 2, -4, 3],
      highOffset: [6, 5, 7, 6],
      lowOffset: [5, 6, 5, 7],
      volumeBase: 12400000,
      volumeSlope: 43000,
      volumeWave: [0, -190000, 120000, -250000],
    }),
  },
];
