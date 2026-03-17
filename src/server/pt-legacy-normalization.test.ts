import { describe, expect, it } from "vitest";

import {
  normalizeLegacyInviteCardText,
  normalizeLegacyUpdateRecord,
} from "../../server/lib/pt-legacy-normalization.js";

describe("pt legacy normalization", () => {
  it("normalizes legacy update fields with accentuation", () => {
    const normalized = normalizeLegacyUpdateRecord({
      kind: "Lancamento",
      unit: "Capitulo",
      reason: "Capitulo 12 disponivel com conteudo e atualizacoes",
    });

    expect(normalized).toEqual({
      kind: "Lançamento",
      unit: "Capítulo",
      reason: "Capítulo 12 disponível com conteúdo e atualizações",
    });
  });

  it("keeps update fields untouched when already normalized", () => {
    const input = {
      kind: "Ajuste",
      unit: "Extra",
      reason: 'Conteúdo ajustado no extra "Afterword"',
    };

    expect(normalizeLegacyUpdateRecord(input)).toBe(input);
  });

  it("migrates only known legacy invite card texts", () => {
    expect(
      normalizeLegacyInviteCardText(
        "Receba alertas de lancamentos, participe de eventos e fale sobre os nossos projetos.",
      ),
    ).toBe("Receba alertas de lançamentos, participe de eventos e fale sobre os nossos projetos.");

    expect(normalizeLegacyInviteCardText("Texto personalizado sem mudança")).toBe(
      "Texto personalizado sem mudança",
    );
  });
});
