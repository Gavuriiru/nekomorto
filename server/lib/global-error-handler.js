const normalizeStatusCode = (value) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 400 || numeric > 599) {
    return 500;
  }
  return numeric;
};

const buildErrorLogPayload = (error, req, statusCode) => ({
  level: "error",
  msg: "request_failed",
  ts: new Date().toISOString(),
  requestId: req?.requestId || null,
  userId: req?.session?.user?.id || req?.session?.pendingMfaUser?.id || null,
  method: String(req?.method || "").toUpperCase(),
  route: String(req?.originalUrl || req?.path || ""),
  statusCode,
  errorName: String(error?.name || "Error"),
  errorMessage: String(error?.message || ""),
  stack: typeof error?.stack === "string" ? error.stack : "",
});

export const createGlobalErrorHandler = ({ logger = console.error } = {}) =>
  (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const statusCode = normalizeStatusCode(error?.statusCode ?? error?.status);
    try {
      logger(JSON.stringify(buildErrorLogPayload(error, req, statusCode)));
    } catch {
      logger("request_failed");
    }

    const isApiRequest = String(req?.originalUrl || req?.path || "").startsWith("/api");
    if (isApiRequest) {
      return res.status(statusCode).json({ error: "Something went wrong" });
    }
    return res.status(statusCode).type("text/plain; charset=utf-8").send("Something went wrong");
  };

export default createGlobalErrorHandler;
