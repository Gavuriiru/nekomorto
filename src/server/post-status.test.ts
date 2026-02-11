import { describe, expect, it } from "vitest";
import { resolvePostStatus } from "../../server/lib/post-status.js";

describe("resolvePostStatus", () => {
  const nowMs = Date.parse("2026-02-11T12:00:00.000Z");
  const past = "2026-02-11T11:59:00.000Z";
  const future = "2026-02-11T12:01:00.000Z";

  it("promove scheduled para published quando publishedAt ja passou", () => {
    expect(resolvePostStatus("scheduled", past, nowMs)).toBe("published");
  });

  it("mantem scheduled quando publishedAt ainda esta no futuro", () => {
    expect(resolvePostStatus("scheduled", future, nowMs)).toBe("scheduled");
  });

  it("mantem draft mesmo quando a data ja passou", () => {
    expect(resolvePostStatus("draft", past, nowMs)).toBe("draft");
  });

  it("mantem published mesmo quando a data esta no futuro", () => {
    expect(resolvePostStatus("published", future, nowMs)).toBe("published");
  });

  it("status invalido com data futura vira scheduled", () => {
    expect(resolvePostStatus("invalid", future, nowMs)).toBe("scheduled");
  });

  it("status invalido com data passada vira published", () => {
    expect(resolvePostStatus("invalid", past, nowMs)).toBe("published");
  });
});
