export const normalizeApiBase = (value: unknown) => {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  return normalized;
};

const parseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isLocalOrPrivateHost = (hostname: string) => {
  const normalized = String(hostname || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  ) {
    return true;
  }
  if (
    /^10\.\d+\.\d+\.\d+$/.test(normalized) ||
    /^192\.168\.\d+\.\d+$/.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(normalized)
  ) {
    return true;
  }
  return false;
};

const shouldIgnoreEnvBaseForPublicOrigin = ({
  normalizedEnvBase,
  normalizedLocationOrigin,
}: {
  normalizedEnvBase: string;
  normalizedLocationOrigin: string;
}) => {
  if (!normalizedEnvBase || !normalizedLocationOrigin) {
    return false;
  }
  const envUrl = parseUrl(normalizedEnvBase);
  const locationUrl = parseUrl(normalizedLocationOrigin);
  if (!envUrl || !locationUrl) {
    return false;
  }
  const envUsesHttp = envUrl.protocol === "http:" || envUrl.protocol === "https:";
  const locationUsesHttp =
    locationUrl.protocol === "http:" || locationUrl.protocol === "https:";
  if (!envUsesHttp || !locationUsesHttp) {
    return false;
  }
  const envIsLocal = isLocalOrPrivateHost(envUrl.hostname);
  const locationIsLocal = isLocalOrPrivateHost(locationUrl.hostname);
  return envIsLocal && !locationIsLocal;
};

export const resolveApiBase = ({
  envBase,
  locationOrigin,
}: {
  envBase?: unknown;
  locationOrigin?: unknown;
}) => {
  const normalizedEnvBase = normalizeApiBase(envBase);
  const normalizedLocationOrigin = normalizeApiBase(locationOrigin);

  if (
    normalizedEnvBase &&
    !shouldIgnoreEnvBaseForPublicOrigin({
      normalizedEnvBase,
      normalizedLocationOrigin,
    })
  ) {
    return normalizedEnvBase;
  }

  if (normalizedLocationOrigin) {
    return normalizedLocationOrigin;
  }
  return "";
};

export const getApiBase = () =>
  resolveApiBase({
    envBase: import.meta.env.VITE_API_BASE,
    locationOrigin:
      typeof window !== "undefined" && window.location ? window.location.origin : "",
  });
