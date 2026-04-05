import { useEffect, useMemo, useState } from 'react';
import {
  buildAIPredictionKey,
  buildPredictionAssistantPayload,
  buildPredictionMarketSummaryPayload,
  fetchAIPredictionAssistant,
  fetchAIPredictionMarketSummary,
  getAIPredictionAvailabilityState,
  predictionAssistantFallback,
  predictionSummaryFallback,
} from '@/services/aiPredictionService';
import { useMarketStore } from '@/store/useMarketStore';

export function useAIPredictionAssistant(sourcePayload, options = {}) {
  const { enabled = true } = options;
  const aiEnabled = useMarketStore((state) => state.settings?.aiExplanationsEnabled !== 'disabled');
  const payload = useMemo(() => buildPredictionAssistantPayload(sourcePayload), [sourcePayload]);
  const key = useMemo(() => buildAIPredictionKey(payload), [payload]);
  const availability = useMemo(() => getAIPredictionAvailabilityState(), []);
  const [state, setState] = useState({
    loading: false,
    insight: predictionAssistantFallback(payload, 'idle'),
    error: null,
    provider: availability.provider,
    providerMode: availability.mode,
    fallbackReason: availability.fallbackReason ?? null,
    lastRequestedAt: null,
    cacheStatus: 'miss',
  });

  useEffect(() => {
    let active = true;

    if (!enabled || !payload?.symbol) {
      setState({
        loading: false,
        insight: predictionAssistantFallback(payload, enabled ? 'missing_payload' : 'disabled_by_view'),
        error: null,
        provider: availability.provider,
        providerMode: availability.mode,
        fallbackReason: enabled ? 'missing_payload' : 'disabled_by_view',
        lastRequestedAt: null,
        cacheStatus: 'miss',
      });
      return undefined;
    }

    if (!aiEnabled) {
      setState({
        loading: false,
        insight: predictionAssistantFallback(payload, 'disabled_by_user'),
        error: null,
        provider: availability.provider,
        providerMode: 'fallback',
        fallbackReason: 'disabled_by_user',
        lastRequestedAt: null,
        cacheStatus: 'miss',
      });
      return undefined;
    }

    setState((current) => ({
      ...current,
      loading: !current.insight,
      error: null,
      provider: availability.provider,
      providerMode: availability.mode,
      lastRequestedAt: new Date().toISOString(),
    }));

    fetchAIPredictionAssistant(payload)
      .then((insight) => {
        if (!active) return;
        setState({
          loading: false,
          insight,
          error: null,
          provider: insight?.provider ?? availability.provider,
          providerMode: insight?.mode ?? availability.mode,
          fallbackReason: insight?.fallbackReason ?? null,
          lastRequestedAt: insight?.generatedAt ?? new Date().toISOString(),
          cacheStatus: insight?.cacheStatus ?? 'miss',
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          loading: false,
          insight: predictionAssistantFallback(payload, 'hook_failure'),
          error: 'unavailable',
          provider: availability.provider,
          providerMode: 'fallback',
          fallbackReason: String(error?.message ?? 'hook_failure'),
          lastRequestedAt: new Date().toISOString(),
          cacheStatus: 'miss',
        });
      });

    return () => {
      active = false;
    };
  }, [aiEnabled, availability.mode, availability.provider, enabled, key, payload]);

  return {
    loading: state.loading,
    insight: state.insight ?? predictionAssistantFallback(payload, 'uninitialized'),
    error: state.error,
    provider: state.provider,
    providerMode: state.providerMode,
    aiEnabled,
    available: availability.available,
    fallbackReason: state.fallbackReason,
    lastRequestedAt: state.lastRequestedAt,
    cacheStatus: state.cacheStatus,
  };
}

export function useAIPredictionMarketSummary(sourcePayload, options = {}) {
  const { enabled = true } = options;
  const aiEnabled = useMarketStore((state) => state.settings?.aiExplanationsEnabled !== 'disabled');
  const payload = useMemo(() => buildPredictionMarketSummaryPayload(sourcePayload), [sourcePayload]);
  const key = useMemo(() => buildAIPredictionKey(payload), [payload]);
  const availability = useMemo(() => getAIPredictionAvailabilityState(), []);
  const [state, setState] = useState({
    loading: false,
    summary: predictionSummaryFallback(payload, 'idle'),
    error: null,
    provider: availability.provider,
    providerMode: availability.mode,
    fallbackReason: availability.fallbackReason ?? null,
    lastRequestedAt: null,
    cacheStatus: 'miss',
  });

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setState({
        loading: false,
        summary: predictionSummaryFallback(payload, 'disabled_by_view'),
        error: null,
        provider: availability.provider,
        providerMode: availability.mode,
        fallbackReason: 'disabled_by_view',
        lastRequestedAt: null,
        cacheStatus: 'miss',
      });
      return undefined;
    }

    if (!aiEnabled) {
      setState({
        loading: false,
        summary: predictionSummaryFallback(payload, 'disabled_by_user'),
        error: null,
        provider: availability.provider,
        providerMode: 'fallback',
        fallbackReason: 'disabled_by_user',
        lastRequestedAt: null,
        cacheStatus: 'miss',
      });
      return undefined;
    }

    setState((current) => ({
      ...current,
      loading: !current.summary,
      error: null,
      provider: availability.provider,
      providerMode: availability.mode,
      lastRequestedAt: new Date().toISOString(),
    }));

    fetchAIPredictionMarketSummary(payload)
      .then((summary) => {
        if (!active) return;
        setState({
          loading: false,
          summary,
          error: null,
          provider: summary?.provider ?? availability.provider,
          providerMode: summary?.mode ?? availability.mode,
          fallbackReason: summary?.fallbackReason ?? null,
          lastRequestedAt: summary?.generatedAt ?? new Date().toISOString(),
          cacheStatus: summary?.cacheStatus ?? 'miss',
        });
      })
      .catch((error) => {
        if (!active) return;
        setState({
          loading: false,
          summary: predictionSummaryFallback(payload, 'hook_failure'),
          error: 'unavailable',
          provider: availability.provider,
          providerMode: 'fallback',
          fallbackReason: String(error?.message ?? 'hook_failure'),
          lastRequestedAt: new Date().toISOString(),
          cacheStatus: 'miss',
        });
      });

    return () => {
      active = false;
    };
  }, [aiEnabled, availability.mode, availability.provider, enabled, key, payload]);

  return {
    loading: state.loading,
    summary: state.summary ?? predictionSummaryFallback(payload, 'uninitialized'),
    error: state.error,
    provider: state.provider,
    providerMode: state.providerMode,
    aiEnabled,
    available: availability.available,
    fallbackReason: state.fallbackReason,
    lastRequestedAt: state.lastRequestedAt,
    cacheStatus: state.cacheStatus,
  };
}
