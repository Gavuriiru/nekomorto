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
