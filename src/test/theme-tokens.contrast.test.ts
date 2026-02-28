import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type ThemeTokens = Record<string, string>;

const cssPath = path.resolve(process.cwd(), "src/index.css");
const cssSource = readFileSync(cssPath, "utf8");

const extractBlock = (selectorPattern: RegExp) => {
  const match = cssSource.match(selectorPattern);
  if (!match) {
    throw new Error(`Could not find CSS block for ${selectorPattern}`);
  }
  return match[1];
};

const parseTokens = (block: string): ThemeTokens => {
  const tokens: ThemeTokens = {};
  const tokenPattern = /--([a-z-]+):\s*([^;]+);/g;
  let match: RegExpExecArray | null = tokenPattern.exec(block);
  while (match) {
    tokens[match[1]] = match[2].trim();
    match = tokenPattern.exec(block);
  }
  return tokens;
};

const rootTokens = parseTokens(extractBlock(/:root\s*\{([\s\S]*?)\n  \}/));
const lightTokens = parseTokens(
  extractBlock(/:root\[data-theme-mode="light"\]\s*\{([\s\S]*?)\n  \}/),
);

const parseHslToken = (value: string) => {
  const match = String(value || "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) {
    throw new Error(`Unsupported color token: ${value}`);
  }
  return {
    h: Number(match[1]),
    s: Number(match[2]) / 100,
    l: Number(match[3]) / 100,
  };
};

const hslToRgb = ({ h, s, l }: { h: number; s: number; l: number }) => {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray] as const;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset: number) => {
    let t = hue + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(channel(1 / 3) * 255),
    Math.round(channel(0) * 255),
    Math.round(channel(-1 / 3) * 255),
  ] as const;
};

const relativeLuminance = (rgb: readonly [number, number, number]) => {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb.map(normalize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (first: string, second: string) => {
  const luminanceA = relativeLuminance(hslToRgb(parseHslToken(first)));
  const luminanceB = relativeLuminance(hslToRgb(parseHslToken(second)));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
};

const assertPair = (
  tokens: ThemeTokens,
  foregroundToken: string,
  backgroundToken: string,
  minimumRatio: number,
) => {
  expect(tokens[foregroundToken]).toBeTruthy();
  expect(tokens[backgroundToken]).toBeTruthy();
  expect(contrastRatio(tokens[foregroundToken], tokens[backgroundToken])).toBeGreaterThanOrEqual(
    minimumRatio,
  );
};

describe("theme token contrast", () => {
  it("keeps required text pairs at or above 4.5:1 in dark and light themes", () => {
    const textPairs: Array<[string, string]> = [
      ["foreground", "background"],
      ["card-foreground", "card"],
      ["popover-foreground", "popover"],
      ["secondary-foreground", "secondary"],
      ["muted-foreground", "muted"],
      ["accent-foreground", "accent"],
      ["destructive-foreground", "destructive"],
      ["sidebar-foreground", "sidebar-background"],
      ["sidebar-accent-foreground", "sidebar-accent"],
    ];

    textPairs.forEach(([foregroundToken, backgroundToken]) => {
      assertPair(rootTokens, foregroundToken, backgroundToken, 4.5);
      assertPair(lightTokens, foregroundToken, backgroundToken, 4.5);
    });
  });

  it("keeps focus indicators at or above 3:1 against the page background", () => {
    assertPair(rootTokens, "ring", "background", 3);
    assertPair(rootTokens, "sidebar-ring", "sidebar-background", 3);
    assertPair(lightTokens, "ring", "background", 3);
    assertPair(lightTokens, "sidebar-ring", "sidebar-background", 3);
  });
});
