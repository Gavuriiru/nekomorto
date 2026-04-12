import { describe, expect, it, vi } from "vitest";

import { createGlobalErrorHandler } from "../../server/lib/global-error-handler.js";

const createMockRes = () => ({
  body: null as any,
  contentType: "",
  statusCode: 200,
  headersSent: false,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  type(value) {
    this.contentType = value;
    return this;
  },
  send(payload) {
    this.body = payload;
    return this;
  },
});

describe("global-error-handler", () => {
  it("logs full details server-side and returns a generic api error", () => {
    const logger = vi.fn();
    const handler = createGlobalErrorHandler({ logger });
    const req = {
      method: "POST",
      originalUrl: "/api/posts",
      path: "/api/posts",
      requestId: "req-1",
      session: {
        user: {
          id: "user-1",
        },
      },
    };
    const res = createMockRes();
    const error = new Error("Database exploded");
    error.stack = "Error: Database exploded\n at C:\\secret\\server.js:10:2";

    handler(error, req, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Something went wrong" });
    expect(logger).toHaveBeenCalledTimes(1);
    expect(String(logger.mock.calls[0][0])).toContain('"requestId":"req-1"');
    expect(String(logger.mock.calls[0][0])).toContain("Database exploded");
    expect(String(logger.mock.calls[0][0])).toContain("C:\\\\secret\\\\server.js");
  });

  it("returns a generic text response for non-api requests", () => {
    const handler = createGlobalErrorHandler({ logger: vi.fn() });
    const req = {
      method: "GET",
      originalUrl: "/dashboard",
      path: "/dashboard",
      session: {},
    };
    const res = createMockRes();

    handler(new Error("Template failure"), req, res, vi.fn());

    expect(res.statusCode).toBe(500);
    expect(res.contentType).toBe("text/plain; charset=utf-8");
    expect(res.body).toBe("Something went wrong");
  });
});
