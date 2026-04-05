import { buildExplanationPrompt } from '@/utils/ai/promptBuilder';
import { requestGeminiExplanation, getGeminiAvailability } from '@/utils/ai/geminiProvider';
import { buildFallbackExplanation } from '@/utils/ai/fallbackExplanationBuilder';

function getProviderName() {
  return (import.meta.env.VITE_AI_PROVIDER || 'gemini').toLowerCase();
}

export function getAIProviderStatus() {
  const provider = getProviderName();
  const aiEnabled = provider !== 'disabled' && provider !== 'local';

  if (provider === 'gemini') {
    const availability = getGeminiAvailability();
    return {
      provider: availability.provider,
      configuredProvider: provider,
      enabled: aiEnabled && availability.available,
      available: availability.available,
      fallbackReason: availability.reason,
      mode: availability.available ? 'provider' : 'fallback',
    };
  }

  if (provider === 'local') {
    return {
      provider: 'local',
      configuredProvider: provider,
      enabled: false,
      available: false,
      fallbackReason: 'local_fallback_mode',
      mode: 'fallback',
    };
  }

  return {
    provider,
    configuredProvider: provider,
    enabled: false,
    available: false,
    fallbackReason: 'provider_not_implemented',
    mode: 'fallback',
  };
}

export async function explainWithProvider(payload = {}) {
  const status = getAIProviderStatus();
  const prompt = buildExplanationPrompt(payload);

  if (status.provider === 'gemini' && status.available) {
    return requestGeminiExplanation({ prompt, payload });
  }

  return {
    ...buildFallbackExplanation(payload, status.fallbackReason ?? 'provider_not_implemented'),
    provider: status.provider,
    mode: 'fallback',
  };
}
