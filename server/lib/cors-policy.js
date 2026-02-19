const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const normalizeString = (value) => String(value || "").trim();

const normalizeMethod = (method) => normalizeString(method).toUpperCase();

export const isReadOnlyMethod = (method) => READ_ONLY_METHODS.has(normalizeMethod(method));

export const shouldAllowNoOriginRequest = ({
  method,
  isProduction,
}) => {
  if (!isProduction) {
    return true;
  }
  return isReadOnlyMethod(method);
};

export const isCorsRequestAllowed = ({
  origin,
  method,
  isProduction,
  isAllowedOriginFn,
}) => {
  const normalizedOrigin = normalizeString(origin);
  if (normalizedOrigin) {
    if (typeof isAllowedOriginFn !== "function") {
      return false;
    }
    return Boolean(isAllowedOriginFn(normalizedOrigin));
  }
  return shouldAllowNoOriginRequest({ method, isProduction });
};

export const buildCorsOptionsForRequest = ({
  origin,
  method,
  isProduction,
  isAllowedOriginFn,
}) => {
  if (
    !isCorsRequestAllowed({
      origin,
      method,
      isProduction,
      isAllowedOriginFn,
    })
  ) {
    return null;
  }

  return {
    origin: normalizeString(origin) ? true : false,
    credentials: true,
  };
};
