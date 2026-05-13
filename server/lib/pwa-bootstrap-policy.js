const normalizeHostname = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

export const isLoopbackHostname = (value) => {
  const normalized = normalizeHostname(value);
  if (!normalized) {
    return false;
  }
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    normalized.endsWith(".localhost")
  );
};

export const resolveBootstrapPwaRequestHostname = (req) => {
  // Rely securely on Express's req.hostname which respects the 'trust proxy' configuration
  // instead of manually parsing the user-controlled 'x-forwarded-host' header.
  // This mitigates potential Host Header Injection vulnerabilities.
  const requestHostname = normalizeHostname(req?.hostname);
  if (requestHostname) {
    return requestHostname;
  }

  const rawHost = String(req?.headers?.host || "").trim();
  if (!rawHost) {
    return "";
  }

  try {
    const parsed = new URL(`http://${rawHost}`);
    return normalizeHostname(parsed.hostname);
  } catch {
    return normalizeHostname(rawHost.replace(/:\d+$/, ""));
  }
};

export const createResolveBootstrapPwaEnabled = ({
  isProduction = false,
  isPwaDevEnabled = false,
} = {}) => {
  if (isProduction) {
    return () => true;
  }

  if (!isPwaDevEnabled) {
    return () => false;
  }

  return (req) => isLoopbackHostname(resolveBootstrapPwaRequestHostname(req));
};

export default createResolveBootstrapPwaEnabled;
