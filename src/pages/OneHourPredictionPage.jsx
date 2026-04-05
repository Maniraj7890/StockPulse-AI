import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConfidenceBar from '@/components/ConfidenceBar';
import EmptyState from '@/components/EmptyState';
import LiveBadge from '@/components/LiveBadge';
import PredictionDirectionBadge from '@/components/PredictionDirectionBadge';
import SectionHeader from '@/components/SectionHeader';
import {
  buildAIPredictionKey,
  buildPredictionAssistantPayload,
  fetchAIPredictionAssistant,
} from '@/services/aiPredictionService';
import { useHourPrediction } from '@/hooks/useHourPrediction';
import { useMarketStore } from '@/store/useMarketStore';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { getQuotePresentation } from '@/utils/marketSession';

const AIPredictionInsightCard = lazy(() => import('@/components/AIPredictionInsightCard'));
const WhySignalPanel = lazy(() => import('@/components/WhySignalPanel'));

const DEFERRED_RENDER_DELAY_MS = 80;

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
      <p className="metric-label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function DeferredSectionFallback({ label }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-black/10 p-4 text-sm text-slate-400">{label}</div>
  );
}

function AIPredictionSummaryPanel({ loading, error, results, onLoad }) {
  return (
    <div className="panel p-5">
      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="metric-label">AI Summary Panel</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Optional AI view for top setups</h3>
          <p className="mt-2 text-sm text-slate-400 break-words">
            Loads compact AI notes only for the top 3 strongest candidates. The deterministic engine remains the primary signal source.
          </p>
        </div>
        <button onClick={onLoad} className="app-button w-full md:w-auto md:self-start" disabled={loading}>
          {loading ? 'Loading AI View...' : 'Load AI View'}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-black/10 p-4 text-sm text-slate-300">
          Loading AI view for the strongest candidates...
        </div>
      ) : null}
      {error && !loading ? (
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/8 p-3 text-xs text-amber-100">
          AI view unavailable right now. The rule-engine view below is still active.
        </div>
      ) : null}

      {results.length ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {results.map(({ candidate, insight, finalConfidence }) => (
            <div key={candidate.symbol} className="rounded-2xl border border-border/60 bg-panel-soft/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="metric-label">{candidate.symbol}</p>
                  <p className="mt-1 text-sm text-slate-400">{candidate.companyName}</p>
                </div>
                <span className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-200">
                  {insight.aiActionSuggestion}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{insight.aiShortExplanation}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-black/10 p-3">
                  <p className="metric-label">Adjusted Confidence</p>
                  <p className="mt-2 text-white">
                    {finalConfidence}%{' '}
                    <span className="text-xs text-slate-500">
                      ({insight.aiConfidenceAdjustment > 0 ? '+' : ''}
                      {insight.aiConfidenceAdjustment})
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-black/10 p-3">
                  <p className="metric-label">Expected Move</p>
                  <p className="mt-2 text-slate-300">{candidate.expectedMoveText}</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-border/60 bg-black/10 p-3">
                <p className="metric-label">AI Risk Note</p>
                <p className="mt-2 text-sm text-slate-300">{insight.aiRiskNote}</p>
              </div>
              <div className="mt-3 rounded-2xl border border-border/60 bg-black/10 p-3">
                <p className="metric-label">AI Summary</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{insight.aiSummary}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-black/10 p-4 text-sm text-slate-400">
            No AI candidate notes loaded yet. Use Load AI View to fetch compact summaries for the strongest names.
          </div>
        )
      )}
    </div>
  );
}

function StatPill({ label, value, tone = 'text-slate-200' }) {
  return (
    <div className="rounded-full border border-border/60 bg-black/10 px-3 py-1.5 text-xs">
      <span className="text-slate-500">{label}</span>{' '}
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

const HourPredictionRow = memo(function HourPredictionRow({ item, showDebug }) {
  const [showWhy, setShowWhy] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const quotePresentation = useMemo(
    () => getQuotePresentation(item.live ?? { marketStatus: item.marketStatus }),
    [item.live, item.marketStatus],
  );

  return (
    <div className="grid gap-5 px-5 py-5 xl:grid-cols-[1.15fr_0.9fr_1.05fr]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-display text-xl font-bold text-white">{item.symbol}</p>
          <PredictionDirectionBadge direction={item.direction === 'NONE' ? 'SIDEWAYS' : item.direction} />
          <LiveBadge status={item.live?.marketStatus ?? item.marketStatus} />
        </div>
        <p className="mt-2 text-sm text-slate-400">{item.companyName}</p>
        {quotePresentation.closedBadgeText ? (
          <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-amber-200">{quotePresentation.closedBadgeText}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <StatPill
            label="Tier"
            value={item.tier}
            tone={
              item.tier === 'STRONG'
                ? 'text-emerald-200'
                : item.tier === 'MODERATE'
                  ? 'text-sky-200'
                  : 'text-amber-200'
            }
          />
          <StatPill label="Setup" value={item.setupType} />
          <StatPill label="Age" value={item.setupAge} />
          <StatPill label="Score" value={`${item.opportunityScore.toFixed(1)}/10`} tone="text-emerald-200" />
          <StatPill label="Quality" value={`${item.setupCleanliness}`} tone="text-sky-200" />
          <StatPill label="Hit Rate" value={`${item.modelHitRate}%`} tone="text-sky-200" />
          <StatPill
            label="Learning"
            value={`${item.learningAdjustment > 0 ? '+' : ''}${item.learningAdjustment}`}
            tone={
              item.learningAdjustment > 0
                ? 'text-emerald-200'
                : item.learningAdjustment < 0
                  ? 'text-rose-200'
                  : 'text-slate-200'
            }
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
            <p className="metric-label">{quotePresentation.priceLabel}</p>
            <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(item.currentPrice)}</p>
            <p className="mt-1 text-xs text-slate-500">{quotePresentation.priceHelper}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
            <p className="metric-label">{item.horizonForecast?.expectedMoveLabel ?? 'Expected 1H Move'}</p>
            <p className="mt-2 text-lg font-semibold text-white">{item.expectedMoveText}</p>
            <p className="mt-1 text-xs text-slate-500">{item.basisLabel}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 text-sm text-slate-300">
        <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
          <p className="metric-label">Trend / Confidence</p>
          <p className="mt-2 text-white">
            {item.trend} / {item.confidence}%
          </p>
          <ConfidenceBar value={item.confidence} />
          <p className="mt-1 text-slate-400">Risk {item.riskLevel}</p>
          <p className="mt-1 text-slate-500">Setup {item.setupType}</p>
          <p className="mt-1 text-slate-500">{item.learningBadge}</p>
          {quotePresentation.isClosedSession ? <p className="mt-1 text-xs text-amber-200">Next session estimate</p> : null}
        </div>
        <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
          <p className="metric-label">Levels</p>
          <p className="mt-2">Support {formatCurrency(item.support)}</p>
          <p>Resistance {formatCurrency(item.resistance)}</p>
          <p>Invalidation {formatCurrency(item.invalidation)}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
          <p className="metric-label">Learning Note</p>
          <p className="mt-2 text-slate-300">{item.learningReason}</p>
        </div>
        {(showAdvanced || showDebug) && showDebug ? (
          <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
            <p className="metric-label">Debug Scores</p>
            <div className="mt-3 space-y-1 text-xs text-slate-300">
              <p>Trend {item.horizonForecast?.debug?.trendScore ?? 0}</p>
              <p>Momentum {item.horizonForecast?.debug?.momentumScore ?? 0}</p>
              <p>Volatility {item.horizonForecast?.debug?.volatilityScore ?? 0}</p>
              <p>Support/Resistance {item.horizonForecast?.debug?.supportResistanceScore ?? 0}</p>
              <p>Consistency {item.horizonForecast?.debug?.consistencyScore ?? 0}</p>
              <p>Data Quality {item.horizonForecast?.debug?.dataQualityScore ?? 0}</p>
              <p>Signal Score {item.horizonForecast?.debug?.finalSignalScore ?? 0}</p>
              <p>Confidence Base {item.horizonForecast?.debug?.confidenceBase ?? 0}</p>
              <p>Confidence Final {item.horizonForecast?.debug?.confidenceFinal ?? item.confidence}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <div className="rounded-2xl border border-border/60 bg-black/10 p-4">
          <p className="metric-label">Final Action</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-white">{item.decision?.finalDecision ?? 'WAIT'}</span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
              {item.decision?.decisionStrength ?? 'WEAK'}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            {item.decision?.decisionReasonShort ?? 'No clear edge — wait for better alignment.'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="metric-label">Entry Zone</p>
              <p className="mt-1 text-sm text-white">{item.decision?.actionClarity?.entryZone ?? 'Monitor'}</p>
            </div>
            <div>
              <p className="metric-label">Stop Loss</p>
              <p className="mt-1 text-sm text-white">{item.decision?.actionClarity?.stopLoss ?? 'Monitor'}</p>
            </div>
            <div>
              <p className="metric-label">Target Zone</p>
              <p className="mt-1 text-sm text-white">{item.decision?.actionClarity?.targetZone ?? 'Monitor'}</p>
            </div>
            <div>
              <p className="metric-label">Trade Quality</p>
              <p className="mt-1 text-sm text-white">{item.decision?.tradeQualityScore ?? 0}/100</p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-border/60 bg-black/10 p-4">
          <p className="metric-label">Why this prediction?</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {item.reasons.slice(0, 3).map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Last updated: {formatDateTime(item.live?.lastUpdated ?? item.lastUpdated)}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setShowWhy((value) => !value)} className="app-button">
            {showWhy ? 'Hide Why Panel' : 'Show Why Panel'}
          </button>
          <button onClick={() => setShowAI((value) => !value)} className="app-button">
            {showAI ? 'Hide AI Explanation' : 'Show AI Explanation'}
          </button>
          {showDebug ? (
            <button onClick={() => setShowAdvanced((value) => !value)} className="app-button">
              {showAdvanced ? 'Hide Debug Scores' : 'Show Debug Scores'}
            </button>
          ) : null}
        </div>

        {showWhy ? (
          <div className="mt-4">
            <Suspense fallback={<DeferredSectionFallback label="Loading why panel..." />}>
              <WhySignalPanel decision={item.decision} compact />
            </Suspense>
          </div>
        ) : null}

        {showAI ? (
          <Suspense fallback={<DeferredSectionFallback label="Loading AI explanation..." />}>
            <AIPredictionInsightCard
              className="mt-4"
              title="AI Explanation"
              payload={item}
            />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
});

function HourPredictionPanel({
  title,
  eyebrow,
  rows,
  emptyTitle,
  emptyDescription,
  showDebug = false,
  collapsible = false,
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  const visibleRows = useMemo(
    () => (showAll ? rows : rows.slice(0, 3)),
    [rows, showAll],
  );
  const isExpanded = expanded;
  const handleToggleExpanded = useCallback(() => {
    setExpanded((value) => !value);
  }, []);

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="metric-label">{eyebrow}</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">{title}</h3>
          </div>
          {collapsible ? (
            <button onClick={handleToggleExpanded} className="app-button">
              {isExpanded ? 'Hide Section' : 'Show Section'}
            </button>
          ) : null}
        </div>
      </div>

      {!isExpanded ? (
        <div className="p-5 text-sm text-slate-400">Section collapsed to keep the view lighter.</div>
      ) : rows.length ? (
        <>
          <div className="divide-y divide-border/60">
            {visibleRows.map((item) => (
              <HourPredictionRow key={item.symbol} item={item} showDebug={showDebug} />
            ))}
          </div>
          {rows.length > 3 ? (
            <div className="border-t border-border/60 px-5 py-4">
              <button onClick={() => setShowAll((value) => !value)} className="app-button">
                {showAll ? 'Show less' : `Show more (${rows.length - 3} more)`}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="p-5">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      )}
    </div>
  );
}

function OneHourPredictionPage() {
  const isDebugAvailable = import.meta.env.DEV;
  const [showDebug, setShowDebug] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [neutralRequested, setNeutralRequested] = useState(false);
  const [activeTier, setActiveTier] = useState('STRONG');
  const aiCacheRef = useRef(new Map());
  const [aiSummaryState, setAiSummaryState] = useState({
    loading: false,
    error: null,
    results: [],
  });
  const predictionData = useHourPrediction({
    includeDetails: contentReady,
    activeTier,
    includeNoClearEdge: contentReady && neutralRequested,
  });
  const {
    marketStatus,
    lastUpdated,
    total,
    averageConfidence,
    averageHitRate,
    hitRate,
    learningSummary,
    notes,
    tierCounts,
    noClearEdgeCount,
    visibleTier,
    increase,
    decrease,
    noClearEdge,
    normalizedPredictions,
  } = predictionData;
  const refreshPredictions = useMarketStore((state) => state.refreshOneHourPredictions);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setContentReady(true);
    }, DEFERRED_RENDER_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  const normalizedActiveTier = useMemo(() => {
    const candidate = activeTier || visibleTier || 'STRONG';
    if (candidate === 'STRONG' || candidate === 'MODERATE' || candidate === 'WEAK') {
      return candidate;
    }
    return visibleTier || 'STRONG';
  }, [activeTier, visibleTier]);
  const handleRefreshPredictions = useCallback(() => {
    refreshPredictions();
  }, [refreshPredictions]);
  const handleToggleDebug = useCallback(() => {
    setShowDebug((value) => !value);
  }, []);
  const safeIncrease = useMemo(() => increase.slice(0, 10), [increase]);
  const safeDecrease = useMemo(() => decrease.slice(0, 10), [decrease]);
  const safeNoClearEdge = useMemo(() => noClearEdge.slice(0, 10), [noClearEdge]);
  const aiTopCandidates = useMemo(() => {
    const directionalCandidates = [...safeIncrease, ...safeDecrease]
      .filter((item) => item?.symbol && Number.isFinite(item?.confidence))
      .sort(
        (left, right) =>
          (right.rankingScore ?? 0) - (left.rankingScore ?? 0) ||
          (right.confidence ?? 0) - (left.confidence ?? 0) ||
          (right.opportunityScore ?? 0) - (left.opportunityScore ?? 0),
      );

    if (directionalCandidates.length) {
      return directionalCandidates.slice(0, 3);
    }

    return (normalizedPredictions ?? [])
      .filter((item) => item?.symbol && (item?.direction === 'NONE' || item?.tier === 'NO_EDGE'))
      .sort(
        (left, right) =>
          (right.confidence ?? 0) - (left.confidence ?? 0) ||
          (right.opportunityScore ?? 0) - (left.opportunityScore ?? 0),
      )
      .slice(0, 3);
  }, [normalizedPredictions, safeDecrease, safeIncrease]);
  const handleLoadAiSummary = useCallback(async () => {
    if (import.meta.env.DEV) {
      console.debug('[one-hour-ai] button click fired');
    }

    if (!aiTopCandidates.length) {
      if (import.meta.env.DEV) {
        console.debug('[one-hour-ai] no eligible candidates found');
      }
      setAiSummaryState({
        loading: false,
        error: 'No strong candidates available for AI review yet.',
        results: [],
      });
      return;
    }

    setAiSummaryState((current) => ({
      ...current,
      loading: true,
        error: null,
      }));

    try {
      if (import.meta.env.DEV) {
        console.debug('[one-hour-ai] candidate list prepared', aiTopCandidates);
        console.debug('[one-hour-ai] candidate count', aiTopCandidates.length);
        console.debug('[one-hour-ai] AI request starting');
      }
      const results = await Promise.all(
        aiTopCandidates.map(async (candidate) => {
          const payload = buildPredictionAssistantPayload(candidate);
          const cacheKey = buildAIPredictionKey(payload);
          const cached = aiCacheRef.current.get(cacheKey);

          if (cached) {
            return cached;
          }

          const insight = await fetchAIPredictionAssistant(payload);
          const finalConfidence = Math.max(
            0,
            Math.min(100, (candidate.confidence ?? 0) + (Number(insight?.aiConfidenceAdjustment) || 0)),
          );
          const result = {
            candidate,
            insight,
            finalConfidence,
            cacheKey,
          };
          aiCacheRef.current.set(cacheKey, result);
          return result;
        }),
      );

      if (import.meta.env.DEV) {
        console.debug('[one-hour-ai] AI response received', results);
      }
      setAiSummaryState({
        loading: false,
        error: null,
        results,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[one-hour-ai] AI error caught', error);
      }
      setAiSummaryState({
        loading: false,
        error: 'AI view is temporarily unavailable. The deterministic engine remains active.',
        results: [],
      });
    }
  }, [aiTopCandidates]);

  if (!total) {
    return (
      <div className="space-y-6">
        <SectionHeader
          eyebrow="1 Hour Prediction"
          title="1 Hour Prediction"
          description="Deterministic next-60-minute scanner focused on cleaner directional setups and practical no-trade discipline."
          action={<LiveBadge status={marketStatus} />}
        />
        <div className="panel p-5 text-sm text-slate-300">No prediction data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="1 Hour Prediction"
        title="1 Hour Prediction"
        description="Deterministic next-60-minute scanner focused on cleaner directional setups and practical no-trade discipline."
        action={<LiveBadge status={marketStatus} />}
      />

      <div className="panel border-amber-400/20 bg-amber-400/8 p-5 text-sm leading-7 text-slate-300">
        For analysis support only. Not financial advice.
        {marketStatus === 'CLOSED' ? ' Based on last session data. Predictions below are next session estimates and confidence is reduced automatically.' : ''}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Tracked Stocks" value={total} helper="Universe scanned by the 1-hour model" />
        <SummaryCard
          label="Likely Up"
          value={(tierCounts?.increase?.[normalizedActiveTier] ?? 0)}
          helper="Only cleaner bullish setups"
        />
        <SummaryCard
          label="Likely Down"
          value={(tierCounts?.decrease?.[normalizedActiveTier] ?? 0)}
          helper="Only cleaner bearish setups"
        />
        <SummaryCard label="No Clear Edge" value={noClearEdgeCount} helper="Mixed or weak setups moved aside" />
        <SummaryCard label="Average Confidence" value={`${averageConfidence}%`} helper="Across current 1-hour outputs" />
        <SummaryCard
          label="Average Hit Rate"
          value={`${hitRate ?? '--'} / ${averageHitRate}%`}
          helper={`Last updated ${formatDateTime(lastUpdated)}`}
        />
      </div>

      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="metric-label">Signal Tiers</p>
            <h3 className="mt-2 font-display text-xl font-bold text-white">Best available opportunities</h3>
            <p className="mt-2 text-sm text-slate-400">
              Strong setups are shown first. If none are available, the page automatically falls back to moderate, then limited weak directional bias.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['STRONG', 'MODERATE', 'WEAK'].map((tier) => (
              <button
                key={tier}
                onClick={() => setActiveTier(tier)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                  normalizedActiveTier === tier
                    ? 'border-emerald-400/40 bg-emerald-400/12 text-white shadow-glow'
                    : 'border-border/70 text-slate-400 hover:border-border hover:text-slate-200'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Learning Accuracy"
          value={`${learningSummary?.overallAccuracy ?? 0}%`}
          helper="Confidence adjustments come from tracked 1-hour outcomes"
        />
        <SummaryCard
          label="Best Setup Type"
          value={learningSummary?.bestSetupType ?? 'N/A'}
          helper="Historically strongest recent setup family"
        />
        <SummaryCard
          label="Weakest Setup Type"
          value={learningSummary?.weakestSetupType ?? 'N/A'}
          helper="Historically weakest recent setup family"
        />
      </div>

      {contentReady ? (
        <AIPredictionSummaryPanel
          loading={aiSummaryState.loading}
          error={aiSummaryState.error}
          results={aiSummaryState.results}
          onLoad={handleLoadAiSummary}
        />
      ) : null}

      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            1-hour engine is selective by design to improve practical accuracy.
          </p>
          <button
            onClick={handleRefreshPredictions}
            className="rounded-full border border-border/70 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-200"
          >
            Refresh 1H model
          </button>
          {isDebugAvailable ? (
            <button
              onClick={handleToggleDebug}
              className="rounded-full border border-border/70 px-4 py-2 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:border-sky-400/40 hover:text-sky-200"
            >
              {showDebug ? 'Hide Debug' : 'Show Debug'}
            </button>
          ) : null}
        </div>
      </div>

      {!contentReady ? (
        <div className="panel p-5">
          <p className="metric-label">Prediction Summary</p>
          <h3 className="mt-2 font-display text-xl font-bold text-white">Preparing detailed 1-hour candidates</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <SummaryCard label="Top Bullish" value={Math.min(tierCounts?.increase?.[normalizedActiveTier] ?? 0, 5)} helper={`${normalizedActiveTier} tier preview`} />
            <SummaryCard label="Top Bearish" value={Math.min(tierCounts?.decrease?.[normalizedActiveTier] ?? 0, 5)} helper={`${normalizedActiveTier} tier preview`} />
            <SummaryCard label="No Clear Edge" value={Math.min(noClearEdgeCount ?? 0, 5)} helper="Lightweight summary first" />
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Loading top candidates first to keep the page responsive in production.
          </p>
        </div>
      ) : null}

      {contentReady ? (
        <>
          <HourPredictionPanel
            eyebrow="Bullish"
            title={`${normalizedActiveTier === 'STRONG' ? 'Strong Opportunities' : normalizedActiveTier === 'MODERATE' ? 'Moderate Opportunities' : 'Weak Bias'} - Likely to Increase`}
            rows={safeIncrease}
            showDebug={isDebugAvailable && showDebug}
            emptyTitle={`No ${normalizedActiveTier.toLowerCase()} 1-hour upside candidates`}
            emptyDescription={
              normalizedActiveTier === 'STRONG'
                ? 'The engine currently sees no strong bullish setup and is waiting for cleaner alignment.'
                : normalizedActiveTier === 'MODERATE'
                  ? 'No moderate bullish setups are available right now.'
                  : 'No usable weak bullish bias is available without adding noise.'
            }
          />

          <HourPredictionPanel
            eyebrow="Bearish"
            title={`${normalizedActiveTier === 'STRONG' ? 'Strong Opportunities' : normalizedActiveTier === 'MODERATE' ? 'Moderate Opportunities' : 'Weak Bias'} - Likely to Decrease`}
            rows={safeDecrease}
            showDebug={isDebugAvailable && showDebug}
            emptyTitle={`No ${normalizedActiveTier.toLowerCase()} 1-hour downside candidates`}
            emptyDescription={
              normalizedActiveTier === 'STRONG'
                ? 'The engine currently sees no strong bearish setup and is avoiding forced downside calls.'
                : normalizedActiveTier === 'MODERATE'
                  ? 'No moderate bearish setups are available right now.'
                  : 'No usable weak bearish bias is available without adding noise.'
            }
          />

          <HourPredictionPanel
            eyebrow="Neutral"
            title="No Clear Edge"
            rows={neutralRequested ? safeNoClearEdge : []}
            showDebug={isDebugAvailable && showDebug}
            collapsible
            defaultExpanded={false}
            emptyTitle="No neutral names to review"
            emptyDescription="Current names are already classified into cleaner bullish or bearish setups."
          />
          {!neutralRequested ? (
            <div className="flex justify-end">
              <button onClick={() => setNeutralRequested(true)} className="app-button">
                Load No Clear Edge
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="panel p-5">
        <p className="metric-label">Model Notes / Risk Notes</p>
        <h3 className="mt-2 font-display text-xl font-bold text-white">How to read the 1-hour model</h3>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
          {(notes?.map((note) => note) || []).map((note) => (
            <li key={note}>- {note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default OneHourPredictionPage;
