import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = path.resolve(process.cwd(), "src/index.css");
const cssSource = readFileSync(cssPath, "utf8");

describe("scrollbar gutter contract", () => {
  it("does not reserve symmetric global gutter space on the root document", () => {
    expect(cssSource).not.toContain("scrollbar-gutter: stable both-edges");
  });

  it("does not force permanent root vertical scroll as a fallback", () => {
    expect(cssSource).not.toMatch(
      /@supports not \(scrollbar-gutter: stable\)[\s\S]*overflow-y: scroll;/,
    );
  });
});
