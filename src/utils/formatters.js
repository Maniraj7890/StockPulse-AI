function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function toSafeNumber(value) {
  if (isFiniteNumber(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrency(value) {
  const safeValue = toSafeNumber(value);
  if (safeValue == null) {
    return '—';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(safeValue);
}

export function formatPercent(value) {
  const safeValue = toSafeNumber(value);
  if (safeValue == null) {
    return '—';
  }

  const sign = safeValue > 0 ? '+' : '';
  return `${sign}${safeValue.toFixed(2)}%`;
}

export function formatNumber(value, maximumFractionDigits = 2) {
  const safeValue = toSafeNumber(value);
  if (safeValue == null) {
    return '—';
  }

  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits,
  }).format(safeValue);
}

export function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatCompactNumber(value) {
  const safeValue = toSafeNumber(value);
  if (safeValue == null) {
    return '—';
  }

  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(safeValue);
}

export function formatConfidence(value) {
  const safeValue = toSafeNumber(value);
  return safeValue == null ? '—' : `${Math.round(safeValue)}%`;
}

export function formatScore(value, maximumFractionDigits = 1) {
  const safeValue = toSafeNumber(value);
  return safeValue == null ? '—' : safeValue.toFixed(maximumFractionDigits);
}
