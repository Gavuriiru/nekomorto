import { describe, expect, it } from "vitest";

import { shouldRegisterPwaImmediately, shouldUsePwaAppShell } from "@/lib/pwa-navigation";

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

  it("registers the PWA immediately on the home page when an older service worker already controls the page", () => {
    expect(
      shouldRegisterPwaImmediately({
        pathname: "/",
        hasServiceWorkerController: true,
      }),
    ).toBe(true);
  });

  it.each([
    { pathname: "/", hasServiceWorkerController: false },
    { pathname: "/dashboard", hasServiceWorkerController: true },
    { pathname: "/projetos", hasServiceWorkerController: true },
    { pathname: "/postagem/teste", hasServiceWorkerController: true },
  ])("does not register the PWA immediately for %#", (input) => {
    expect(shouldRegisterPwaImmediately(input)).toBe(false);
  });
});
