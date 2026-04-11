import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button-variants";

const classTokens = (value: string) => value.split(/\s+/).filter(Boolean);

const expectNoLiftPressOrHoverShadow = (tokens: string[]) => {
  expect(tokens).not.toContain("pressable");
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens.some((token) => token.startsWith("hover:shadow"))).toBe(false);
  expect(tokens.some((token) => token.includes("transform"))).toBe(false);
  expect(tokens.some((token) => token.includes("translate"))).toBe(false);
  expect(tokens.some((token) => token.includes("scale-"))).toBe(false);
};

describe("buttonVariants", () => {
  it("aplica a identidade global sem lift, press ou hover shadow", () => {
    const variants = [
      "default",
      "secondary",
      "outline",
      "destructive",
      "ghost",
    ] as const;

    variants.forEach((variant) => {
      const tokens = classTokens(buttonVariants({ variant }));
      expect(tokens).toEqual(
        expect.arrayContaining(["rounded-xl", "font-semibold", "shadow-none"]),
      );
      expectNoLiftPressOrHoverShadow(tokens);
    });
  });

  it("preserva hierarquia por cor e superficie", () => {
    const defaultTokens = classTokens(buttonVariants({ variant: "default" }));
    const destructiveTokens = classTokens(buttonVariants({ variant: "destructive" }));
    const outlineTokens = classTokens(buttonVariants({ variant: "outline" }));
    const secondaryTokens = classTokens(buttonVariants({ variant: "secondary" }));
    const ghostTokens = classTokens(buttonVariants({ variant: "ghost" }));

    expect(defaultTokens).toEqual(
      expect.arrayContaining([
        "border-primary/70",
        "bg-primary/10",
        "text-foreground",
        "hover:border-primary",
        "hover:bg-primary",
        "hover:text-primary-foreground",
        "focus-visible:border-primary",
        "focus-visible:bg-primary",
        "focus-visible:text-primary-foreground",
      ]),
    );
    expect(destructiveTokens).toEqual(
      expect.arrayContaining(["border-destructive/40", "bg-destructive/10", "text-destructive"]),
    );
    [outlineTokens, secondaryTokens, ghostTokens].forEach((tokens) => {
      expect(tokens).toEqual(
        expect.arrayContaining(["border-border/70", "bg-background", "text-foreground/70"]),
      );
    });
  });

  it("mantem link como link textual", () => {
    const tokens = classTokens(buttonVariants({ variant: "link" }));

    expect(tokens).toEqual(
      expect.arrayContaining([
        "bg-transparent",
        "px-0",
        "py-0",
        "text-primary",
        "underline-offset-4",
      ]),
    );
    expect(tokens).not.toContain("bg-primary");
    expectNoLiftPressOrHoverShadow(tokens);
  });

  it("inclui tamanhos compactos usados pela dashboard", () => {
    const toolbarTokens = classTokens(buttonVariants({ size: "toolbar" }));
    const compactTokens = classTokens(buttonVariants({ size: "compact" }));
    const iconTokens = classTokens(buttonVariants({ size: "icon" }));
    const smallIconTokens = classTokens(buttonVariants({ size: "icon-sm" }));

    expect(toolbarTokens).toEqual(expect.arrayContaining(["h-10", "px-4"]));
    expect(compactTokens).toEqual(expect.arrayContaining(["h-8", "px-2.5"]));
    expect(iconTokens).toEqual(expect.arrayContaining(["h-9", "w-9", "p-0"]));
    expect(smallIconTokens).toEqual(expect.arrayContaining(["h-8", "w-8", "p-0"]));
  });
});
