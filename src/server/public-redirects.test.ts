import { describe, expect, it } from "vitest";

import {
  isReservedRedirectPath,
  normalizePublicRedirects,
  resolvePublicRedirect,
} from "../../server/lib/public-redirects.js";

describe("public redirects normalization", () => {
  it("normaliza regras validas, remove duplicadas e bloqueia reservadas", () => {
    const rules = normalizePublicRedirects([
      { id: "a", from: "/antigo", to: "/novo", enabled: true },
      { id: "dup", from: "/antigo/", to: "/novo-2", enabled: true },
      { id: "api", from: "/api/legacy", to: "/x", enabled: true },
      { id: "bad", from: "javascript:alert(1)", to: "/x", enabled: true },
      { id: "ext", from: "/externo", to: "https://example.org/path?x=1", enabled: true },
      { id: "off", from: "/off", to: "/desligado", enabled: false },
    ]);

    expect(rules).toEqual([
      { id: "a", from: "/antigo", to: "/novo", enabled: true },
      { id: "ext", from: "/externo", to: "https://example.org/path?x=1", enabled: true },
      { id: "off", from: "/off", to: "/desligado", enabled: false },
    ]);
  });

  it("marca caminhos sensiveis como reservados", () => {
    expect(isReservedRedirectPath("/api/public/posts")).toBe(true);
    expect(isReservedRedirectPath("/uploads/shared/file.jpg")).toBe(true);
    expect(isReservedRedirectPath("/assets/index-abc123.js")).toBe(true);
    expect(isReservedRedirectPath("/blog/antigo")).toBe(false);
  });
});

describe("public redirects resolution", () => {
  it("resolve 301 por match exato com preservacao de query", () => {
    const redirects = normalizePublicRedirects([
      { from: "/antigo", to: "/novo?lang=pt", enabled: true },
    ]);
    const match = resolvePublicRedirect({
      redirects,
      pathname: "/antigo/",
      search: "?utm_source=test",
    });

    expect(match).toEqual(
      expect.objectContaining({
        statusCode: 301,
        location: "/novo?lang=pt&utm_source=test",
      }),
    );
  });

  it("nao redireciona regras desativadas ou caminhos sem match", () => {
    const redirects = normalizePublicRedirects([
      { from: "/desativado", to: "/destino", enabled: false },
    ]);

    expect(
      resolvePublicRedirect({
        redirects,
        pathname: "/desativado",
        search: "",
      }),
    ).toBeNull();

    expect(
      resolvePublicRedirect({
        redirects,
        pathname: "/nao-existe",
        search: "",
      }),
    ).toBeNull();
  });
});
