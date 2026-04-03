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

describe("clamp safe contract", () => {
  it("defines shared clamp-safe utilities with descender padding compensation", () => {
    const baseBlock = extractBlock(/\.clamp-safe-1,\s*\n\s*\.clamp-safe-2\s*\{([\s\S]*?)\n  \}/);

    expect(baseBlock).toContain("--clamp-safe-padding-bottom: 0.12em;");
    expect(baseBlock).toContain("display: -webkit-box;");
    expect(baseBlock).toContain("-webkit-box-orient: vertical;");
    expect(baseBlock).toContain("overflow: hidden;");
    expect(baseBlock).toContain("padding-bottom: var(--clamp-safe-padding-bottom);");
    expect(baseBlock).toContain("margin-bottom: calc(-1 * var(--clamp-safe-padding-bottom));");

    expect(cssSource).toMatch(
      /\.clamp-safe-1\s*\{[\s\S]*?line-clamp: 1;[\s\S]*?-webkit-line-clamp: 1;[\s\S]*?\n  \}/,
    );
    expect(cssSource).toMatch(
      /\.clamp-safe-2\s*\{[\s\S]*?line-clamp: 2;[\s\S]*?-webkit-line-clamp: 2;[\s\S]*?\n  \}/,
    );
  });

  it("defines the large-screen single-line clamp override for dashboard cards", () => {
    const largeScreenClampBlock = extractBlock(
      /@media \(min-width: 1024px\)\s*\{[\s\S]*?\.lg\\:clamp-safe-1\s*\{([\s\S]*?)\n    \}/,
    );

    expect(largeScreenClampBlock).toContain("display: -webkit-box;");
    expect(largeScreenClampBlock).toContain("overflow: hidden;");
    expect(largeScreenClampBlock).toContain("line-clamp: 1;");
    expect(largeScreenClampBlock).toContain("-webkit-line-clamp: 1;");
  });
});
