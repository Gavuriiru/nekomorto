import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = path.resolve(process.cwd(), "src/index.css");
const cssSource = readFileSync(cssPath, "utf8");

const extractBlock = (selectorPattern: RegExp) => {
  const match = cssSource.match(selectorPattern);
  if (!match) {
    throw new Error(`Could not find CSS block for ${selectorPattern}`);
  }
  return match[1];
};

describe("dashboard motion contract", () => {
  it("resets slide-up transforms after the enter animation finishes", () => {
    const slideUpBlock = extractBlock(/@keyframes slide-up\s*\{([\s\S]*?)\n  \}/);
    const toBlock = slideUpBlock.match(/to\s*\{([\s\S]*?)\n    \}/);

    expect(toBlock?.[1]).toContain("opacity: 1;");
    expect(toBlock?.[1]).toContain("transform: none;");
    expect(toBlock?.[1]).not.toContain("transform: translateY(0);");
  });

  it("clears reveal transforms and layer promotion once elements become visible", () => {
    const revealVisibleBlock = extractBlock(/\.reveal-visible\s*\{([\s\S]*?)\n  \}/);

    expect(revealVisibleBlock).toContain("opacity: 1;");
    expect(revealVisibleBlock).toContain("transform: none;");
    expect(revealVisibleBlock).toContain("will-change: auto;");
    expect(revealVisibleBlock).not.toContain("translateY(0) scale(1)");
  });
});
