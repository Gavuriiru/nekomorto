import { describe, expect, it } from "vitest";
import { buildStaticPixPayload } from "@/lib/pix";

describe("buildStaticPixPayload", () => {
  it("reproduz o exemplo estatico do Bacen", () => {
    expect(
      buildStaticPixPayload({
        pixKey: "123e4567-e12b-12d1-a456-426655440000",
        merchantName: "Fulano de Tal",
        merchantCity: "BRASILIA",
        txid: "***",
      }),
    ).toBe(
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
    );
  });

  it("inclui e trunca o infoAdicional para caber no template 26", () => {
    const payload = buildStaticPixPayload({
      pixKey: "abc",
      merchantName: "Nekomata",
      merchantCity: "CIDADE",
      additionalInfo: "x".repeat(80),
      txid: "***",
    });

    expect(payload).toContain(`0270${"x".repeat(70)}`);
    expect(payload).not.toContain(`0271${"x".repeat(71)}`);
  });

  it("omite o infoAdicional quando nao sobra espaco no template 26", () => {
    const payload = buildStaticPixPayload({
      pixKey: "x".repeat(77),
      merchantName: "Nekomata",
      merchantCity: "CIDADE",
      additionalInfo: "nota",
      txid: "***",
    });

    expect(payload).toContain("2699");
    expect(payload).not.toContain("0204nota");
  });

  it("sanitiza e trunca merchant name e merchant city", () => {
    const payload = buildStaticPixPayload({
      pixKey: "abc",
      merchantName: "  Jos\u00e9   da Silva com nome enorme  ",
      merchantCity: "  S\u00e3o  Paulo\tCentro  ",
      txid: "***",
    });

    expect(payload).toContain("5925Jose da Silva com nome en");
    expect(payload).toContain("6015Sao Paulo Centr");
  });

  it("mantem um payload valido com a cidade fallback", () => {
    const payload = buildStaticPixPayload({
      pixKey: "abc",
      merchantName: "Nekomata",
      merchantCity: "CIDADE",
      txid: "***",
    });

    expect(payload).toContain("6006CIDADE");
  });

  it("retorna vazio quando a chave Pix e invalida para o template 26", () => {
    expect(
      buildStaticPixPayload({
        pixKey: "x".repeat(78),
        merchantName: "Nekomata",
        merchantCity: "CIDADE",
        txid: "***",
      }),
    ).toBe("");

    expect(
      buildStaticPixPayload({
        pixKey: "x".repeat(100),
        merchantName: "Nekomata",
        merchantCity: "CIDADE",
        txid: "***",
      }),
    ).toBe("");
  });
});
