import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_COLOR,
  resolveRouteThemeColor,
  resolveThemeColorSection,
} from "@/lib/route-theme-color";

describe("route theme color resolver (client)", () => {
  it("classifies known route sections", () => {
    expect(resolveThemeColorSection("/")).toBe("home");
    expect(resolveThemeColorSection("/projetos")).toBe("projects");
    expect(resolveThemeColorSection("/postagem/um-post")).toBe("post");
    expect(resolveThemeColorSection("/dashboard/posts")).toBe("dashboard");
    expect(resolveThemeColorSection("/algo-aleatorio")).toBe("default");
  });

  it("returns distinct colors for route sections", () => {
    const accent = "#9667e0";
    const home = resolveRouteThemeColor({ pathname: "/", accentHex: accent });
    const projects = resolveRouteThemeColor({ pathname: "/projetos", accentHex: accent });
    const post = resolveRouteThemeColor({ pathname: "/postagem/slug", accentHex: accent });
    const dashboard = resolveRouteThemeColor({ pathname: "/dashboard/posts", accentHex: accent });

    expect(projects).not.toBe(home);
    expect(post).not.toBe(home);
    expect(dashboard).not.toBe(home);
    expect(home).toMatch(/^#[0-9a-f]{6}$/);
    expect(projects).toMatch(/^#[0-9a-f]{6}$/);
    expect(post).toMatch(/^#[0-9a-f]{6}$/);
    expect(dashboard).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("falls back to default accent on invalid accent values", () => {
    const unknown = resolveRouteThemeColor({ pathname: "/rota-desconhecida", accentHex: "oops" });
    const unknownWithDefault = resolveRouteThemeColor({
      pathname: "/rota-desconhecida",
      accentHex: DEFAULT_THEME_COLOR,
    });
    const projectsWithInvalidAccent = resolveRouteThemeColor({
      pathname: "/projetos",
      accentHex: "invalid",
    });
    const projectsWithDefaultAccent = resolveRouteThemeColor({
      pathname: "/projetos",
      accentHex: DEFAULT_THEME_COLOR,
    });

    expect(unknown).toBe(DEFAULT_THEME_COLOR);
    expect(unknown).toBe(unknownWithDefault);
    expect(projectsWithInvalidAccent).toBe(projectsWithDefaultAccent);
  });
});
