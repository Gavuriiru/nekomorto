import { describe, expect, it } from "vitest";
import { getPostStatusLabel } from "./dashboard-posts-types";

describe("getPostStatusLabel", () => {
  it("should return 'Publicado' for 'published' status", () => {
    expect(getPostStatusLabel("published")).toBe("Publicado");
  });

  it("should return 'Agendado' for 'scheduled' status", () => {
    expect(getPostStatusLabel("scheduled")).toBe("Agendado");
  });

  it("should return 'Rascunho' for 'draft' status", () => {
    expect(getPostStatusLabel("draft")).toBe("Rascunho");
  });

  it("should return 'Rascunho' for any other status (default case)", () => {
    // @ts-expect-error - testing invalid status
    expect(getPostStatusLabel("invalid" as any)).toBe("Rascunho");
  });
});
