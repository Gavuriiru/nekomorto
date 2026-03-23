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

describe("dashboard list card title contract", () => {
  it("defines the shared admin card title recipe", () => {
    const block = extractBlock(/\.dashboard-list-card-title\s*\{([\s\S]*?)\n  \}/);

    expect(block).toContain("font-weight: 560;");
    expect(block).toContain("letter-spacing: -0.01em;");
    expect(block).toContain("color: hsl(var(--foreground) / 0.92);");
  });
});
