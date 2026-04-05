export const LIVE_SOURCE = 'Live market data';
export const FALLBACK_SOURCE = 'Delayed / Fallback';
export const DEFAULT_EXCHANGE = 'NSE';
export const SPARK_RANGE = '1d';
export const SPARK_INTERVAL = '1m';
export const LIVE_QUOTE_MAX_AGE_MS = 30000;

export const STOCK_SYMBOL_MAP = {
  RELIANCE: 'RELIANCE.NS',
  TCS: 'TCS.NS',
  INFY: 'INFY.NS',
  HDFCBANK: 'HDFCBANK.NS',
  ICICIBANK: 'ICICIBANK.NS',
  LT: 'LT.NS',
  SBIN: 'SBIN.NS',
};

export const MARKET_INDEX_DEFINITIONS = [
  { label: 'NIFTY', yahooSymbols: ['^NSEI'], exchange: 'NSE' },
  { label: 'SENSEX', yahooSymbols: ['^BSESN'], exchange: 'BSE' },
  { label: 'BANKNIFTY', yahooSymbols: ['^NSEBANK'], exchange: 'NSE' },
  { label: 'MIDCAP', yahooSymbols: ['NIFTY_MID_SELECT.NS'], exchange: 'NSE' },
  { label: 'FINNIFTY', yahooSymbols: ['NIFTY_FIN_SERVICE.NS'], exchange: 'NSE' },
];

export const REFERENCE_MARKET_OVERVIEW = [
  { label: 'NIFTY', value: 22418.4, change: 0.82, format: 'number', exchange: 'NSE' },
  { label: 'SENSEX', value: 73884.2, change: 0.71, format: 'number', exchange: 'BSE' },
  { label: 'BANKNIFTY', value: 48396.7, change: 0.55, format: 'number', exchange: 'NSE' },
  { label: 'MIDCAP', value: 12394.55, change: 0.63, format: 'number', exchange: 'NSE' },
  { label: 'FINNIFTY', value: 24041.55, change: 0.25, format: 'number', exchange: 'NSE' },
];
