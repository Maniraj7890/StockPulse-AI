import { useMemo } from 'react';
import { useMarketStore } from '@/store/useMarketStore';

export function useAlerts() {
  const alerts = useMarketStore((state) => state.alerts ?? []);
  const priceAlerts = useMarketStore((state) => state.priceAlerts ?? {});
  const lastAlertCheck = useMarketStore((state) => state.lastAlertCheck ?? null);

  return useMemo(() => {
    const activeAlerts = Object.entries(priceAlerts).flatMap(([symbol, items]) =>
      (items ?? []).map((item) => ({
        ...item,
        symbol,
        status: 'ACTIVE',
      })),
    );
    const triggeredAlerts = (alerts ?? []).filter((item) => !item?.status || item.status === 'TRIGGERED');
    const expiredAlerts = (alerts ?? []).filter((item) => item?.status === 'EXPIRED');

    return {
      activeAlerts,
      triggeredAlerts,
      expiredAlerts,
      lastChecked: lastAlertCheck,
    };
  }, [alerts, lastAlertCheck, priceAlerts]);
}
