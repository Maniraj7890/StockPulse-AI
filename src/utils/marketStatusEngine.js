import {
  MARKET_STATUS,
  deriveScheduledMarketStatus,
  enrichMarketQuoteState,
  getMarketStatusBadge,
  getMarketStatusExplanation,
  getQuotePresentation,
  getRecommendedPollingInterval,
} from '@/utils/marketSession';

export {
  MARKET_STATUS,
  deriveScheduledMarketStatus,
  enrichMarketQuoteState,
  getMarketStatusBadge,
  getMarketStatusExplanation,
  getQuotePresentation,
  getRecommendedPollingInterval,
};

export function buildMarketStatusView(quote = {}, options = {}) {
  const normalized = enrichMarketQuoteState(quote, options);
  const explanation = getMarketStatusExplanation(normalized, options);
  const presentation = getQuotePresentation(normalized);

  return {
    marketStatus: normalized.marketStatus ?? MARKET_STATUS.UNKNOWN,
    statusLabel: explanation.statusLabel,
    statusReason: explanation.reason,
    lastValidSession: explanation.lastValidSessionTimestamp,
    freshnessNote: explanation.freshnessNote,
    nextExpectedLiveSession: explanation.nextExpectedLiveSession,
    marketBannerText: explanation.bannerText,
    badge: getMarketStatusBadge(normalized.marketStatus),
    presentation,
  };
}
