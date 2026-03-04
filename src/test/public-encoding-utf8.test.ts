import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const mojibakeGuardFiles = [
  "src/main.tsx",
  "src/pages/Index.tsx",
  "src/components/HeroSection.tsx",
  "src/components/ReleasesSection.tsx",
  "src/components/WorkStatusCard.tsx",
  "server/index.js",
];

const unicodeEscapeGuardFiles: Array<{
  path: string;
  allowedEscapes: string[];
}> = [
  { path: "src/main.tsx", allowedEscapes: [] },
  { path: "src/pages/Index.tsx", allowedEscapes: [] },
  { path: "src/components/ReleasesSection.tsx", allowedEscapes: [] },
  { path: "src/components/dashboard/DashboardCommandPalette.tsx", allowedEscapes: [] },
  { path: "src/pages/DashboardPosts.tsx", allowedEscapes: [] },
  { path: "src/components/ImageLibraryDialog.tsx", allowedEscapes: ["\\u0001"] },
];

const mojibakePattern = /(?:\u00C3.|\u00E2.|\uFFFD)/;
const unicodeEscapePattern = /\\u[0-9a-fA-F]{4}/g;

describe("public utf8 encoding guard", () => {
  it("nao possui mojibake em arquivos criticos da home publica", () => {
    mojibakeGuardFiles.forEach((relativePath) => {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const source = readFileSync(absolutePath, "utf8");
      expect(source, `mojibake detectado em ${relativePath}`).not.toMatch(mojibakePattern);
    });
  });

  it("nao possui escapes unicode em textos de UI criticos", () => {
    unicodeEscapeGuardFiles.forEach(({ path: relativePath, allowedEscapes }) => {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const source = readFileSync(absolutePath, "utf8");
      const unicodeEscapes = source.match(unicodeEscapePattern) || [];
      const unexpectedEscapes = unicodeEscapes.filter((escape) => !allowedEscapes.includes(escape));
      expect(unexpectedEscapes, `escape unicode nao permitido em ${relativePath}`).toEqual([]);
    });
  });
});
