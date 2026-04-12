const DEFAULT_DB_STARTUP_MAX_ATTEMPTS = 10;
const DEFAULT_DB_STARTUP_RETRY_DELAY_MS = 3_000;

const RETRYABLE_DB_ERROR_CODES = new Set([
  "57P03",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "P1001",
]);

const RETRYABLE_DB_MESSAGE_PATTERNS = [
  /can't reach database server/i,
  /cannot connect now/i,
  /connection refused/i,
  /connection terminated unexpectedly/i,
  /database system is starting up/i,
  /failed to connect to server/i,
  /getaddrinfo eai_again/i,
  /server closed the connection unexpectedly/i,
  /timed out/i,
];

const clampPositiveInt = (value, fallback, { min = 1, max = 600_000 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const normalized = Math.floor(parsed);
  if (normalized < min) {
    return min;
  }
  if (normalized > max) {
    return max;
  }
  return normalized;
};

const sleep = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
  });

const collectSignals = (value, signals, seen) => {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    signals.push(value);
    return;
  }
  if (typeof value !== "object") {
    signals.push(String(value));
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  const candidateKeys = [
    "code",
    "detail",
    "errno",
    "errorCode",
    "message",
    "name",
    "reason",
    "stack",
  ];
  for (const key of candidateKeys) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== "") {
      signals.push(String(value[key]));
    }
  }

  const nestedKeys = ["cause", "driverAdapterError", "error", "errors", "meta", "originalError"];
  for (const key of nestedKeys) {
    const nestedValue = value[key];
    if (Array.isArray(nestedValue)) {
      nestedValue.forEach((item) => collectSignals(item, signals, seen));
      continue;
    }
    collectSignals(nestedValue, signals, seen);
  }

  try {
    signals.push(JSON.stringify(value));
  } catch {
    // Ignore circular serialization failures.
  }
};

export const getDatabaseStartupRetryConfig = (env = process.env) => ({
  maxAttempts: clampPositiveInt(env.DB_STARTUP_MAX_ATTEMPTS, DEFAULT_DB_STARTUP_MAX_ATTEMPTS, {
    min: 1,
    max: 100,
  }),
  retryDelayMs: clampPositiveInt(env.DB_STARTUP_RETRY_DELAY_MS, DEFAULT_DB_STARTUP_RETRY_DELAY_MS),
});

export const isRetryableDatabaseStartupError = (error) => {
  const signals = [];
  collectSignals(error, signals, new Set());
  const normalizedSignals = signals.map((value) => String(value || "").trim()).filter(Boolean);

  if (normalizedSignals.some((value) => RETRYABLE_DB_ERROR_CODES.has(value.toUpperCase()))) {
    return true;
  }

  const signalText = normalizedSignals.join("\n");
  return RETRYABLE_DB_MESSAGE_PATTERNS.some((pattern) => pattern.test(signalText));
};

export const withDatabaseStartupRetry = async (task, options = {}) => {
  const config = getDatabaseStartupRetryConfig();
  const maxAttempts = clampPositiveInt(options.maxAttempts, config.maxAttempts, {
    min: 1,
    max: 100,
  });
  const retryDelayMs = clampPositiveInt(options.retryDelayMs, config.retryDelayMs);
  const onRetry = typeof options.onRetry === "function" ? options.onRetry : null;
  const shouldRetry =
    typeof options.shouldRetry === "function"
      ? options.shouldRetry
      : isRetryableDatabaseStartupError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task({ attempt, maxAttempts, retryDelayMs });
    } catch (error) {
      const canRetry = attempt < maxAttempts && shouldRetry(error);
      if (!canRetry) {
        throw error;
      }
      onRetry?.({
        attempt,
        error,
        maxAttempts,
        retryDelayMs,
      });
      await sleep(retryDelayMs);
    }
  }

  throw new Error("database_startup_retry_exhausted");
};

export default withDatabaseStartupRetry;
