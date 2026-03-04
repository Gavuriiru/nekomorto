const regenerateSession = (session) =>
  new Promise((resolve, reject) => {
    if (!session || typeof session.regenerate !== "function") {
      reject(new Error("session_unavailable"));
      return;
    }
    session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const normalizeAppOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");
const normalizeAppPath = (value, fallback = "/") => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue || !normalizedValue.startsWith("/")) {
    return fallback;
  }
  return normalizedValue;
};

export const saveSessionState = (req) =>
  new Promise((resolve, reject) => {
    if (!req?.session || typeof req.session.save !== "function") {
      reject(new Error("session_unavailable"));
      return;
    }
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

export const buildAuthRedirectUrl = ({
  appOrigin,
  path = "/",
  searchParams = null,
} = {}) => {
  const normalizedOrigin = normalizeAppOrigin(appOrigin);
  const normalizedPath = normalizeAppPath(path);
  const url = new URL(normalizedPath, `${normalizedOrigin || "http://localhost"}/`);

  if (searchParams && typeof searchParams === "object") {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return normalizedOrigin ? url.toString() : `${url.pathname}${url.search}`;
};

export const establishAuthenticatedSession = async ({
  req,
  user,
  preserved = {},
} = {}) => {
  if (!req || !req.session) {
    throw new Error("session_unavailable");
  }
  await regenerateSession(req.session);
  if (!req.session) {
    throw new Error("session_unavailable");
  }
  req.session.user = user;
  req.session.pendingMfaUser = null;
  req.session.createdAt = req.session.createdAt || new Date().toISOString();
  Object.entries(preserved).forEach(([key, value]) => {
    req.session[key] = value;
  });
  return req.session;
};
