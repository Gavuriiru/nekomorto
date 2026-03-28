import { describe, expect, it } from "vitest";

import {
  DIRECT_ROUTE_DEPENDENCY_KEYS,
  buildDirectRouteDependencies,
} from "../../server/bootstrap/build-direct-route-dependencies.js";
import {
  SERVER_ROUTE_DEPENDENCY_KEYS,
  buildServerRouteDependencySource,
} from "../../server/bootstrap/build-server-route-dependency-source.js";

const createNamedValue = (key) => ({ key });

const buildDirectRouteSource = (scopeName) => {
  const keys = DIRECT_ROUTE_DEPENDENCY_KEYS[scopeName];
  return keys.reduce((source, key) => {
    source[key] = key === "app" ? { use: () => {} } : createNamedValue(key);
    return source;
  }, {});
};

const buildServerRouteSource = () =>
  SERVER_ROUTE_DEPENDENCY_KEYS.reduce(
    (source, key) => {
      source[key] = createNamedValue(key);
      return source;
    },
    { app: { use: () => {} } },
  );

describe("server bootstrap dependency builders", () => {
  it("builds the requested direct route dependency scopes", () => {
    const sessionSource = buildDirectRouteSource("session");
    const authSource = buildDirectRouteSource("auth");

    const dependencies = buildDirectRouteDependencies(
      { routes: ["session", "auth"] },
      sessionSource,
      authSource,
      { ignored: true },
    );

    expect(dependencies.session.apiContractVersion).toEqual(createNamedValue("apiContractVersion"));
    expect(dependencies.auth.discordClientId).toEqual(createNamedValue("discordClientId"));
    expect(dependencies).not.toHaveProperty("operational");
  });

  it("fails fast when a required direct route dependency is undefined", () => {
    const authSource = buildDirectRouteSource("auth");
    authSource.discordClientSecret = undefined;

    expect(() =>
      buildDirectRouteDependencies({ routes: ["auth"] }, authSource),
    ).toThrow(/discordClientSecret/);
  });

  it("builds the server route dependency source from multiple fragments without leaking extras", () => {
    const source = buildServerRouteSource();
    const midPoint = Math.floor(SERVER_ROUTE_DEPENDENCY_KEYS.length / 2);
    const firstHalf = Object.fromEntries(
      SERVER_ROUTE_DEPENDENCY_KEYS.slice(0, midPoint).map((key) => [key, source[key]]),
    );
    const secondHalf = Object.fromEntries(
      SERVER_ROUTE_DEPENDENCY_KEYS.slice(midPoint).map((key) => [key, source[key]]),
    );

    const dependencies = buildServerRouteDependencySource(
      { app: source.app, ignoredRoot: true },
      firstHalf,
      secondHalf,
      { ignoredTail: true },
    );

    expect(dependencies.app).toBe(source.app);
    expect(dependencies.PRIMARY_APP_ORIGIN).toEqual(createNamedValue("PRIMARY_APP_ORIGIN"));
    expect(dependencies.resolveMetaImageVariantUrl).toEqual(
      createNamedValue("resolveMetaImageVariantUrl"),
    );
    expect(dependencies).not.toHaveProperty("ignoredRoot");
    expect(dependencies).not.toHaveProperty("ignoredTail");
  });

  it("fails fast when a required server route dependency is omitted", () => {
    const source = buildServerRouteSource();
    delete source.resolveMetaImageVariantUrl;

    expect(() => buildServerRouteDependencySource(source)).toThrow(
      /resolveMetaImageVariantUrl/,
    );
  });
});
