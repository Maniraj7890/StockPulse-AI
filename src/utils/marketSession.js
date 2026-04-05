import {
  DEFAULT_EXCHANGE,
  FALLBACK_SOURCE,
  LIVE_QUOTE_MAX_AGE_MS,
  LIVE_SOURCE,
} from '@/services/symbolMap';

export const MARKET_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  PREOPEN: 'PREOPEN',
  UNKNOWN: 'UNKNOWN',
};

const NSE_EQUITY_HOLIDAYS = {
  2026: {
    '2026-01-26': 'Republic Day',
    '2026-03-03': 'Holi',
    '2026-03-26': 'Shri Ram Navami',
    '2026-03-31': 'Shri Mahavir Jayanti',
    '2026-04-03': 'Good Friday',
    '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
    '2026-05-01': 'Maharashtra Day',
    '2026-05-28': 'Bakri Id',
    '2026-06-26': 'Muharram',
    '2026-09-14': 'Ganesh Chaturthi',
    '2026-10-02': 'Mahatma Gandhi Jayanti',
    '2026-10-20': 'Dussehra',
    '2026-11-10': 'Diwali-Balipratipada',
    '2026-11-24': 'Prakash Gurpurb Sri Guru Nanak Dev',
    '2026-12-25': 'Christmas',
  },
};

export function getMarketStatusBadge(status) {
  if (status === MARKET_STATUS.OPEN) {
    return {
      label: 'LIVE',
      toneClass: 'border-emerald-400/40 bg-emerald-400/12 text-emerald-200',
      dotClass: 'animate-pulse bg-emerald-300',
    };
  }

  if (status === MARKET_STATUS.PREOPEN) {
    return {
      label: 'PREOPEN',
      toneClass: 'border-amber-400/40 bg-amber-400/12 text-amber-200',
      dotClass: 'bg-amber-300',
    };
  }

  if (status === MARKET_STATUS.CLOSED) {
    return {
      label: 'CLOSED',
      toneClass: 'border-border/70 bg-panel-soft/70 text-slate-300',
      dotClass: 'bg-slate-400',
    };
  }

  return {
    label: 'UNKNOWN',
    toneClass: 'border-border/70 bg-panel-soft/70 text-slate-400',
    dotClass: 'bg-slate-500',
  };
}

export function getQuotePresentation(quote = {}) {
  const marketStatus = quote.marketStatus ?? MARKET_STATUS.UNKNOWN;
  const isClosedSession = marketStatus === MARKET_STATUS.CLOSED;
  const explanation = getMarketStatusExplanation(quote);

  return {
    isClosedSession,
    priceLabel: isClosedSession ? 'Last Traded Price' : 'LTP',
    priceHelper: isClosedSession ? 'Based on last session data' : 'Live market data',
    expectedMoveLabel: isClosedSession ? 'Estimated move for next session' : 'Expected move',
    predictionNote: isClosedSession ? 'Next session estimate' : 'Live session estimate',
    closedBadgeText: isClosedSession ? 'MARKET CLOSED - Using last session data' : null,
    explanation,
  };
}

const IST_TIMEZONE = 'Asia/Kolkata';
const PREOPEN_START_MINUTES = 9 * 60;
const MARKET_OPEN_MINUTES = 9 * 60 + 15;
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;
const LAST_SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

function getIstParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date).reduce((accumulator, part) => {
    if (part.type !== 'literal') {
      accumulator[part.type] = part.value;
    }

    return accumulator;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function getIstDateKey(date = new Date()) {
  const parts = getIstParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function isWeekend(date = new Date()) {
  const parts = getIstParts(date);
  return ['Sat', 'Sun'].includes(parts.weekday);
}

function getHolidayName(date = new Date()) {
  const parts = getIstParts(date);
  return NSE_EQUITY_HOLIDAYS[parts.year]?.[getIstDateKey(date)] ?? null;
}

function isTradingSessionDate(date = new Date()) {
  return !isWeekend(date) && !getHolidayName(date);
}

function formatSessionDate(date = null) {
  if (!date) return null;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getPreviousTradingDay(now = new Date()) {
  const cursor = new Date(now);
  cursor.setUTCDate(cursor.getUTCDate() - 1);

  for (let index = 0; index < 14; index += 1) {
    if (isTradingSessionDate(cursor)) {
      return cursor;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return null;
}

function getNextTradingDay(now = new Date()) {
  const cursor = new Date(now);

  for (let index = 0; index < 14; index += 1) {
    if (isTradingSessionDate(cursor)) {
      return cursor;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return null;
}

function getNextExpectedLiveSession(now = new Date()) {
  const parts = getIstParts(now);
  const minutes = parts.hour * 60 + parts.minute;
  const currentDate = new Date(now);

  if (isTradingSessionDate(currentDate) && minutes < MARKET_OPEN_MINUTES) {
    return {
      timestamp: new Date(now),
      label: `Today, 9:15 AM IST`,
    };
  }

  const nextTradingDay = getNextTradingDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (!nextTradingDay) {
    return null;
  }

  return {
    timestamp: nextTradingDay,
    label: `${formatSessionDate(nextTradingDay)}, 9:15 AM IST`,
  };
}

function countMissedTradingDays(lastSessionDate, now = new Date()) {
  if (!lastSessionDate) return 0;
  const previousTradingDay = getPreviousTradingDay(now);
  if (!previousTradingDay) return 0;
  const lastKey = getIstDateKey(lastSessionDate);
  const previousKey = getIstDateKey(previousTradingDay);
  if (lastKey === previousKey) {
    return 0;
  }

  let missedDays = 0;
  const cursor = new Date(lastSessionDate);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (getIstDateKey(cursor) !== previousKey) {
    if (isTradingSessionDate(cursor)) {
      missedDays += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return missedDays + 1;
}

function getSessionReason(now = new Date()) {
  const parts = getIstParts(now);
  const minutes = parts.hour * 60 + parts.minute;
  const holidayName = getHolidayName(now);

  if (holidayName) {
    return {
      statusLabel: 'Exchange holiday',
      reason: `${holidayName} is an exchange holiday.`,
    };
  }

  if (isWeekend(now)) {
    return {
      statusLabel: 'Weekend closure',
      reason: 'The exchange is closed for the weekend.',
    };
  }

  if (minutes < PREOPEN_START_MINUTES) {
    return {
      statusLabel: 'Pre-market',
      reason: 'The market has not entered the pre-open session yet.',
    };
  }

  if (minutes >= PREOPEN_START_MINUTES && minutes < MARKET_OPEN_MINUTES) {
    return {
      statusLabel: 'Pre-open',
      reason: 'The exchange is in the pre-open session and prices can still adjust.',
    };
  }

  if (minutes > MARKET_CLOSE_MINUTES) {
    return {
      statusLabel: 'Post-market',
      reason: 'The live trading session has ended for today.',
    };
  }

  return {
    statusLabel: 'Live session',
    reason: 'Live market session is active.',
  };
}

export function getMarketStatusExplanation(quote = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const lastUpdated = quote?.lastUpdated ? new Date(quote.lastUpdated) : null;
  const sessionReason = getSessionReason(now);
  const nextExpectedLiveSession = getNextExpectedLiveSession(now);
  const missedTradingDays = countMissedTradingDays(lastUpdated, now);
  const previousTradingDay = getPreviousTradingDay(now);

  let freshnessNote = quote?.stale
    ? 'Live feed is not updating right now.'
    : 'Feed timing is within the current refresh window.';

  if (quote?.marketStatus === MARKET_STATUS.CLOSED || quote?.marketStatus === MARKET_STATUS.PREOPEN) {
    freshnessNote = 'Showing the most recent completed trading session.';
  }

  if (lastUpdated && previousTradingDay && getIstDateKey(lastUpdated) !== getIstDateKey(previousTradingDay) && missedTradingDays > 0) {
    freshnessNote = `Previous trading session was ${formatSessionDate(lastUpdated)} because ${formatSessionDate(previousTradingDay)} was not a live trading session.`;
  } else if (lastUpdated && previousTradingDay && getIstDateKey(lastUpdated) === getIstDateKey(previousTradingDay) && getHolidayName(now)) {
    freshnessNote = `Previous trading session was ${formatSessionDate(lastUpdated)} because today is an exchange holiday.`;
  }

  return {
    statusLabel: sessionReason.statusLabel,
    reason: sessionReason.reason,
    lastValidSessionTimestamp: quote?.lastUpdated ?? null,
    freshnessNote,
    nextExpectedLiveSession: nextExpectedLiveSession?.label ?? null,
    bannerText:
      quote?.marketStatus === MARKET_STATUS.CLOSED
        ? 'Market closed - showing last traded session data'
        : quote?.marketStatus === MARKET_STATUS.PREOPEN
          ? 'Pre-open - showing previous session data until live trading begins'
          : null,
  };
}

function sameIstDate(left, right) {
  const leftParts = getIstParts(left);
  const rightParts = getIstParts(right);

  return (
    leftParts.year === rightParts.year &&
    leftParts.month === rightParts.month &&
    leftParts.day === rightParts.day
  );
}

export function isTimestampInvalid(value) {
  if (!value) {
    return true;
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return true;
  }

  const now = Date.now();
  const year = new Date(timestamp).getFullYear();
  const currentYear = new Date(now).getFullYear();

  return year < currentYear - 1 || timestamp > now + 5 * 60 * 1000;
}

export function deriveScheduledMarketStatus(exchange = DEFAULT_EXCHANGE, now = new Date()) {
  if (!exchange) {
    return MARKET_STATUS.UNKNOWN;
  }

  const parts = getIstParts(now);
  const isTradingDay = !['Sat', 'Sun'].includes(parts.weekday) && !getHolidayName(now);

  if (!isTradingDay) {
    return MARKET_STATUS.CLOSED;
  }

  const minutes = parts.hour * 60 + parts.minute;

  if (minutes >= PREOPEN_START_MINUTES && minutes < MARKET_OPEN_MINUTES) {
    return MARKET_STATUS.PREOPEN;
  }

  if (minutes >= MARKET_OPEN_MINUTES && minutes <= MARKET_CLOSE_MINUTES) {
    return MARKET_STATUS.OPEN;
  }

  return MARKET_STATUS.CLOSED;
}

export function enrichMarketQuoteState(quote = {}, options = {}) {
  const refreshInterval = options.refreshInterval ?? LIVE_QUOTE_MAX_AGE_MS;
  const now = options.now ? new Date(options.now) : new Date();
  const exchange = quote.exchange ?? DEFAULT_EXCHANGE;
  const source = quote.source ?? LIVE_SOURCE;
  const timestampIsInvalid = isTimestampInvalid(quote.lastUpdated);
  const lastUpdated = timestampIsInvalid ? null : quote.lastUpdated ?? null;
  const scheduledStatus = deriveScheduledMarketStatus(exchange, now);
  const timestamp = lastUpdated ? new Date(lastUpdated).getTime() : 0;
  const age = timestamp ? now.getTime() - timestamp : Number.POSITIVE_INFINITY;
  const recentSession = timestamp && age <= LAST_SESSION_MAX_AGE_MS;
  const sameSessionDay = timestamp ? sameIstDate(new Date(timestamp), now) : false;

  let marketStatus = scheduledStatus;
  let marketStatusDetail = scheduledStatus === MARKET_STATUS.OPEN ? 'Live session' : 'Last session data';
  let stale = false;
  let staleLabel = null;

  if (source === FALLBACK_SOURCE) {
    marketStatus = lastUpdated ? MARKET_STATUS.CLOSED : scheduledStatus;
    marketStatusDetail =
      scheduledStatus === MARKET_STATUS.PREOPEN
        ? 'Pre-open indication'
        : lastUpdated
          ? 'Previous close'
          : scheduledStatus === MARKET_STATUS.CLOSED
            ? 'Last session data'
            : 'Data unavailable';
    stale = true;
    staleLabel = lastUpdated ? 'Delayed' : 'Refreshing';
  } else if (!lastUpdated) {
    marketStatus = scheduledStatus === MARKET_STATUS.OPEN ? MARKET_STATUS.OPEN : scheduledStatus;
    marketStatusDetail =
      scheduledStatus === MARKET_STATUS.PREOPEN
        ? 'Pre-open indication'
        : scheduledStatus === MARKET_STATUS.CLOSED
          ? 'Last session data'
          : 'Awaiting first tick';
    stale = true;
    staleLabel = 'Refreshing';
  } else if (scheduledStatus === MARKET_STATUS.OPEN) {
    if (age <= refreshInterval) {
      marketStatus = MARKET_STATUS.OPEN;
      marketStatusDetail = 'Live session';
    } else if (recentSession) {
      marketStatus = MARKET_STATUS.CLOSED;
      marketStatusDetail = sameSessionDay ? 'Last traded data' : 'Last session data';
    } else {
      marketStatus = MARKET_STATUS.OPEN;
      marketStatusDetail = 'Awaiting fresh tick';
      stale = true;
      staleLabel = 'Delayed';
    }
  } else if (scheduledStatus === MARKET_STATUS.PREOPEN) {
    marketStatus = MARKET_STATUS.PREOPEN;
    marketStatusDetail = sameSessionDay ? 'Pre-open indication' : 'Previous close';
  } else if (scheduledStatus === MARKET_STATUS.CLOSED) {
    marketStatus = MARKET_STATUS.CLOSED;
    marketStatusDetail = recentSession ? 'Last session data' : 'Data unavailable';
    stale = !recentSession;
    staleLabel = stale ? 'Delayed' : null;
  } else {
    marketStatus = MARKET_STATUS.UNKNOWN;
    marketStatusDetail = 'Data unavailable';
    stale = true;
    staleLabel = 'Refreshing';
  }

  const explanation = getMarketStatusExplanation(
    {
      ...quote,
      lastUpdated,
      marketStatus,
      marketStatusDetail,
      stale,
      staleLabel,
      source,
    },
    { now },
  );

  return {
    ...quote,
    lastUpdated,
    source,
    stale,
    isStale: stale,
    staleLabel,
    marketStatus,
    marketStatusDetail: explanation.statusLabel,
    marketStatusReason: explanation.reason,
    lastValidSessionTimestamp: explanation.lastValidSessionTimestamp,
    freshnessNote: explanation.freshnessNote,
    nextExpectedLiveSession: explanation.nextExpectedLiveSession,
    marketBannerText: explanation.bannerText,
  };
}

export function getRecommendedPollingInterval(marketStatus, defaultInterval) {
  if (marketStatus === MARKET_STATUS.CLOSED) {
    return Math.max(defaultInterval, 60000);
  }

  if (marketStatus === MARKET_STATUS.PREOPEN) {
    return Math.max(defaultInterval, 15000);
  }

  return defaultInterval;
}
