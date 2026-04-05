import { useEffect, useMemo, useState } from 'react';
import {
  buildEngineExplanationPayload,
  buildExplanationKey,
  getAIAvailabilityState,
  explanationFallback,
  fetchAIExplanation,
} from '@/services/aiExplanationService';
import { useMarketStore } from '@/store/useMarketStore';

export function useAIExplanation(sourcePayload) {
  const aiEnabled = useMarketStore((state) => state.settings?.aiExplanationsEnabled !== 'disabled');
  const payload = useMemo(() => buildEngineExplanationPayload(sourcePayload), [sourcePayload]);
  const key = useMemo(() => buildExplanationKey(payload), [payload]);
  const availability = useMemo(() => getAIAvailabilityState(), []);
  const [state, setState] = useState({
    loading: false,
    explanation: null,
    error: null,
    provider: availability.provider,
    providerMode: availability.mode,
    fallbackReason: availability.fallbackReason ?? null,
    lastRequestedAt: null,
    cacheStatus: 'miss',
  });

  useEffect(() => {
    let active = true;

    if (!payload?.symbol) {
      if (import.meta.env.DEV) {
        console.debug('[ai-explanation] no payload symbol, using fallback');
      }
      setState({
        loading: false,
        explanation: explanationFallback(payload, 'missing_payload'),
        error: null,
        provider: availability.provider,
        providerMode: availability.mode,
        fallbackReason: 'missing_payload',
        lastRequestedAt: null,
        cacheStatus: 'miss',
      });
      return undefined;
    }

    if (!aiEnabled) {
      setState({
        loading: false,
        explanation: explanationFallback(payload, 'disabled_by_user'),
        error: null,
        provider: availability.provider,
        providerMode: availability.mode,
        fallbackReason: 'disabled_by_user',
        lastRequestedAt: null,
        cacheStatus: 'miss',
      });
      return undefined;
    }

    setState((current) => ({
      ...current,
      loading: !current.explanation,
      error: null,
      provider: availability.provider,
      providerMode: availability.mode,
      lastRequestedAt: new Date().toISOString(),
    }));

    fetchAIExplanation(payload)
      .then((explanation) => {
        if (!active) return;
        setState({
          loading: false,
          explanation,
          error: null,
          provider: explanation?.provider ?? availability.provider,
          providerMode: explanation?.mode ?? availability.mode,
          fallbackReason: explanation?.fallbackReason ?? null,
          lastRequestedAt: explanation?.generatedAt ?? new Date().toISOString(),
          cacheStatus: explanation?.cacheStatus ?? 'miss',
        });
      })
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.error('[ai-explanation] hook failure for', payload?.symbol ?? 'unknown', error);
        }
        if (!active) return;
        setState({
          loading: false,
          explanation: explanationFallback(payload, 'hook_failure'),
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
  }, [aiEnabled, availability.provider, key, payload]);

  return {
    loading: state.loading,
    explanation: state.explanation ?? explanationFallback(payload, 'uninitialized'),
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
