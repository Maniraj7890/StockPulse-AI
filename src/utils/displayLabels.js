export const UI_LABELS = {
  currentPrice: 'Current Price',
  lastTradedPrice: 'Last Traded Price',
  signalConfidence: 'Signal Confidence',
  suggestedAction: 'Suggested Action',
  expectedMove: 'Expected Move',
  nextSessionEstimate: 'Next Session Estimate',
  marketOpen: 'Market Open',
  preOpen: 'Pre-open',
  postMarket: 'Post-market',
  weekendClosure: 'Weekend Closure',
  exchangeHoliday: 'Exchange Holiday',
  staleFeed: 'Delayed Data',
  liveSource: 'Live Market Data',
};

export function getStatusLabel(status = 'UNKNOWN', detail = null) {
  if (detail) return detail;
  if (status === 'OPEN') return UI_LABELS.marketOpen;
  if (status === 'PREOPEN') return UI_LABELS.preOpen;
  if (status === 'POSTMARKET') return UI_LABELS.postMarket;
  if (status === 'WEEKEND_CLOSED') return UI_LABELS.weekendClosure;
  if (status === 'HOLIDAY') return UI_LABELS.exchangeHoliday;
  if (status === 'CLOSED') return 'Market Closed';
  return 'Status unavailable';
}

export function getPriceLabel(isClosedSession = false) {
  return isClosedSession ? UI_LABELS.lastTradedPrice : UI_LABELS.currentPrice;
}

export function getExpectedMoveLabel(isClosedSession = false) {
  return isClosedSession ? UI_LABELS.nextSessionEstimate : UI_LABELS.expectedMove;
}
