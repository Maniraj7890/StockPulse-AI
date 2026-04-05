import { explainWithProvider, getAIProviderStatus } from '@/utils/ai/explanationProvider';
import { buildFallbackExplanation } from '@/utils/ai/fallbackExplanationBuilder';

const explanationCache = new Map();

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function buildExplanationKey(payload) {
  return stableStringify(payload ?? {});
}

export function explanationFallback(payload = {}, reason = 'fallback') {
  return buildFallbackExplanation(payload, reason);
}

export function getAIAvailabilityState() {
  return getAIProviderStatus();
}

function buildEntryExitPayload(input = {}) {
  return {
    explanationType: input?.exitZonePlan || input?.exitPlan ? 'exit_note' : 'entry_note',
    symbol: input?.symbol ?? 'Unknown',
    marketStatus: input?.marketStatus ?? input?.live?.marketStatus ?? 'UNKNOWN',
    signal: input?.signal ?? input?.prediction?.signal ?? input?.signalType ?? 'HOLD',
    direction:
      input?.direction ??
      (input?.signal === 'BUY' ? 'UP' : input?.signal === 'SELL' ? 'DOWN' : 'SIDEWAYS'),
    confidence: input?.confidence ?? input?.signal?.confidence ?? 0,
    quality: input?.quality ?? input?.prediction?.quality ?? null,
    trendSummary: input?.trendSummary ?? input?.prediction?.trendSummary ?? null,
    momentumSummary: input?.momentumSummary ?? input?.prediction?.momentumSummary ?? null,
    structureSummary: input?.structureSummary ?? input?.prediction?.structureSummary ?? null,
    volatilitySummary: input?.volatilitySummary ?? input?.prediction?.volatilitySummary ?? null,
    sessionSummary: input?.sessionSummary ?? input?.prediction?.sessionSummary ?? null,
    support: input?.support ?? null,
    resistance: input?.resistance ?? null,
    invalidation: input?.invalidation ?? input?.stopLoss ?? null,
    actionBias:
      input?.entryZonePlan?.actionSummary ??
      input?.exitZonePlan?.actionSummary ??
      input?.actionBias ??
      'Wait for confirmation',
    entryZone: input?.entryZonePlan ?? input?.buyZone ?? null,
    exitZone: input?.exitZonePlan ?? input?.exitPlan ?? null,
    riskReward: input?.entryZonePlan?.riskReward ?? null,
    expectedMoveText: input?.shortTermPredictions?.oneHour?.expectedMoveText ?? null,
    expectedMoveMin: input?.shortTermPredictions?.oneHour?.expectedMoveMin ?? null,
    expectedMoveMax: input?.shortTermPredictions?.oneHour?.expectedMoveMax ?? null,
    reasons: input?.reasons ?? input?.signal?.reasons ?? [],
    whyThisPrediction: input?.whyThisPrediction ?? input?.prediction?.whyThisPrediction ?? [],
    lastUpdated: input?.live?.lastUpdated ?? input?.lastUpdated ?? null,
    stale: Boolean(input?.live?.stale),
  };
}

function buildAlertPayload(input = {}) {
  return {
    explanationType: 'alert_context',
    symbol: input?.symbol ?? 'Unknown',
    marketStatus: input?.marketStatus ?? 'UNKNOWN',
    signal: input?.signal ?? 'HOLD',
    confidence: input?.confidence ?? 0,
    trendSummary: input?.trendSummary ?? null,
    momentumSummary: input?.momentumSummary ?? null,
    volatilitySummary: input?.volatilitySummary ?? null,
    support: input?.support ?? null,
    resistance: input?.resistance ?? null,
    invalidation: input?.invalidation ?? input?.stopLoss ?? null,
    actionBias: input?.actionBias ?? 'Review the alert and confirm the setup.',
    alertType: input?.alertType ?? null,
    alertMessage: input?.alertMessage ?? null,
    reasons: input?.reasons ?? [],
    lastUpdated: input?.lastUpdated ?? null,
    stale: Boolean(input?.stale),
  };
}

function buildDashboardPayload(input = {}) {
  return {
    explanationType: 'dashboard_summary',
    symbol: input?.symbol ?? 'Market',
    marketStatus: input?.marketStatus ?? 'UNKNOWN',
    signal: input?.signal ?? input?.prediction?.signal ?? 'HOLD',
    direction:
      input?.direction ??
      (input?.trend === 'bullish' ? 'UP' : input?.trend === 'bearish' ? 'DOWN' : 'SIDEWAYS'),
    confidence: input?.confidence ?? 0,
    quality: input?.quality ?? null,
    marketTone: input?.marketTone ?? null,
    topBullish: input?.topBullish ?? [],
    topBearish: input?.topBearish ?? [],
    noTradeNames: input?.noTradeNames ?? [],
    trendSummary: input?.trendSummary ?? null,
    momentumSummary: input?.momentumSummary ?? null,
    sessionSummary: input?.sessionSummary ?? null,
    reasons: input?.reasons ?? [],
    whyThisPrediction: input?.whyThisPrediction ?? [],
    lastUpdated: input?.lastUpdated ?? null,
    stale: Boolean(input?.stale),
  };
}

export function buildEngineExplanationPayload(input) {
  const isOneHourCandidate =
    typeof input?.direction === 'string' ||
    typeof input?.setupType === 'string' ||
    typeof input?.opportunityScore === 'number' ||
    typeof input?.modelHitRate === 'number';
  const isDashboardSummary = input?.explanationType === 'dashboard_summary' || Array.isArray(input?.indices);
  const isEntryExit =
    input?.entryZonePlan ||
    input?.exitZonePlan ||
    input?.buyZone ||
    input?.exitPlan ||
    input?.stopLoss != null ||
    input?.target != null;
  const isAlertContext = input?.explanationType === 'alert_context' || input?.alertType || input?.alertMessage;
  const engine = input?.prediction ?? input?.enginePrediction ?? null;
  const confidence = engine?.confidence ?? input?.confidence ?? input?.signalConfidence ?? input?.signal?.confidence ?? 0;
  const momentumValue = engine?.indicators?.momentum ?? input?.momentum ?? input?.trend?.momentum ?? input?.currentChangePercent ?? input?.change ?? null;
  const trendValue = engine?.trend ?? input?.trend ?? (typeof momentumValue === 'number' ? (momentumValue > 0.2 ? 'up' : momentumValue < -0.2 ? 'down' : 'sideways') : 'sideways');
  const reasons =
    (Array.isArray(engine?.reasons) && engine.reasons.length ? engine.reasons : null) ??
    (Array.isArray(input?.reasons) && input.reasons.length ? input.reasons : []);

  if (isDashboardSummary) {
    return buildDashboardPayload({
      ...input,
      explanationType: 'dashboard_summary',
      signal: engine?.signal ?? input?.signal ?? 'HOLD',
      confidence,
      direction: input?.direction ?? (trendValue === 'up' ? 'UP' : trendValue === 'down' ? 'DOWN' : 'SIDEWAYS'),
      trendSummary: engine?.trendSummary ?? input?.trendSummary ?? null,
      momentumSummary: engine?.momentumSummary ?? input?.momentumSummary ?? null,
      sessionSummary: engine?.sessionSummary ?? input?.sessionSummary ?? null,
      reasons,
      whyThisPrediction: engine?.whyThisPrediction ?? input?.whyThisPrediction ?? [],
    });
  }

  if (isAlertContext) {
    return buildAlertPayload({
      ...input,
      signal: engine?.signal ?? input?.signal ?? 'HOLD',
      confidence,
      trendSummary: engine?.trendSummary ?? input?.trendSummary ?? null,
      momentumSummary: engine?.momentumSummary ?? input?.momentumSummary ?? null,
      volatilitySummary: engine?.volatilitySummary ?? input?.volatilitySummary ?? null,
      reasons,
    });
  }

  if (isOneHourCandidate) {
    return {
      explanationType: 'one_hour_candidate',
      symbol: input?.symbol ?? 'Unknown',
      marketStatus: input?.marketStatus ?? input?.live?.marketStatus ?? 'UNKNOWN',
      direction: input?.direction ?? 'NONE',
      confidence,
      quality: input?.quality ?? input?.horizonForecast?.quality ?? null,
      trend: trendValue,
      riskLevel: input?.riskLevel ?? engine?.riskLevel ?? 'medium',
      setupType: input?.setupType ?? 'No Trade',
      setupAge: input?.setupAge ?? 'Unknown',
      opportunityScore: input?.opportunityScore ?? 0,
      modelHitRate: input?.modelHitRate ?? 0,
      expectedMoveMin: input?.expectedMoveMin ?? 0,
      expectedMoveMax: input?.expectedMoveMax ?? 0,
      expectedMoveText: input?.expectedMoveText ?? null,
      support: input?.support ?? null,
      resistance: input?.resistance ?? null,
      invalidation: input?.invalidation ?? null,
      actionBias: input?.actionBias ?? input?.learningBadge ?? 'Wait for confirmation',
      trendSummary: input?.horizonForecast?.confluence?.trend?.summary ?? input?.trendSummary ?? null,
      momentumSummary: input?.horizonForecast?.confluence?.momentum?.summary ?? input?.momentumSummary ?? null,
      structureSummary: input?.horizonForecast?.confluence?.structure?.summary ?? input?.structureSummary ?? null,
      volatilitySummary: input?.horizonForecast?.confluence?.volatility?.summary ?? input?.volatilitySummary ?? null,
      sessionSummary: input?.horizonForecast?.confluence?.session?.summary ?? input?.sessionSummary ?? null,
      reasons,
      whyThisPrediction: input?.whyThisPrediction ?? reasons,
      lastUpdated: input?.live?.lastUpdated ?? input?.lastUpdated ?? null,
      stale: Boolean(input?.live?.stale),
    };
  }

  if (isEntryExit) {
    return buildEntryExitPayload({
      ...input,
      signal: engine?.signal ?? input?.signal ?? input?.signalType ?? 'HOLD',
      confidence,
      quality: engine?.quality ?? input?.quality ?? null,
      trendSummary: engine?.trendSummary ?? input?.trendSummary ?? null,
      momentumSummary: engine?.momentumSummary ?? input?.momentumSummary ?? null,
      structureSummary: engine?.structureSummary ?? input?.structureSummary ?? null,
      volatilitySummary: engine?.volatilitySummary ?? input?.volatilitySummary ?? null,
      sessionSummary: engine?.sessionSummary ?? input?.sessionSummary ?? null,
      reasons,
      whyThisPrediction: engine?.whyThisPrediction ?? input?.whyThisPrediction ?? [],
    });
  }

  return {
    explanationType: 'engine_summary',
    symbol: input?.symbol ?? input?.label ?? 'Market',
    marketStatus: input?.marketStatus ?? input?.live?.marketStatus ?? 'UNKNOWN',
    signal: engine?.signal ?? input?.signal ?? input?.signalType ?? 'HOLD',
    direction:
      input?.direction ??
      (engine?.direction ?? (trendValue === 'up' ? 'UP' : trendValue === 'down' ? 'DOWN' : 'SIDEWAYS')),
    confidence,
    quality: engine?.quality ?? input?.quality ?? null,
    bullishScore: engine?.bullishScore ?? input?.bullishScore ?? null,
    bearishScore: engine?.bearishScore ?? input?.bearishScore ?? null,
    sidewaysScore: engine?.sidewaysScore ?? input?.sidewaysScore ?? null,
    trendSummary: engine?.trendSummary ?? input?.trendSummary ?? null,
    momentumSummary: engine?.momentumSummary ?? input?.momentumSummary ?? null,
    structureSummary: engine?.structureSummary ?? input?.structureSummary ?? null,
    volatilitySummary: engine?.volatilitySummary ?? input?.volatilitySummary ?? null,
    sessionSummary: engine?.sessionSummary ?? input?.sessionSummary ?? null,
    support: engine?.support ?? input?.support ?? null,
    resistance: engine?.resistance ?? input?.resistance ?? null,
    invalidation: engine?.invalidation ?? input?.invalidation ?? null,
    actionBias: engine?.actionBias ?? input?.actionBias ?? 'Wait for confirmation',
    reasons,
    whyThisPrediction: engine?.whyThisPrediction ?? input?.whyThisPrediction ?? [],
    expectedMoveMin: input?.expectedMoveMin ?? engine?.expectedMovePercent?.min ?? null,
    expectedMoveMax: input?.expectedMoveMax ?? engine?.expectedMovePercent?.max ?? null,
    expectedMoveText: input?.expectedMoveText ?? engine?.expectedMovePercent?.text ?? null,
    lastUpdated: input?.live?.lastUpdated ?? input?.lastUpdated ?? null,
    stale: Boolean(input?.live?.stale),
  };
}

export async function fetchAIExplanation(payload, options = {}) {
  const key = buildExplanationKey(payload);
  const status = getAIAvailabilityState();
  const useCache = options.useCache !== false;

  if (useCache && explanationCache.has(key)) {
    const cached = {
      ...explanationCache.get(key),
      cacheStatus: 'hit',
    };
    if (import.meta.env.DEV) {
      console.debug('[ai-explanation] cache hit', {
        provider: cached?.provider ?? status.provider,
        symbol: payload?.symbol ?? 'unknown',
      });
    }
    return cached;
  }

  if (import.meta.env.DEV) {
    console.debug('[ai-explanation] request start', {
      provider: status.provider,
      enabled: status.enabled,
      symbol: payload?.symbol ?? 'unknown',
    });
  }

  if (!status.enabled) {
    const fallback = explanationFallback(payload, status.fallbackReason ?? 'disabled');
    const normalized = {
      ...fallback,
      provider: status.provider,
      mode: 'fallback',
      fallbackReason: status.fallbackReason ?? 'disabled',
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    explanationCache.set(key, normalized);
    return normalized;
  }

  try {
    const result = await explainWithProvider(payload);
    const normalized = {
      ...result,
      provider: result?.provider ?? status.provider,
      mode: result?.mode ?? 'ai',
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    explanationCache.set(key, normalized);
    return normalized;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[ai-explanation] provider failure', {
        provider: status.provider,
        symbol: payload?.symbol ?? 'unknown',
        error: String(error?.message ?? error),
      });
    }
    const reason = String(error?.message ?? 'provider_error').slice(0, 120);
    const fallback = {
      ...explanationFallback(payload, reason),
      provider: status.provider,
      mode: 'fallback',
      fallbackReason: reason,
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    explanationCache.set(key, fallback);
    return fallback;
  }
}
