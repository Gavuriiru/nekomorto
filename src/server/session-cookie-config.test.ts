import { describe, expect, it } from "vitest";

import { buildSessionCookieConfig, isDefaultSessionSecretInProduction } from "../../server/lib/session-cookie-config.js";

describe("session-cookie-config", () => {
  it("mantem nome simples em dev e secure auto", () => {
    const config = buildSessionCookieConfig({
      isProduction: false,
      cookieBaseName: "rainbow.sid",
      sessionSecret: "",
    });

    expect(config.name).toBe("rainbow.sid");
    expect(config.cookie.secure).toBe("auto");
    expect(config.cookie.path).toBe("/");
    expect(config.usesDefaultSecretInProduction).toBe(false);
    expect(config.secret).toEqual(["dev-session-secret"]);
    expect(config.acceptedSecretsCount).toBe(1);
  });

  it("usa prefixo __Host- em producao e detecta secret fallback", () => {
    const config = buildSessionCookieConfig({
      isProduction: true,
      cookieBaseName: "rainbow.sid",
      sessionSecret: "",
    });

    expect(config.name).toBe("__Host-rainbow.sid");
    expect(config.cookie.secure).toBe(true);
    expect(config.usesDefaultSecretInProduction).toBe(true);
    expect(isDefaultSessionSecretInProduction({ isProduction: true, sessionSecret: "" })).toBe(true);
  });

  it("aceita rotacao com SESSION_SECRETS sem fallback", () => {
    const config = buildSessionCookieConfig({
      isProduction: true,
      cookieBaseName: "rainbow.sid",
      sessionSecret: "",
      sessionSecrets: "new-secret,old-secret",
    });

    expect(config.secret).toEqual(["new-secret", "old-secret"]);
    expect(config.activeSecret).toBe("new-secret");
    expect(config.acceptedSecretsCount).toBe(2);
    expect(config.usesDefaultSecretInProduction).toBe(false);
  });
});
