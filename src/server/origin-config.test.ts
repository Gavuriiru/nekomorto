import { describe, expect, it } from "vitest";

import {
  buildOriginConfig,
  isAllowedOrigin,
  resolveDiscordRedirectUri,
} from "../../server/lib/origin-config.js";

describe("origin-config", () => {
  it("requires APP_ORIGIN in production", () => {
    expect(() =>
      buildOriginConfig({
        appOriginEnv: "",
        adminOriginsEnv: "",
        discordRedirectUriEnv: "auto",
        isProduction: true,
      }),
    ).toThrow(/APP_ORIGIN/);
  });

  it("validates DISCORD_REDIRECT_URI when explicitly configured", () => {
    expect(() =>
      buildOriginConfig({
        appOriginEnv: "https://site.example.com",
        discordRedirectUriEnv: "/login",
        isProduction: true,
      }),
    ).toThrow(/DISCORD_REDIRECT_URI/);
  });

  it("allows only configured origins in production", () => {
    const config = buildOriginConfig({
      appOriginEnv: "https://site.example.com",
      adminOriginsEnv: "https://admin.example.com",
      isProduction: true,
    });

    expect(
      isAllowedOrigin({
        origin: "https://site.example.com",
        allowedOrigins: config.allowedOrigins,
        isProduction: true,
      }),
    ).toBe(true);
    expect(
      isAllowedOrigin({
        origin: "https://admin.example.com",
        allowedOrigins: config.allowedOrigins,
        isProduction: true,
      }),
    ).toBe(true);
    expect(
      isAllowedOrigin({
        origin: "http://localhost:5173",
        allowedOrigins: config.allowedOrigins,
        isProduction: true,
      }),
    ).toBe(false);
  });

  it("allows localhost and LAN in development", () => {
    const config = buildOriginConfig({
      appOriginEnv: "",
      adminOriginsEnv: "",
      isProduction: false,
    });

    expect(
      isAllowedOrigin({
        origin: "http://localhost:5173",
        allowedOrigins: config.allowedOrigins,
        isProduction: false,
      }),
    ).toBe(true);
    expect(
      isAllowedOrigin({
        origin: "http://192.168.1.25:3000",
        allowedOrigins: config.allowedOrigins,
        isProduction: false,
      }),
    ).toBe(true);
    expect(
      isAllowedOrigin({
        origin: "https://evil.example.com",
        allowedOrigins: config.allowedOrigins,
        isProduction: false,
      }),
    ).toBe(false);
  });

  it("resolves Discord redirect URI from request origin when using auto mode", () => {
    const config = buildOriginConfig({
      appOriginEnv: "https://site.example.com",
      discordRedirectUriEnv: "auto",
      isProduction: true,
    });
    const uri = resolveDiscordRedirectUri({
      req: {
        headers: { origin: "https://site.example.com" },
        protocol: "https",
      },
      configuredDiscordRedirectUri: config.configuredDiscordRedirectUri,
      primaryAppOrigin: config.primaryAppOrigin,
      isAllowedOriginFn: (origin) =>
        isAllowedOrigin({
          origin,
          allowedOrigins: config.allowedOrigins,
          isProduction: true,
        }),
    });

    expect(uri).toBe("https://site.example.com/login");
    expect(uri).not.toBe("auto");
  });

  it("uses explicit Discord redirect URI when configured", () => {
    const config = buildOriginConfig({
      appOriginEnv: "https://site.example.com",
      discordRedirectUriEnv: "https://auth.example.com/login",
      isProduction: true,
    });
    const uri = resolveDiscordRedirectUri({
      req: {
        headers: { origin: "https://site.example.com" },
        protocol: "https",
      },
      configuredDiscordRedirectUri: config.configuredDiscordRedirectUri,
      primaryAppOrigin: config.primaryAppOrigin,
      isAllowedOriginFn: () => true,
    });

    expect(uri).toBe("https://auth.example.com/login");
  });

  it("falls back to primary app origin when request origin is not allowed", () => {
    const config = buildOriginConfig({
      appOriginEnv: "https://site.example.com",
      discordRedirectUriEnv: "auto",
      isProduction: true,
    });
    const uri = resolveDiscordRedirectUri({
      req: {
        headers: { origin: "https://another.example.com" },
        protocol: "https",
      },
      configuredDiscordRedirectUri: config.configuredDiscordRedirectUri,
      primaryAppOrigin: config.primaryAppOrigin,
      isAllowedOriginFn: (origin) =>
        isAllowedOrigin({
          origin,
          allowedOrigins: config.allowedOrigins,
          isProduction: true,
        }),
    });

    expect(uri).toBe("https://site.example.com/login");
  });
});
