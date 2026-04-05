import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

function yahooSparkProxy() {
  const handler = async (req, res) => {
    if (!req.url?.startsWith('/api/market/spark')) {
      return false;
    }

    try {
      const targetUrl = new URL(req.url, 'http://localhost');
      const upstreamUrl = new URL('https://query1.finance.yahoo.com/v7/finance/spark');
      upstreamUrl.search = targetUrl.search;

      const upstream = await fetch(upstreamUrl, {
        headers: {
          'user-agent': 'Mozilla/5.0 Codex StockPulse',
          accept: 'application/json',
        },
      });
      const body = await upstream.text();

      res.statusCode = upstream.status;
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json; charset=utf-8');
      res.end(body);
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Unable to fetch live market data.', details: error.message }));
    }

    return true;
  };

  return {
    name: 'yahoo-spark-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res);
        if (!handled) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res);
        if (!handled) next();
      });
    },
  };
}

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

function groqExplainProxy() {
  const cache = new Map();

  const mockExplanation = (payload, reason = 'fallback') => ({
    summary:
      payload?.explanationType === 'one_hour_candidate'
        ? payload?.direction === 'UP'
          ? `${payload?.symbol ?? 'This stock'} is showing a cleaner 1-hour bullish setup from the current rule engine.`
          : payload?.direction === 'DOWN'
            ? `${payload?.symbol ?? 'This stock'} is showing a cleaner 1-hour bearish setup from the current rule engine.`
            : `${payload?.symbol ?? 'This stock'} has mixed 1-hour signals, so no clear directional edge is preferred.`
        : 'Signal is based on the current rule engine output.',
    riskNote:
      payload?.marketStatus === 'CLOSED'
        ? 'Market is closed; using last session data.'
        : 'Use the deterministic engine output as the primary reference.',
    invalidationNote:
      payload?.invalidation != null
        ? `The setup weakens if price breaks past ${payload.invalidation}.`
        : 'Use the engine invalidation level before acting.',
    actionNote:
      payload?.direction === 'UP'
        ? 'Favor upside only while the current structure and momentum stay intact.'
        : payload?.direction === 'DOWN'
          ? 'Favor downside only while weakness stays intact.'
          : 'No-trade is preferred until indicators align.',
    actionBias:
      payload?.signal === 'BUY'
        ? 'Buy bias with confirmation checks.'
        : payload?.signal === 'SELL'
          ? 'Sell bias while weakness remains active.'
          : 'Wait for market confirmation.',
    reasons: [
      payload?.ema9 != null && payload?.ema21 != null
        ? payload.ema9 >= payload.ema21
          ? 'EMA trend supports the current bias'
          : 'EMA trend is mixed or weak'
        : 'EMA trend mixed',
      payload?.momentum != null
        ? payload.momentum >= 0
          ? 'Momentum is moderate'
          : 'Momentum is negative'
        : 'Momentum moderate',
      payload?.marketStatus === 'OPEN' ? 'Live session confirmation available' : 'No live session confirmation',
    ],
    mode: reason,
  });

  const handler = async (req, res) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/api/ai/explain')) {
      return false;
    }

    const apiKey = process.env.GROQ_API_KEY;
    console.log('[groq-proxy] explanation request received');

    if (!apiKey) {
      console.warn('[groq-proxy] GROQ_API_KEY is missing. Returning mock explanation.');
      let rawBody = '';
      for await (const chunk of req) {
        rawBody += chunk;
      }
      const body = rawBody ? JSON.parse(rawBody) : {};
      const payload = body?.payload ?? {};
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(mockExplanation(payload, 'missing_key')));
      return true;
    }

    try {
      let rawBody = '';
      for await (const chunk of req) {
        rawBody += chunk;
      }

      const body = rawBody ? JSON.parse(rawBody) : {};
      const payload = body?.payload ?? {};
      const cacheKey = stableStringify(payload);
      console.log('[groq-proxy] payload symbol:', payload?.symbol ?? 'unknown');

      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        console.log('[groq-proxy] cache hit for', payload?.symbol ?? 'unknown');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ...cached, cached: true }));
        return true;
      }

      const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
          temperature: 0.2,
          max_tokens: 220,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You explain an existing deterministic trading-engine result using only the provided structured market data. You never invent prices, never override the signal, keep a neutral tone, and return only valid JSON with keys summary, riskNote, invalidationNote, actionNote, actionBias, reasons.',
            },
            {
              role: 'user',
              content: `Explain this trading-engine result in short plain English using the latest structured market data. Use the provided index snapshot for NIFTY, SENSEX, BANKNIFTY, and MIDCAP when available. Mention why the current signal exists, one practical risk, one invalidation condition, and one action note. If the market is closed, say the explanation is based on last session data. Return JSON only in this shape:
{"summary":"","riskNote":"","invalidationNote":"","actionNote":"","actionBias":"","reasons":[]}

Input:
${JSON.stringify(payload)}`,
            },
          ],
        }),
      });

      const text = await upstream.text();
      if (!upstream.ok) {
        console.error('[groq-proxy] upstream request failed:', upstream.status, text);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(mockExplanation(payload, 'upstream_error')));
        return true;
      }

      const parsed = JSON.parse(text);
      const content = parsed?.choices?.[0]?.message?.content ?? '{}';
      const explanation = JSON.parse(content);
      const normalized = {
        summary: explanation?.summary ?? 'AI explanation temporarily unavailable.',
        riskNote: explanation?.riskNote ?? 'Risk note unavailable.',
        invalidationNote: explanation?.invalidationNote ?? 'Invalidation note unavailable.',
        actionNote: explanation?.actionNote ?? explanation?.actionBias ?? 'Wait for confirmation.',
        actionBias: explanation?.actionBias ?? 'Neutral',
        reasons: Array.isArray(explanation?.reasons) ? explanation.reasons.slice(0, 4) : [],
      };

      cache.set(cacheKey, normalized);
      console.log('[groq-proxy] explanation success for', payload?.symbol ?? 'unknown');
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(normalized));
    } catch (error) {
      console.error('[groq-proxy] proxy error:', error);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(mockExplanation({}, 'proxy_error')));
    }

    return true;
  };

  return {
    name: 'groq-explain-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res);
        if (!handled) next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res);
        if (!handled) next();
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), yahooSparkProxy(), groqExplainProxy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
