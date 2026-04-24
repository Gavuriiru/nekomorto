import { describe, expect, it, vi } from "vitest";

import { applyThemeAccentVariables, deriveThemeAccentTokens } from "@/lib/theme-accent";

describe("deriveThemeAccentTokens", () => {
  it("gera foreground escuro para accents claros", () => {
    const tokens = deriveThemeAccentTokens("#4adffc");

    expect(tokens).not.toBeNull();
    expect(tokens?.primary).toBeTruthy();
    expect(tokens?.accent).toBeTruthy();
    expect(tokens?.primaryForeground).toBe("224 41% 12%");
    expect(tokens?.accentForeground).toBe("224 41% 12%");
  });
});

describe("applyThemeAccentVariables", () => {
  it("aplica variaveis compartilhadas da accent e do loader", () => {
    const style = {
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
    };

    applyThemeAccentVariables(style, "#34A853");

    expect(style.setProperty).toHaveBeenCalledWith("--app-loader-accent", "#34a853");
    expect(style.setProperty).toHaveBeenCalledWith(
      "--app-loader-accent-soft",
      "rgba(52, 168, 83, 0.2)",
    );
    expect(style.removeProperty).not.toHaveBeenCalled();
  });

  it("remove variaveis compartilhadas quando a accent nao existe", () => {
    const style = {
      setProperty: vi.fn(),
      removeProperty: vi.fn(),
    };

    applyThemeAccentVariables(style, "");

    expect(style.setProperty).not.toHaveBeenCalled();
    expect(style.removeProperty).toHaveBeenCalledWith("--app-loader-accent");
    expect(style.removeProperty).toHaveBeenCalledWith("--app-loader-accent-soft");
  });
});
