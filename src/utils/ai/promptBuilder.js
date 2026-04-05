function compactPayload(payload = {}) {
  return {
    explanationType: payload.explanationType,
    symbol: payload.symbol,
    marketStatus: payload.marketStatus,
    statusLabel: payload.statusLabel,
    signal: payload.signal,
    direction: payload.direction,
    confidence: payload.confidence,
    quality: payload.quality,
    bullishScore: payload.bullishScore,
    bearishScore: payload.bearishScore,
    sidewaysScore: payload.sidewaysScore,
    trendSummary: payload.trendSummary,
    momentumSummary: payload.momentumSummary,
    structureSummary: payload.structureSummary,
    volatilitySummary: payload.volatilitySummary,
    sessionSummary: payload.sessionSummary,
    support: payload.support,
    resistance: payload.resistance,
    invalidation: payload.invalidation,
    actionBias: payload.actionBias,
    expectedMoveMin: payload.expectedMoveMin,
    expectedMoveMax: payload.expectedMoveMax,
    expectedMoveText: payload.expectedMoveText,
    entryZone: payload.entryZone,
    exitZone: payload.exitZone,
    riskReward: payload.riskReward,
    reasons: payload.reasons,
    whyThisPrediction: payload.whyThisPrediction,
    lastUpdated: payload.lastUpdated,
    alertType: payload.alertType,
    alertMessage: payload.alertMessage,
    marketTone: payload.marketTone,
    topBullish: payload.topBullish,
    topBearish: payload.topBearish,
    noTradeNames: payload.noTradeNames,
  };
}

function commonSystemPrompt() {
  return 'You explain an existing rule-based market analyzer output for beginner users. You never change the signal, confidence, action bias, support, resistance, invalidation, or expected move. You never promise profit, never give financial advice, never invent indicators or prices, and always stay concise, cautious, and grounded in the provided fields only.';
}

function buildUserPrompt(taskDescription, compact) {
  return `${taskDescription}

Return strict JSON only with this shape:
{"summary":"","riskNote":"","invalidationNote":"","actionNote":"","actionBias":"","reasons":[]}

Rules:
- Keep each field short and practical.
- Reflect uncertainty when confidence is low.
- If market is closed or post-market, say it is a next-session estimate based on last session data.
- If data is stale or delayed, mention that confidence is reduced.
- Do not add new targets, prices, or indicators.
- Do not contradict the provided signal or action bias.

Input:
${JSON.stringify(compact)}`;
}

export function buildExplanationPrompt(payload = {}) {
  const compact = compactPayload(payload);
  const type = payload.explanationType ?? 'engine_summary';

  if (type === 'dashboard_summary') {
    return {
      system: commonSystemPrompt(),
      user: buildUserPrompt('Summarize the current market dashboard view in plain English. Focus on market tone, strongest bullish and bearish areas, no-trade context, and caution notes.', compact),
    };
  }

  if (type === 'alert_context') {
    return {
      system: commonSystemPrompt(),
      user: buildUserPrompt('Explain why this alert matters in a calm, practical way. Focus on why the alert fired and what should be reviewed next.', compact),
    };
  }

  if (type === 'entry_note') {
    return {
      system: commonSystemPrompt(),
      user: buildUserPrompt('Explain this entry-planning output in plain English. Focus on why entry is better on dip, wait, or breakout watch, and when chase risk is high.', compact),
    };
  }

  if (type === 'exit_note') {
    return {
      system: commonSystemPrompt(),
      user: buildUserPrompt('Explain this exit-planning output in plain English. Focus on why partial exit, wait, or early caution makes sense, and how invalidation changes the setup.', compact),
    };
  }

  return {
    system: commonSystemPrompt(),
    user: buildUserPrompt('Explain this analyzer output in plain English.', compact),
  };
}
