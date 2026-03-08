import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Lexical viewer/editor shared styles", () => {
  it("usa tokens de tema para a tabela compartilhada do lexical", () => {
    const cssSource = readFileSync(
      resolve(process.cwd(), "src/lexical-playground/playground-overrides.css"),
      "utf8",
    );

    expect(cssSource).toContain("--lexical-table-background: hsl(var(--background));");
    expect(cssSource).toContain("--lexical-table-background-header: hsl(var(--muted));");
    expect(cssSource).toContain("--lexical-table-selection: hsl(var(--primary) / 0.22);");
    expect(cssSource).toContain(".lexical-playground .PlaygroundEditorTheme__tableFrozenRow tr:nth-of-type(1) > th");
    expect(cssSource).toContain(".lexical-playground .PlaygroundEditorTheme__tableAddColumns");
    expect(cssSource).toContain(".lexical-playground .PlaygroundEditorTheme__tableCellSelected::after");
  });

  it("remove chrome editorial do layout no viewer e limita o youtube", () => {
    const overrideCss = readFileSync(
      resolve(process.cwd(), "src/lexical-playground/playground-overrides.css"),
      "utf8",
    );
    const appCss = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

    expect(overrideCss).toContain(
      ".lexical-playground.lexical-playground--viewer .PlaygroundEditorTheme__layoutItem",
    );
    expect(overrideCss).toContain(
      '.lexical-playground.lexical-playground--viewer [data-lexical-layout-item="true"]',
    );
    expect(overrideCss).toContain(".lexical-playground .lexical-tweet {");
    expect(overrideCss).toContain("overflow: hidden;");
    expect(overrideCss).toContain("background: hsl(var(--card));");
    expect(overrideCss).toContain(".lexical-playground.lexical-playground--viewer .lexical-youtube");
    expect(overrideCss).toContain("max-width: 560px;");
    expect(appCss).toMatch(
      /\.post-content \.lexical-video iframe,\s*\.post-content iframe\[data-lexical-node=\"video\"\]/,
    );
    expect(appCss).toContain('.post-content iframe[data-lexical-youtube]');
    expect(appCss).not.toMatch(/\.post-content iframe\s*\{/);
  });
});
