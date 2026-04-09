import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button-variants";

const classTokens = (value: string) => value.split(/\s+/).filter(Boolean);

describe("buttonVariants motion", () => {
  it("aplica motion compartilhado e lift sutil nas variantes CTA", () => {
    const variants = [
      "default",
      "secondary",
      "outline",
      "destructive",
    ] as const;

    variants.forEach((variant) => {
      const tokens = classTokens(buttonVariants({ variant }));
      expect(tokens).toContain("interactive-control-transition");
      expect(tokens).toContain("interactive-lift-sm");
    });
  });

  it("mantem ghost e link sem lift por padrao", () => {
    const ghostTokens = classTokens(buttonVariants({ variant: "ghost" }));
    const linkTokens = classTokens(buttonVariants({ variant: "link" }));

    expect(ghostTokens).toContain("interactive-control-transition");
    expect(linkTokens).toContain("interactive-control-transition");
    expect(ghostTokens).not.toContain("interactive-lift-sm");
    expect(linkTokens).not.toContain("interactive-lift-sm");
  });
});
