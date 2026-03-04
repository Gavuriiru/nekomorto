const ORIGIN_API_BASE_MISMATCH_LOG_KEY = "dev:origin-api-base-mismatch";

const shouldLogInThisRuntime = () => {
  if (!import.meta.env.DEV || import.meta.env.VITEST) {
    return false;
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const userAgent = String(window.navigator?.userAgent || "");
  return !/jsdom/i.test(userAgent);
};

export const logOriginApiBaseMismatchOnce = (payload: {
  locationOrigin: string;
  apiBase: string;
  frontend: unknown;
  backend: unknown;
}) => {
  if (!shouldLogInThisRuntime()) {
    return;
  }
  try {
    if (window.sessionStorage.getItem(ORIGIN_API_BASE_MISMATCH_LOG_KEY) === "1") {
      return;
    }
    window.sessionStorage.setItem(ORIGIN_API_BASE_MISMATCH_LOG_KEY, "1");
  } catch {
    // Ignore sessionStorage failures and still log once for the current execution path.
  }
  console.info("origin_api_base_mismatch", payload);
};
