import { describe, expect, it } from "vitest";

import { getCanonicalPageUrl } from "@/lib/canonical-url";

describe("getCanonicalPageUrl", () => {
  it("remove querystring e hash", () => {
    expect(getCanonicalPageUrl("https://example.com/postagem/foo?utm_source=x#secao")).toBe(
      "https://example.com/postagem/foo",
    );
  });

  it("retorna vazio para entrada invalida", () => {
    expect(getCanonicalPageUrl("::::")).toBe("");
  });
});

