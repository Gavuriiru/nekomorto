import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoFile = (relativePath: string) => path.resolve(process.cwd(), relativePath);

const focusContractFiles = [
  {
    path: "src/components/ui/button-variants.ts",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/input.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/textarea.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/select.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/checkbox.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/radio-group.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/switch.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/slider.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/toggle-variants.ts",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/tabs.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/input-otp.tsx",
    expectedTokens: ["ring-2", "ring-ring/45"],
  },
  {
    path: "src/components/ui/dialog.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/sheet.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/toast.tsx",
    expectedTokens: ["focus:ring-2", "focus:ring-ring/45"],
  },
  {
    path: "src/components/ui/resizable.tsx",
    expectedTokens: ["focus-visible:ring-1", "focus-visible:ring-ring/55"],
  },
  {
    path: "src/components/ui/color-picker.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/PostContentEditor.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/pages/Projects.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-primary/45"],
  },
  {
    path: "src/pages/DashboardProjectChapterEditor.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-primary/45"],
  },
];

const forbiddenFocusTokens = ["ring-offset-background", "ring-offset-2", "ring-offset-1"];

describe("focus ring contract", () => {
  it("removes light offset rings from shared focus primitives", () => {
    focusContractFiles.forEach(({ path: relativePath, expectedTokens }) => {
      const source = readFileSync(repoFile(relativePath), "utf8");

      forbiddenFocusTokens.forEach((token) => {
        expect(source, `${relativePath} should not include ${token}`).not.toContain(token);
      });

      expectedTokens.forEach((token) => {
        expect(source, `${relativePath} should include ${token}`).toContain(token);
      });
    });
  });

  it("suppresses visible outlines on focus jump targets", () => {
    const cssSource = readFileSync(repoFile("src/index.css"), "utf8");

    expect(cssSource).toContain(".a11y-focus-target:focus");
    expect(cssSource).toContain(".a11y-focus-target:focus-visible");
    expect(cssSource).toContain("box-shadow: none;");
    expect(cssSource).toContain("outline: none;");
  });
});
