import { describe, expect, it } from "vitest";

import {
  createResolveBootstrapPwaEnabled,
  isLoopbackHostname,
  resolveBootstrapPwaRequestHostname,
} from "../../server/lib/pwa-bootstrap-policy.js";

describe("pwa-bootstrap-policy", () => {
  it("recognizes loopback-only hosts for dev pwa enablement", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("app.localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("dev.nekomata.moe")).toBe(false);
    expect(isLoopbackHostname("192.168.0.20")).toBe(false);
  });

  it("resolves the request hostname from express or host headers", () => {
    expect(
      resolveBootstrapPwaRequestHostname({
        hostname: "localhost",
      }),
    ).toBe("localhost");
    expect(
      resolveBootstrapPwaRequestHostname({
        headers: { host: "dev.nekomata.moe:443" },
      }),
    ).toBe("dev.nekomata.moe");
    expect(
      resolveBootstrapPwaRequestHostname({
        headers: { host: "[::1]:8080" },
      }),
    ).toBe("::1");
  });

  it("always enables bootstrap pwa in production", () => {
    const resolveBootstrapPwaEnabled = createResolveBootstrapPwaEnabled({
      isProduction: true,
      isPwaDevEnabled: false,
    });

    expect(
      resolveBootstrapPwaEnabled({
        hostname: "dev.nekomata.moe",
      }),
    ).toBe(true);
  });

  it("disables bootstrap pwa in development when the flag is off", () => {
    const resolveBootstrapPwaEnabled = createResolveBootstrapPwaEnabled({
      isProduction: false,
      isPwaDevEnabled: false,
    });

    expect(
      resolveBootstrapPwaEnabled({
        hostname: "localhost",
      }),
    ).toBe(false);
  });

  it("enables bootstrap pwa in dev only for loopback hosts", () => {
    const resolveBootstrapPwaEnabled = createResolveBootstrapPwaEnabled({
      isProduction: false,
      isPwaDevEnabled: true,
    });

    expect(
      resolveBootstrapPwaEnabled({
        hostname: "localhost",
      }),
    ).toBe(true);
    expect(
      resolveBootstrapPwaEnabled({
        headers: { host: "127.0.0.1:8080" },
      }),
    ).toBe(true);
    expect(
      resolveBootstrapPwaEnabled({
        hostname: "dev.nekomata.moe",
      }),
    ).toBe(false);
  });
});
