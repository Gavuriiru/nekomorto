import { describe, expect, it, vi } from "vitest";

import {
  buildCorsOptionsForRequest,
  isReadOnlyMethod,
} from "../../server/lib/cors-policy.js";

describe("cors-policy", () => {
  it("considers GET/HEAD/OPTIONS as read-only methods", () => {
    expect(isReadOnlyMethod("GET")).toBe(true);
    expect(isReadOnlyMethod("HEAD")).toBe(true);
    expect(isReadOnlyMethod("OPTIONS")).toBe(true);
    expect(isReadOnlyMethod("POST")).toBe(false);
  });

  it("allows configured origin in production", () => {
    const isAllowedOriginFn = vi.fn((origin) => origin === "https://site.example.com");
    const options = buildCorsOptionsForRequest({
      origin: "https://site.example.com",
      method: "POST",
      isProduction: true,
      isAllowedOriginFn,
    });

    expect(options).toEqual({
      origin: true,
      credentials: true,
    });
    expect(isAllowedOriginFn).toHaveBeenCalledWith("https://site.example.com");
  });

  it("blocks non-allowlisted origin in production", () => {
    const options = buildCorsOptionsForRequest({
      origin: "https://evil.example.com",
      method: "GET",
      isProduction: true,
      isAllowedOriginFn: () => false,
    });

    expect(options).toBeNull();
  });

  it("allows requests without Origin only for read methods in production", () => {
    const methods = ["GET", "HEAD", "OPTIONS"];

    methods.forEach((method) => {
      const options = buildCorsOptionsForRequest({
        origin: "",
        method,
        isProduction: true,
        isAllowedOriginFn: () => false,
      });
      expect(options).toEqual({
        origin: false,
        credentials: true,
      });
    });
  });

  it("blocks requests without Origin for write methods in production", () => {
    const methods = ["POST", "PUT", "PATCH", "DELETE"];

    methods.forEach((method) => {
      const options = buildCorsOptionsForRequest({
        origin: "",
        method,
        isProduction: true,
        isAllowedOriginFn: () => false,
      });
      expect(options).toBeNull();
    });
  });

  it("allows requests without Origin in development", () => {
    const options = buildCorsOptionsForRequest({
      origin: "",
      method: "POST",
      isProduction: false,
      isAllowedOriginFn: () => false,
    });

    expect(options).toEqual({
      origin: false,
      credentials: true,
    });
  });
});
