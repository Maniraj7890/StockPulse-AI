import AIExplanationCard from '@/components/AIExplanationCard';
import BuyOpportunityTable from '@/components/BuyOpportunityTable';
import SectionHeader from '@/components/SectionHeader';
import { useMarketStore } from '@/store/useMarketStore';

function BuyOpportunityPage() {
  const rows = useMarketStore((state) => state.buyZoneRows ?? []);
  const leadSetup = rows[0] ?? null;
  const explanationPayload = leadSetup
    ? {
        symbol: leadSetup.symbol,
        marketStatus: leadSetup.live?.marketStatus ?? 'UNKNOWN',
        signal: leadSetup.signal?.signal ?? 'HOLD',
        confidence: leadSetup.confidence ?? leadSetup.signal?.confidence ?? 0,
        rsi: leadSetup.indicators?.rsi14 ?? null,
        ema9: leadSetup.indicators?.ema9 ?? null,
        ema21: leadSetup.indicators?.ema21 ?? null,
        momentum: leadSetup.dayChangePercent ?? leadSetup.live?.changePercent ?? 0,
        volatility: leadSetup.indicators?.atr14 ?? null,
        buyZone: leadSetup.buyZone ?? {
          inBuyZone: ['BUY NOW', 'SUPPORT BOUNCE'].includes(leadSetup.entryType),
          entryLabel:
            leadSetup.entryType === 'BUY NOW'
              ? 'IDEAL'
              : leadSetup.entryType === 'AVOID'
                ? 'RISKY'
                : 'WAIT',
          entryRange:
            leadSetup.idealEntryPrice != null
              ? {
                  min: leadSetup.idealEntryPrice,
                  max: leadSetup.idealEntryPrice,
                }
              : null,
          reasons: leadSetup.reasonSummary ? [leadSetup.reasonSummary] : [],
        },
        exitPlan: leadSetup.exitPlan ?? {
          action: 'HOLD',
          reasons: [],
        },
        stopLoss: leadSetup.stopLoss ?? leadSetup.signal?.tradePlan?.stopLoss ?? null,
        target: leadSetup.target ?? leadSetup.signal?.tradePlan?.target1 ?? null,
      }
    : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Buy Opportunity"
        title="Buy timing and entry support"
        description="Focus on bullish setups with trend confirmation, healthy RSI, strong volume, and acceptable reward-to-risk structure."
      />
      <AIExplanationCard
        title="AI Entry Note"
        eyebrow="AI Explanation"
        payload={explanationPayload}
      />
      <BuyOpportunityTable rows={rows} />
    </div>
  );
}

export default BuyOpportunityPage;
