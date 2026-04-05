function formatLevel(value) {
  return Number.isFinite(value) ? value.toFixed(2) : 'the engine level';
}

function formatMove(payload = {}) {
  if (Number.isFinite(payload.expectedMoveMin) && Number.isFinite(payload.expectedMoveMax)) {
    return `${Math.abs(payload.expectedMoveMin).toFixed(2)}% to ${Math.abs(payload.expectedMoveMax).toFixed(2)}%`;
  }
  return 'a limited near-term range';
}

function buildActionBias(payload = {}) {
  return payload.actionBias ?? payload.actionNote ?? 'Wait for confirmation.';
}

function buildRiskNote(payload = {}) {
  if (payload.marketStatus === 'CLOSED' || payload.marketStatus === 'POSTMARKET') {
    return 'Market is closed, so this is a next-session estimate based on the last traded session.';
  }
  if (payload.marketStatus === 'PREOPEN') {
    return 'The market is in pre-open, so conviction can change after the session settles.';
  }
  if (payload.stale) {
    return 'Data is delayed, so confidence should be treated more cautiously.';
  }
  if (payload.riskLevel) {
    return `Risk remains ${String(payload.riskLevel).toLowerCase()}, so confirmation still matters.`;
  }
  return 'Use the rule engine as the primary source of truth.';
}

function buildInvalidationNote(payload = {}) {
  if (Number.isFinite(payload.invalidation)) {
    return `The setup weakens if price moves through ${formatLevel(payload.invalidation)}.`;
  }
  return 'Use the rule-engine invalidation level before acting.';
}

function buildSummary(payload = {}) {
  const subject = payload.symbol ?? 'This setup';
  const direction =
    payload.direction === 'UP' || payload.signal === 'BUY'
      ? 'bullish'
      : payload.direction === 'DOWN' || payload.signal === 'SELL'
        ? 'bearish'
        : 'mixed';

  if (payload.explanationType === 'dashboard_summary') {
    return `${subject} market tone is ${direction === 'mixed' ? 'balanced' : direction} right now. ${payload.marketTone ?? 'The rule engine is highlighting the strongest themes while keeping weak setups defensive.'}`;
  }

  if (payload.explanationType === 'alert_context') {
    return `${subject} triggered an alert because the latest rule-engine state changed in a meaningful way. ${payload.alertMessage ?? 'This setup is worth a fresh review.'}`;
  }

  if (payload.explanationType === 'entry_note') {
    return `${subject} is being treated as an entry planning setup. The current rule-engine bias still favors ${buildActionBias(payload).toLowerCase()}.`;
  }

  if (payload.explanationType === 'exit_note') {
    return `${subject} is being treated as an exit-planning setup. The engine is focused on protecting gains and reducing risk if weakness grows.`;
  }

  if (payload.explanationType === 'one_hour_candidate') {
    return `${subject} has a ${direction} 1-hour bias with about ${payload.confidence ?? 0}% confidence. The view comes from the current mix of trend, momentum, and nearby levels.`;
  }

  return `${subject} has a ${direction} rule-engine bias with ${payload.confidence ?? 0}% confidence. The signal comes from the current confluence of trend, momentum, structure, and session context.`;
}

function buildReasons(payload = {}) {
  const reasons =
    (Array.isArray(payload.whyThisPrediction) && payload.whyThisPrediction.length
      ? payload.whyThisPrediction
      : null) ??
    (Array.isArray(payload.reasons) ? payload.reasons : []);

  if (reasons.length) {
    return reasons.slice(0, 4);
  }

  const derived = [];
  if (payload.trendSummary) derived.push(payload.trendSummary);
  if (payload.momentumSummary) derived.push(payload.momentumSummary);
  if (payload.structureSummary) derived.push(payload.structureSummary);
  if (payload.volatilitySummary) derived.push(payload.volatilitySummary);
  if (payload.sessionSummary) derived.push(payload.sessionSummary);
  return derived.filter(Boolean).slice(0, 4);
}

export function buildFallbackExplanation(payload = {}, fallbackReason = 'provider_unavailable') {
  return {
    summary: buildSummary(payload),
    riskNote: buildRiskNote(payload),
    invalidationNote: buildInvalidationNote(payload),
    actionNote:
      payload.explanationType === 'entry_note'
        ? `${buildActionBias(payload)} and stay patient if price is extended.`
        : payload.explanationType === 'exit_note'
          ? `${buildActionBias(payload)} while protecting the setup invalidation.`
          : payload.explanationType === 'alert_context'
            ? 'Use this alert as a review trigger, not as a standalone decision.'
            : `${buildActionBias(payload)} while expected move stays around ${formatMove(payload)}.`,
    actionBias: buildActionBias(payload),
    reasons: buildReasons(payload),
    mode: 'fallback',
    fallbackReason,
    sourceLabel: 'Rule-engine explanation fallback',
  };
}

export function normalizeAIResponse(response = {}, payload = {}, fallbackReason = 'normalization') {
  const fallback = buildFallbackExplanation(payload, fallbackReason);

  return {
    summary: response?.summary ?? fallback.summary,
    riskNote: response?.riskNote ?? fallback.riskNote,
    invalidationNote: response?.invalidationNote ?? fallback.invalidationNote,
    actionNote: response?.actionNote ?? fallback.actionNote,
    actionBias: response?.actionBias ?? fallback.actionBias,
    reasons:
      Array.isArray(response?.reasons) && response.reasons.length
        ? response.reasons.slice(0, 4)
        : fallback.reasons,
    mode: response?.mode ?? 'ai',
    provider: response?.provider ?? null,
    fallbackReason: response?.fallbackReason ?? null,
    sourceLabel: response?.sourceLabel ?? fallback.sourceLabel,
  };
}
