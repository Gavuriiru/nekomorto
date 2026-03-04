import { describe, expect, it } from "vitest";

import { shouldUsePwaAppShell } from "@/lib/pwa-navigation";

describe("pwa-navigation", () => {
  it.each(["/dashboard", "/dashboard/posts", "/dashboard/posts?tab=scheduled"])(
    "uses the app shell for %s",
    (pathnameAndSearch) => {
      expect(shouldUsePwaAppShell(pathnameAndSearch)).toBe(true);
    },
  );

  it.each([
    "/auth/discord?next=%2Fdashboard",
    "/api/me",
    "/login",
    "/login?code=fake&state=fake",
    "/",
    "/projetos",
    "/postagem/teste",
  ])("does not use the app shell for %s", (pathnameAndSearch) => {
    expect(shouldUsePwaAppShell(pathnameAndSearch)).toBe(false);
  });
});
