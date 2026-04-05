const STORAGE_PREFIX = 'stockpulse';
const DEFAULT_VERSION = 1;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function buildStorageKey(namespace, version = DEFAULT_VERSION) {
  return `${STORAGE_PREFIX}.${namespace}.v${version}`;
}

export function loadVersionedState(namespace, options = {}) {
  const {
    version = DEFAULT_VERSION,
    fallback,
    validate,
    migrate,
    legacyKeys = [],
  } = options;

  if (!canUseStorage()) return fallback;

  const keysToTry = [buildStorageKey(namespace, version), ...legacyKeys];

  for (const key of keysToTry) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      const migrated = typeof migrate === 'function' ? migrate(parsed) : parsed;
      const valid = typeof validate === 'function' ? validate(migrated) : true;

      if (valid) {
        return migrated;
      }
    } catch {
      // Ignore malformed storage values and fall through to fallback.
    }
  }

  return fallback;
}

export function saveVersionedState(namespace, value, version = DEFAULT_VERSION) {
  if (!canUseStorage()) return false;

  try {
    window.localStorage.setItem(buildStorageKey(namespace, version), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeVersionedState(namespace, version = DEFAULT_VERSION, legacyKeys = []) {
  if (!canUseStorage()) return;

  [buildStorageKey(namespace, version), ...legacyKeys].forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore removal issues to keep reset flows non-blocking.
    }
  });
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isNumberLike(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function canUseLocalStorage() {
  return canUseStorage();
}
