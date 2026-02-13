import { describe, expect, it } from "vitest";
import { createSlug, createUniqueSlug } from "../../server/lib/post-slug.js";

describe("createSlug", () => {
  it("normaliza um valor para slug", () => {
    expect(createSlug("  Meu Post!!!  ")).toBe("meu-post");
  });
});

describe("createUniqueSlug", () => {
  it("retorna o slug base quando nao ha conflito", () => {
    expect(createUniqueSlug("Meu Post", ["outro-post"])).toBe("meu-post");
  });

  it("adiciona sufixo -2 quando o slug ja existe", () => {
    expect(createUniqueSlug("Meu Post", ["meu-post"])).toBe("meu-post-2");
  });

  it("busca o proximo indice livre em conflitos encadeados", () => {
    expect(createUniqueSlug("Meu Post", ["meu-post", "meu-post-2", "meu-post-3"])).toBe("meu-post-4");
  });

  it("retorna vazio quando o valor nao gera slug valido", () => {
    expect(createUniqueSlug("!!!", ["post"])).toBe("");
  });

  it("normaliza entrada e slugs existentes antes de deduplicar", () => {
    expect(createUniqueSlug("Meu   Post", ["MEU-POST", "meu-post-2"])).toBe("meu-post-3");
  });
});
