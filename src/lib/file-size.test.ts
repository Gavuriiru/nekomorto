import { describe, expect, it } from "vitest";

import { formatBytesCompact, parseHumanSizeToBytes } from "@/lib/file-size";

describe("parseHumanSizeToBytes", () => {
  it("converte tamanhos validos para bytes", () => {
    expect(parseHumanSizeToBytes("700 MB")).toBe(734003200);
    expect(parseHumanSizeToBytes("1.4 GB")).toBe(1503238554);
    expect(parseHumanSizeToBytes("1024 KB")).toBe(1048576);
  });

  it("aceita decimal com virgula", () => {
    expect(parseHumanSizeToBytes("1,5 GB")).toBe(1610612736);
  });

  it("retorna null para entrada invalida", () => {
    expect(parseHumanSizeToBytes("abc")).toBeNull();
    expect(parseHumanSizeToBytes("12 ZB")).toBeNull();
    expect(parseHumanSizeToBytes("")).toBeNull();
    expect(parseHumanSizeToBytes("0 MB")).toBeNull();
  });
});

describe("formatBytesCompact", () => {
  it("formata bytes em unidades compactas", () => {
    expect(formatBytesCompact(1024)).toBe("1 KB");
    expect(formatBytesCompact(1048576)).toBe("1 MB");
    expect(formatBytesCompact(1503238554)).toBe("1.4 GB");
  });

  it("retorna string vazia para valor invalido", () => {
    expect(formatBytesCompact(0)).toBe("");
    expect(formatBytesCompact(-1)).toBe("");
    expect(formatBytesCompact(Number.NaN)).toBe("");
  });
});

