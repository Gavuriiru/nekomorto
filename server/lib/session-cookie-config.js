export const DEV_SESSION_SECRET_FALLBACK = "dev-session-secret";

export const isDefaultSessionSecretInProduction = ({ isProduction, sessionSecret }) => {
  if (!isProduction) {
    return false;
  }
  return String(sessionSecret || "").trim() === "";
};

export const buildSessionCookieConfig = ({
  isProduction,
  cookieBaseName = "rainbow.sid",
  sessionSecret,
  maxAgeMs = 1000 * 60 * 60 * 24 * 7,
} = {}) => {
  const safeBaseName = String(cookieBaseName || "rainbow.sid").trim() || "rainbow.sid";
  const unsafeSecretFallback = isDefaultSessionSecretInProduction({ isProduction, sessionSecret });
  const resolvedSecret = String(sessionSecret || "").trim() || DEV_SESSION_SECRET_FALLBACK;
  const cookieName = isProduction ? `__Host-${safeBaseName}` : safeBaseName;

  return {
    name: cookieName,
    secret: resolvedSecret,
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

