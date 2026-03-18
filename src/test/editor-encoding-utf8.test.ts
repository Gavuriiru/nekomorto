import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const editorGuardFiles = [
  "src/pages/DashboardProjectChapterEditor.tsx",
  "src/components/project-reader/MangaWorkflowPanel.tsx",
  "src/components/project-reader/MangaChapterPagesEditor.tsx",
  "src/components/project-reader/MangaImportExportPanel.tsx",
  "src/components/project-reader/MangaPageTile.tsx",
  "src/lib/project-epub.ts",
];

const unicodeEscapeGuardFiles: Array<{
  path: string;
  allowedEscapes: string[];
}> = [
  { path: "src/pages/DashboardProjectChapterEditor.tsx", allowedEscapes: [] },
  { path: "src/components/project-reader/MangaWorkflowPanel.tsx", allowedEscapes: ["\\u0001"] },
  { path: "src/components/project-reader/MangaChapterPagesEditor.tsx", allowedEscapes: [] },
  { path: "src/components/project-reader/MangaImportExportPanel.tsx", allowedEscapes: [] },
  { path: "src/components/project-reader/MangaPageTile.tsx", allowedEscapes: [] },
  { path: "src/lib/project-epub.ts", allowedEscapes: [] },
];

const mojibakePattern = /(?:\u00C3.|\u00E2.|\uFFFD)/;
const unicodeEscapePattern = /\\u[0-9a-fA-F]{4}/g;

describe("editor utf8 encoding guard", () => {
  it("nao possui mojibake nos arquivos do editor de light novel e manga", () => {
    editorGuardFiles.forEach((relativePath) => {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const source = readFileSync(absolutePath, "utf8");
      expect(source, `mojibake detectado em ${relativePath}`).not.toMatch(mojibakePattern);
    });
  });

  it("nao possui escapes unicode nos textos de UI desses editores", () => {
    unicodeEscapeGuardFiles.forEach(({ path: relativePath, allowedEscapes }) => {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const source = readFileSync(absolutePath, "utf8");
      const unicodeEscapes = source.match(unicodeEscapePattern) || [];
      const unexpectedEscapes = unicodeEscapes.filter((escape) => !allowedEscapes.includes(escape));
      expect(
        unexpectedEscapes,
        `escape unicode nao permitido em ${relativePath}`,
      ).toEqual([]);
    });
  });
});
