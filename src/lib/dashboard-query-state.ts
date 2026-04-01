export const parseDashboardPageParam = (value: string | null, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
};

export const parseDashboardEnumParam = <TValue extends string>(
  value: string | null,
  allowedValues: readonly TValue[],
  fallback: TValue,
) => {
  if (allowedValues.includes(value as TValue)) {
    return value as TValue;
  }
  return fallback;
};

type DashboardSearchParamEntry = {
  key: string;
  value: string | number | null | undefined;
  fallbackValue?: string | number | null | undefined;
  trim?: boolean;
};

type DashboardSearchParamBuildOptions = {
  deleteKeys?: string[];
};

const normalizeParamValue = (
  value: string | number | null | undefined,
  trim = true,
) => {
  if (value === null || value === undefined) {
    return "";
  }
  const normalized = String(value);
  return trim ? normalized.trim() : normalized;
};

export const buildDashboardSearchParams = (
  currentParams: URLSearchParams,
  entries: DashboardSearchParamEntry[],
  options: DashboardSearchParamBuildOptions = {},
) => {
  const nextParams = removeDashboardSearchParamKeys(currentParams, options.deleteKeys ?? []);
  entries.forEach(({ key, value, fallbackValue, trim = true }) => {
    const normalizedValue = normalizeParamValue(value, trim);
    const normalizedFallback = normalizeParamValue(fallbackValue, trim);
    if (!normalizedValue || normalizedValue === normalizedFallback) {
      nextParams.delete(key);
      return;
    }
    nextParams.set(key, normalizedValue);
  });
  return nextParams;
};

export const removeDashboardSearchParamKeys = (
  currentParams: URLSearchParams,
  keys: string[],
) => {
  const nextParams = new URLSearchParams(currentParams);
  keys.forEach((key) => {
    nextParams.delete(key);
  });
  return nextParams;
};

export const areDashboardSearchParamsEqual = (
  left: URLSearchParams,
  right: URLSearchParams,
) => left.toString() === right.toString();
