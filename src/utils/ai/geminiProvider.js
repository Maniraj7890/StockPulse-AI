import { normalizeAIResponse } from '@/utils/ai/fallbackExplanationBuilder';

const GEMINI_MODEL = 'gemini-1.5-flash';

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function getGeminiAvailability() {
  return {
    available: Boolean(getApiKey()),
    provider: 'gemini',
    reason: getApiKey() ? null : 'missing_api_key',
  };
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

export async function requestGeminiExplanation({ prompt, payload }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('missing_api_key');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
        maxOutputTokens: 240,
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
  return normalizeAIResponse(
    {
      ...parsed,
      provider: 'gemini',
      mode: 'ai',
      sourceLabel: 'Gemini explanation',
    },
    payload,
    'gemini_parse',
  );
}
