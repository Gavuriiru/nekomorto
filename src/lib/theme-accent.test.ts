import { describe, expect, it } from "vitest";

import { deriveThemeAccentTokens } from "@/lib/theme-accent";

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
