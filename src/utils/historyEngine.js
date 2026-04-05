import {
  buildSignalHistorySummary,
  calculateSetupAccuracy,
  calculateSignalAccuracy,
  evaluateOneHourSignals,
  recordOneHourSignals,
} from '@/utils/signalHistoryEngine';

export {
  buildSignalHistorySummary,
  calculateSetupAccuracy,
  calculateSignalAccuracy,
  evaluateOneHourSignals,
  recordOneHourSignals,
};

export function filterSignalHistory(history = [], filters = {}) {
  return (history ?? []).filter((item) => {
    if (filters.symbol && item.symbol !== filters.symbol) return false;
    if (filters.direction && item.direction !== filters.direction) return false;
    if (filters.status === 'pending' && item.evaluated) return false;
    if (filters.status === 'evaluated' && !item.evaluated) return false;
    if (filters.outcome && item.outcome !== filters.outcome) return false;
    if (filters.entryType && item.entryType !== filters.entryType) return false;
    if (filters.marketStatus && item.marketStatus !== filters.marketStatus) return false;
    if (filters.minConfidence && (item.confidence ?? 0) < filters.minConfidence) return false;
    return true;
  });
}

export function buildHistoryOverview(history = []) {
  const summary = buildSignalHistorySummary(history);
  return {
    ...summary,
    latestSignals: [...(history ?? [])].slice(0, 10),
  };
}
