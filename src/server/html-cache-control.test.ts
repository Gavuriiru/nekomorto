import { describe, expect, it } from "vitest";

import {
  HTML_CACHE_CONTROL_NO_STORE,
  HTML_CACHE_CONTROL_PRIVATE_REVALIDATE,
  resolveHtmlCacheControl,
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
});
