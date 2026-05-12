import { describe, expect, it } from "vitest";

import { formatDate } from "@/lib/date";

describe("formatDate", () => {
  it("formats public dates in UTC for SSR/client consistency", () => {
    expect(formatDate("2026-05-12T23:30:00.000Z", "en-US")).toBe("5/12/26");
    expect(formatDate("2026-05-12", "en-US")).toBe("5/12/26");
  });
});
