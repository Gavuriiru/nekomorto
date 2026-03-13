import { describe, expect, it } from "vitest";

import { buildProjectPublicHref, buildProjectPublicReadingHref } from "@/lib/project-editor-routes";

describe("project editor public routes", () => {
  it("normaliza a rota pública do projeto a partir do id", () => {
    expect(buildProjectPublicHref(" Projeto Exemplo 2026 ")).toBe("/projeto/projeto-exemplo-2026");
    expect(buildProjectPublicHref("")).toBe("/projetos");
  });

  it("reutiliza a normalização na rota pública de leitura", () => {
    expect(buildProjectPublicReadingHref("Projeto Exemplo 2026", 7, 2)).toBe(
      "/projeto/projeto-exemplo-2026/leitura/7?volume=2",
    );
  });
});
