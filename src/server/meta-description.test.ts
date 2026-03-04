import { describe, expect, it } from "vitest";

import {
  MAX_META_DESCRIPTION_CHARS,
  truncateMetaDescription,
} from "../../server/lib/meta-description.js";

describe("meta description helper", () => {
  it("keeps short text unchanged", () => {
    const value = "Descricao curta para metadados.";
    expect(truncateMetaDescription(value)).toBe(value);
  });

  it("truncates long text to max length with ellipsis", () => {
    const value =
      "Este é um texto de descrição extremamente longo para validar o truncamento automático dos metadados e garantir que não ultrapasse o limite definido para SEO e compartilhamento social.";
    const result = truncateMetaDescription(value, 80);

    expect(result.length).toBeLessThanOrEqual(80);
    expect(result.endsWith("…")).toBe(true);
  });

  it("normalizes whitespace and strips html tags", () => {
    const value = "  <p>Descricao   com  <strong>HTML</strong>  e \n\n espaços</p>  ";
    const result = truncateMetaDescription(value);

    expect(result).toBe("Descricao com HTML e espaços");
  });

  it("uses default limit when max is invalid", () => {
    const value = "x".repeat(MAX_META_DESCRIPTION_CHARS + 30);
    const result = truncateMetaDescription(value, Number.NaN);

    expect(result.length).toBeLessThanOrEqual(MAX_META_DESCRIPTION_CHARS);
  });
});
