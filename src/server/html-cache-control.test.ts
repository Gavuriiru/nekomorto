import { describe, expect, it } from "vitest";

import {
  applyHtmlCachingHeaders,
  HTML_CACHE_CONTROL_NO_STORE,
  HTML_CACHE_CONTROL_PRIVATE_REVALIDATE,
  HTML_VARY_COOKIE,
  resolveHtmlCacheControl,
  resolveHtmlVaryHeader,
} from "../../server/lib/html-cache-control.js";

describe("resolveHtmlCacheControl", () => {
  it("returns private revalidate for anonymous public home route", () => {
    expect(resolveHtmlCacheControl({ pathname: "/", isAuthenticated: false })).toBe(
      HTML_CACHE_CONTROL_PRIVATE_REVALIDATE,
    );
  });

  it("returns private revalidate for anonymous public route with query", () => {
    expect(resolveHtmlCacheControl({ pathname: "/projetos?tag=x", isAuthenticated: false })).toBe(
      HTML_CACHE_CONTROL_PRIVATE_REVALIDATE,
    );
  });

  it("returns no-store for anonymous dashboard route", () => {
    expect(resolveHtmlCacheControl({ pathname: "/dashboard", isAuthenticated: false })).toBe(
      HTML_CACHE_CONTROL_NO_STORE,
    );
  });

  it("returns no-store for anonymous dashboard child route", () => {
    expect(
      resolveHtmlCacheControl({
        pathname: "/dashboard/posts",
        isAuthenticated: false,
      }),
    ).toBe(HTML_CACHE_CONTROL_NO_STORE);
  });

  it("returns no-store for authenticated home route", () => {
    expect(resolveHtmlCacheControl({ pathname: "/", isAuthenticated: true })).toBe(
      HTML_CACHE_CONTROL_NO_STORE,
    );
  });

  it("returns no-store for authenticated public route", () => {
    expect(resolveHtmlCacheControl({ pathname: "/projetos", isAuthenticated: true })).toBe(
      HTML_CACHE_CONTROL_NO_STORE,
    );
  });

  it("returns no-store when pathname is invalid", () => {
    expect(resolveHtmlCacheControl({ pathname: "projetos", isAuthenticated: false })).toBe(
      HTML_CACHE_CONTROL_NO_STORE,
    );
  });

  it("adds Cookie to the HTML vary header", () => {
    expect(resolveHtmlVaryHeader("Accept-Encoding")).toBe("Accept-Encoding, Cookie");
  });

  it("keeps Cookie only once when vary already includes it", () => {
    expect(resolveHtmlVaryHeader("Accept-Encoding, Cookie")).toBe("Accept-Encoding, Cookie");
  });

  it("applies cache-control and vary headers for anonymous HTML responses", () => {
    const headers = new Map<string, string>();
    const res = {
      getHeader: (name: string) => headers.get(String(name)),
      setHeader: (name: string, value: unknown) => {
        headers.set(String(name), String(value));
      },
    };

    applyHtmlCachingHeaders(res, { pathname: "/projetos", isAuthenticated: false });

    expect(headers.get("Cache-Control")).toBe(HTML_CACHE_CONTROL_PRIVATE_REVALIDATE);
    expect(headers.get("Vary")).toBe(HTML_VARY_COOKIE);
  });
});
