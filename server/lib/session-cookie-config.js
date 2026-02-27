export const DEV_SESSION_SECRET_FALLBACK = "dev-session-secret";

const parseSecretList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);

const resolveSecrets = ({ sessionSecret, sessionSecrets }) => {
  const multiSecrets = parseSecretList(sessionSecrets);
  if (multiSecrets.length > 0) {
    return multiSecrets;
  }
  const single = String(sessionSecret || "").trim();
  return single ? [single] : [];
};

export const isDefaultSessionSecretInProduction = ({ isProduction, sessionSecret, sessionSecrets }) => {
  if (!isProduction) {
    return false;
  }
  return resolveSecrets({ sessionSecret, sessionSecrets }).length === 0;
};

export const buildSessionCookieConfig = ({
  isProduction,
  cookieBaseName = "rainbow.sid",
  sessionSecret,
  sessionSecrets,
  maxAgeMs = 1000 * 60 * 60 * 24 * 7,
} = {}) => {
  const safeBaseName = String(cookieBaseName || "rainbow.sid").trim() || "rainbow.sid";
  const resolvedSecrets = resolveSecrets({ sessionSecret, sessionSecrets });
  const unsafeSecretFallback = isDefaultSessionSecretInProduction({
    isProduction,
    sessionSecret,
    sessionSecrets,
  });
  const effectiveSecrets = resolvedSecrets.length > 0 ? resolvedSecrets : [DEV_SESSION_SECRET_FALLBACK];
  const cookieName = isProduction ? `__Host-${safeBaseName}` : safeBaseName;

  return {
    name: cookieName,
    secret: effectiveSecrets,
    activeSecret: effectiveSecrets[0],
    acceptedSecretsCount: effectiveSecrets.length,
    usesDefaultSecretInProduction: unsafeSecretFallback,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction ? true : "auto",
      path: "/",
      maxAge: maxAgeMs,
      priority: "high",
    },
  };
};
