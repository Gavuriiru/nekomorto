export const normalizeApiBase = (value: unknown) => {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  return normalized;
};

export const resolveApiBase = ({
  envBase,
  locationOrigin,
}: {
  envBase?: unknown;
  locationOrigin?: unknown;
}) => {
  const normalizedEnvBase = normalizeApiBase(envBase);
  if (normalizedEnvBase) {
    return normalizedEnvBase;
  }
  const normalizedLocationOrigin = normalizeApiBase(locationOrigin);
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
