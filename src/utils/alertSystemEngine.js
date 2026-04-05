export function buildAlertSnapshot(alerts = [], priceAlerts = {}, lastChecked = null) {
  const activeAlerts = Object.entries(priceAlerts ?? {}).flatMap(([symbol, items]) =>
    (items ?? []).map((item) => ({
      ...item,
      symbol,
      status: 'ACTIVE',
    })),
  );
  const triggeredAlerts = (alerts ?? [])
    .filter((item) => !item?.status || item.status === 'TRIGGERED')
    .sort((left, right) => (right?.alertScore ?? 0) - (left?.alertScore ?? 0));
  const expiredAlerts = (alerts ?? [])
    .filter((item) => item?.status === 'EXPIRED')
    .sort((left, right) => (right?.alertScore ?? 0) - (left?.alertScore ?? 0));
  const importantNow = triggeredAlerts.slice(0, 5);

  return {
    activeAlerts,
    triggeredAlerts,
    expiredAlerts,
    importantNow,
    lastChecked,
  };
}
