const GEMINI_MODEL = 'gemini-1.5-flash';
const OPENAI_COMPATIBLE_TIMEOUT_MS = 12000;
const predictionCache = new Map();

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function extractJson(text = '') {
  const trimmed = String(text).trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function getGeminiApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

function getProviderName() {
  return (import.meta.env.VITE_AI_PROVIDER || 'gemini').toLowerCase();
}

function formatProviderLabel(provider) {
  if (!provider) return 'OpenAI-compatible';
  if (provider === 'groq') return 'Groq';
  if (provider === 'openrouter') return 'OpenRouter';
  if (provider === 'gemini') return 'Gemini';
  return provider
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getGeminiBaseUrl() {
  return (import.meta.env.VITE_AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
}

function getOpenAICompatibleApiKey() {
  return import.meta.env.VITE_AI_API_KEY || '';
}

function getOpenAICompatibleBaseUrl() {
  return (import.meta.env.VITE_AI_BASE_URL || '').replace(/\/$/, '');
}

function getOpenAICompatibleModel() {
  return import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini';
}

function sanitizeText(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function sanitizeActionSuggestion(value, fallback = 'WATCH') {
  const allowed = ['BUY', 'AVOID', 'WAIT', 'WATCH'];
  return allowed.includes(value) ? value : fallback;
}

function buildCandidateFallback(payload = {}, fallbackReason = 'fallback') {
  const aiActionSuggestion =
    payload?.decision?.finalDecision === 'BUY'
      ? 'BUY'
      : payload?.decision?.finalDecision === 'SELL'
        ? 'AVOID'
        : payload?.decision?.finalDecision === 'AVOID'
          ? 'AVOID'
          : payload?.decision?.finalDecision === 'WAIT'
            ? 'WAIT'
            : payload?.direction === 'UP'
              ? 'WATCH'
              : payload?.direction === 'DOWN'
                ? 'AVOID'
                : 'WAIT';

  const reasonList = Array.isArray(payload?.reasons) ? payload.reasons.filter(Boolean) : [];
  const leadingReason = reasonList[0] ?? 'The deterministic engine still needs cleaner confirmation.';
  const marketNote =
    payload?.marketStatus === 'CLOSED'
      ? 'This is a next-session estimate based on the last traded session.'
      : payload?.marketStatus === 'PREOPEN'
        ? 'This is a pre-open estimate and can shift after the session settles.'
        : 'This view comes from the current deterministic market snapshot.';

  return {
    aiSummary: `${payload?.symbol ?? 'This setup'} is currently ${payload?.direction === 'UP' ? 'tilted bullish' : payload?.direction === 'DOWN' ? 'tilted bearish' : 'mixed'}, but the rule engine remains the primary decision source.`,
    aiActionSuggestion,
    aiConfidenceAdjustment: 0,
    aiRiskNote:
      payload?.riskLevel
        ? `Risk remains ${String(payload.riskLevel).toLowerCase()}, so confirmation still matters. ${marketNote}`
        : marketNote,
    aiShortExplanation: leadingReason,
    provider: 'local',
    mode: 'fallback',
    fallbackReason,
    sourceLabel: 'Rule-engine AI fallback',
  };
}

function buildSummaryFallback(payload = {}, fallbackReason = 'fallback') {
  const bullishNames = (payload?.topBullish ?? []).map((item) => item.symbol).slice(0, 3);
  const bearishNames = (payload?.topBearish ?? []).map((item) => item.symbol).slice(0, 3);

  return {
    aiSummary:
      bullishNames.length || bearishNames.length
        ? `The deterministic engine is highlighting ${bullishNames.length ? 'bullish opportunities' : 'fewer bullish opportunities'} and ${bearishNames.length ? 'bearish pressure' : 'limited bearish pressure'} in the current 1-hour scan.`
        : 'The deterministic engine does not currently see many clean 1-hour opportunities.',
    topBullishSummary: bullishNames.length
      ? `Top bullish focus: ${bullishNames.join(', ')}.`
      : 'No strong bullish names stand out right now.',
    topBearishSummary: bearishNames.length
      ? `Top bearish focus: ${bearishNames.join(', ')}.`
      : 'No strong bearish names stand out right now.',
    riskWarning:
      payload?.marketStatus === 'CLOSED'
        ? 'Market is closed, so these are next-session estimates based on last session data.'
        : 'Use the deterministic engine as the primary source of truth and stay selective if signals are mixed.',
    aiShortExplanation:
      (Array.isArray(payload?.notes) ? payload.notes[0] : null) ??
      'The summary stays cautious when confidence or structure is mixed.',
    provider: 'local',
    mode: 'fallback',
    fallbackReason,
    sourceLabel: 'Rule-engine AI fallback',
  };
}

function normalizePredictionAssistantResponse(response = {}, payload = {}, fallbackReason = 'normalization') {
  const fallback = buildCandidateFallback(payload, fallbackReason);

  return {
    aiSummary: sanitizeText(response?.aiSummary, fallback.aiSummary),
    aiActionSuggestion: sanitizeActionSuggestion(response?.aiActionSuggestion, fallback.aiActionSuggestion),
    aiConfidenceAdjustment: clamp(
      Number.isFinite(Number(response?.aiConfidenceAdjustment))
        ? Math.round(Number(response.aiConfidenceAdjustment))
        : fallback.aiConfidenceAdjustment,
      -10,
      10,
    ),
    aiRiskNote: sanitizeText(response?.aiRiskNote, fallback.aiRiskNote),
    aiShortExplanation: sanitizeText(response?.aiShortExplanation, fallback.aiShortExplanation),
    provider: response?.provider ?? fallback.provider,
    mode: response?.mode ?? 'ai',
    fallbackReason: response?.fallbackReason ?? null,
    sourceLabel: response?.sourceLabel ?? fallback.sourceLabel,
  };
}

function normalizeMarketSummaryResponse(response = {}, payload = {}, fallbackReason = 'normalization') {
  const fallback = buildSummaryFallback(payload, fallbackReason);

  return {
    aiSummary: sanitizeText(response?.aiSummary, fallback.aiSummary),
    topBullishSummary: sanitizeText(response?.topBullishSummary, fallback.topBullishSummary),
    topBearishSummary: sanitizeText(response?.topBearishSummary, fallback.topBearishSummary),
    riskWarning: sanitizeText(response?.riskWarning, fallback.riskWarning),
    aiShortExplanation: sanitizeText(response?.aiShortExplanation, fallback.aiShortExplanation),
    provider: response?.provider ?? fallback.provider,
    mode: response?.mode ?? 'ai',
    fallbackReason: response?.fallbackReason ?? null,
    sourceLabel: response?.sourceLabel ?? fallback.sourceLabel,
  };
}

function buildPredictionAssistantPrompt(payload = {}) {
  return {
    system:
      'You are assisting a rule-based stock analyzer. The rule engine already decided the setup. You must only explain, gently refine confidence by at most +/-10, and suggest a cautious action label from BUY, AVOID, WAIT, or WATCH. Never promise profit, never invent indicators or price targets, and never contradict the provided market status.',
    user: `Return strict JSON only with this shape:
{"aiSummary":"","aiActionSuggestion":"WATCH","aiConfidenceAdjustment":0,"aiRiskNote":"","aiShortExplanation":""}

Rules:
- Use only the provided fields.
- Keep the tone calm, realistic, and beginner-friendly.
- If confidence is weak or the setup is mixed, prefer WAIT or WATCH.
- If marketStatus is CLOSED or PREOPEN, mention next-session uncertainty.
- aiConfidenceAdjustment must be an integer between -10 and 10.
- Do not invent prices, targets, indicators, or guarantees.

Input:
${JSON.stringify(payload)}`,
  };
}

function buildMarketSummaryPrompt(payload = {}) {
  return {
    system:
      'You summarize a rule-based 1-hour market scan. You do not create signals. You explain the current scan in short, calm language using only the supplied fields.',
    user: `Return strict JSON only with this shape:
{"aiSummary":"","topBullishSummary":"","topBearishSummary":"","riskWarning":"","aiShortExplanation":""}

Rules:
- Use only the provided fields.
- Keep the summary compact and practical.
- If the market is closed, say the scan is a next-session estimate.
- If signals are weak or sparse, say so clearly.
- Do not invent symbols, prices, or certainty.

Input:
${JSON.stringify(payload)}`,
  };
}

async function requestGeminiJson({ prompt, payload, normalize, fallbackReason }) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('missing_api_key');
  }

  const url = `${getGeminiBaseUrl()}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${prompt.system}\n\n${prompt.user}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 260,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`gemini_http_${response.status}:${text}`);
  }

  const json = await response.json();
  const text =
    json?.candidates?.[0]?.content?.parts?.map((part) => part?.text ?? '').join('\n') ??
    '';
  const parsed = JSON.parse(extractJson(text) || '{}');

  return normalize(
    {
      ...parsed,
      provider: 'gemini',
      mode: 'ai',
      sourceLabel: 'Gemini AI layer',
    },
    payload,
    fallbackReason,
  );
}

async function requestOpenAICompatibleJson({ prompt, payload, normalize, fallbackReason }) {
  const providerName = getProviderName();
  const apiKey = getOpenAICompatibleApiKey();
  const baseUrl = getOpenAICompatibleBaseUrl();
  const model = getOpenAICompatibleModel();

  if (!apiKey) {
    throw new Error('missing_api_key');
  }

  if (!baseUrl) {
    throw new Error('missing_base_url');
  }

  if (!model) {
    throw new Error('missing_model');
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort('timeout'), OPENAI_COMPATIBLE_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content: prompt.system,
          },
          {
            role: 'user',
            content: prompt.user,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`openai_compatible_http_${response.status}:${text}`);
    }

    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(extractJson(text) || '{}');

    return normalize(
      {
        ...parsed,
        provider: providerName,
        mode: 'ai',
        sourceLabel: `${formatProviderLabel(providerName)} AI layer`,
      },
      payload,
      fallbackReason,
    );
  } catch (error) {
    if (error?.name === 'AbortError' || String(error).includes('timeout')) {
      throw new Error('request_timeout');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function buildPredictionAssistantPayload(input = {}) {
  return {
    symbol: input?.symbol ?? 'Unknown',
    companyName: input?.companyName ?? 'Unknown company',
    currentPrice: Number.isFinite(input?.currentPrice) ? input.currentPrice : 0,
    trend: input?.trend ?? 'sideways',
    confidence: Number.isFinite(input?.confidence) ? input.confidence : 0,
    support: Number.isFinite(input?.support) ? input.support : null,
    resistance: Number.isFinite(input?.resistance) ? input.resistance : null,
    invalidation: Number.isFinite(input?.invalidation) ? input.invalidation : null,
    opportunityScore: Number.isFinite(input?.opportunityScore) ? input.opportunityScore : 0,
    modelHitRate: Number.isFinite(input?.modelHitRate) ? input.modelHitRate : 0,
    setupType: input?.setupType ?? 'No Trade',
    setupAge: input?.setupAge ?? 'Unknown',
    riskLevel: input?.riskLevel ?? 'medium',
    expectedMoveText: input?.expectedMoveText ?? 'Limited move range',
    reasons: Array.isArray(input?.reasons) ? input.reasons.slice(0, 5) : [],
    marketStatus: input?.marketStatus ?? input?.live?.marketStatus ?? 'UNKNOWN',
    direction: input?.direction ?? 'NONE',
    quality: input?.quality ?? input?.horizonForecast?.quality ?? null,
    actionBias: input?.actionBias ?? input?.decision?.finalDecision ?? 'WAIT',
    decision: {
      finalDecision: input?.decision?.finalDecision ?? 'WAIT',
      decisionStrength: input?.decision?.decisionStrength ?? 'WEAK',
      decisionReasonShort: input?.decision?.decisionReasonShort ?? '',
    },
    lastUpdated: input?.live?.lastUpdated ?? input?.lastUpdated ?? null,
  };
}

export function buildPredictionMarketSummaryPayload(input = {}) {
  return {
    marketStatus: input?.marketStatus ?? 'UNKNOWN',
    visibleTier: input?.visibleTier ?? 'STRONG',
    topBullish: Array.isArray(input?.topBullish)
      ? input.topBullish.slice(0, 3).map((item) => ({
          symbol: item?.symbol ?? 'Unknown',
          confidence: item?.confidence ?? 0,
          actionBias: item?.actionBias ?? item?.decision?.finalDecision ?? 'WAIT',
          expectedMoveText: item?.expectedMoveText ?? 'Limited move range',
          setupType: item?.setupType ?? 'No Trade',
        }))
      : [],
    topBearish: Array.isArray(input?.topBearish)
      ? input.topBearish.slice(0, 3).map((item) => ({
          symbol: item?.symbol ?? 'Unknown',
          confidence: item?.confidence ?? 0,
          actionBias: item?.actionBias ?? item?.decision?.finalDecision ?? 'WAIT',
          expectedMoveText: item?.expectedMoveText ?? 'Limited move range',
          setupType: item?.setupType ?? 'No Trade',
        }))
      : [],
    notes: Array.isArray(input?.notes) ? input.notes.slice(0, 3) : [],
    lastUpdated: input?.lastUpdated ?? null,
  };
}

export function buildAIPredictionKey(payload) {
  return stableStringify(payload ?? {});
}

export function getAIPredictionAvailabilityState() {
  const provider = getProviderName();

  if (provider === 'gemini') {
    const available = Boolean(getGeminiApiKey());
    return {
      provider: 'gemini',
      configuredProvider: provider,
      enabled: available,
      available,
      fallbackReason: available ? null : 'missing_api_key',
      mode: available ? 'provider' : 'fallback',
    };
  }

  if (provider === 'disabled' || provider === 'local') {
    return {
      provider: provider === 'disabled' ? 'disabled' : 'local',
      configuredProvider: provider,
      enabled: false,
      available: false,
      fallbackReason: provider === 'disabled' ? 'disabled_by_config' : 'local_fallback_mode',
      mode: 'fallback',
    };
  }

  const available = Boolean(getOpenAICompatibleApiKey() && getOpenAICompatibleBaseUrl() && getOpenAICompatibleModel());
  return {
    provider,
    configuredProvider: provider,
    enabled: available,
    available,
    fallbackReason: available
      ? null
      : !getOpenAICompatibleApiKey()
        ? 'missing_api_key'
        : !getOpenAICompatibleBaseUrl()
          ? 'missing_base_url'
          : 'missing_model',
    mode: available ? 'provider' : 'fallback',
  };
}

export function predictionAssistantFallback(payload = {}, reason = 'fallback') {
  return buildCandidateFallback(payload, reason);
}

export function predictionSummaryFallback(payload = {}, reason = 'fallback') {
  return buildSummaryFallback(payload, reason);
}

export async function fetchAIPredictionAssistant(payload, options = {}) {
  const key = `candidate:${buildAIPredictionKey(payload)}`;
  const status = getAIPredictionAvailabilityState();
  const useCache = options.useCache !== false;

  if (useCache && predictionCache.has(key)) {
    if (import.meta.env.DEV) {
      console.debug('[ai-prediction] cache hit', {
        symbol: payload?.symbol ?? 'unknown',
        provider: status.provider,
      });
    }
    return {
      ...predictionCache.get(key),
      cacheStatus: 'hit',
    };
  }

  if (!status.enabled) {
    if (import.meta.env.DEV) {
      console.debug('[ai-prediction] skipped request', {
        symbol: payload?.symbol ?? 'unknown',
        provider: status.provider,
        reason: status.fallbackReason ?? 'disabled',
      });
    }
    const fallback = {
      ...predictionAssistantFallback(payload, status.fallbackReason ?? 'disabled'),
      provider: status.provider,
      mode: 'fallback',
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    predictionCache.set(key, fallback);
    return fallback;
  }

  try {
    if (import.meta.env.DEV) {
      console.debug('[ai-prediction] request start', {
        symbol: payload?.symbol ?? 'unknown',
        provider: status.provider,
      });
    }
    if (status.provider === 'gemini') {
      const result = await requestGeminiJson({
        prompt: buildPredictionAssistantPrompt(payload),
        payload,
        normalize: normalizePredictionAssistantResponse,
        fallbackReason: 'gemini_parse',
      });
      const normalized = {
        ...result,
        cacheStatus: 'miss',
        generatedAt: new Date().toISOString(),
      };
      predictionCache.set(key, normalized);
      if (import.meta.env.DEV) {
        console.debug('[ai-prediction] response received', {
          symbol: payload?.symbol ?? 'unknown',
          provider: status.provider,
          cacheStatus: normalized.cacheStatus,
        });
      }
      return normalized;
    }

    const result = await requestOpenAICompatibleJson({
      prompt: buildPredictionAssistantPrompt(payload),
      payload,
      normalize: normalizePredictionAssistantResponse,
      fallbackReason: 'openai_compatible_parse',
    });
    const normalized = {
      ...result,
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    predictionCache.set(key, normalized);
    if (import.meta.env.DEV) {
      console.debug('[ai-prediction] response received', {
        symbol: payload?.symbol ?? 'unknown',
        provider: status.provider,
        cacheStatus: normalized.cacheStatus,
      });
    }
    return normalized;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[ai-prediction] request failed', {
        symbol: payload?.symbol ?? 'unknown',
        provider: status.provider,
        error: String(error?.message ?? error),
      });
    }
    const fallback = {
      ...predictionAssistantFallback(payload, String(error?.message ?? 'provider_error').slice(0, 120)),
      provider: status.provider,
      mode: 'fallback',
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    predictionCache.set(key, fallback);
    return fallback;
  }
}

export async function fetchAIPredictionMarketSummary(payload, options = {}) {
  const key = `summary:${buildAIPredictionKey(payload)}`;
  const status = getAIPredictionAvailabilityState();
  const useCache = options.useCache !== false;

  if (useCache && predictionCache.has(key)) {
    return {
      ...predictionCache.get(key),
      cacheStatus: 'hit',
    };
  }

  if (!status.enabled) {
    const fallback = {
      ...predictionSummaryFallback(payload, status.fallbackReason ?? 'disabled'),
      provider: status.provider,
      mode: 'fallback',
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    predictionCache.set(key, fallback);
    return fallback;
  }

  try {
    if (status.provider === 'gemini') {
      const result = await requestGeminiJson({
        prompt: buildMarketSummaryPrompt(payload),
        payload,
        normalize: normalizeMarketSummaryResponse,
        fallbackReason: 'gemini_parse',
      });
      const normalized = {
        ...result,
        cacheStatus: 'miss',
        generatedAt: new Date().toISOString(),
      };
      predictionCache.set(key, normalized);
      return normalized;
    }

    const result = await requestOpenAICompatibleJson({
      prompt: buildMarketSummaryPrompt(payload),
      payload,
      normalize: normalizeMarketSummaryResponse,
      fallbackReason: 'openai_compatible_parse',
    });
    const normalized = {
      ...result,
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    predictionCache.set(key, normalized);
    return normalized;
  } catch (error) {
    const fallback = {
      ...predictionSummaryFallback(payload, String(error?.message ?? 'provider_error').slice(0, 120)),
      provider: status.provider,
      mode: 'fallback',
      cacheStatus: 'miss',
      generatedAt: new Date().toISOString(),
    };
    predictionCache.set(key, fallback);
    return fallback;
  }
}
