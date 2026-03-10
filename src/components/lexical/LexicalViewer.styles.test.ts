import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Lexical viewer styles", () => {
  it("mantem highlight com contraste reforcado e checklist sem role interativo no li", () => {
    const cssSource = readFileSync(
      resolve(process.cwd(), "src/components/lexical/lexical-viewer.css"),
      "utf8",
    );

    expect(cssSource).toContain("--lexical-viewer-highlight:");
    expect(cssSource).toContain("--lexical-viewer-highlight-border:");
    expect(cssSource).toContain("color: hsl(32 58% 18%);");
    expect(cssSource).toContain('li[data-lexical-checklist-item="true"]');
    expect(cssSource).toContain('data-lexical-checked="true"');
    expect(cssSource).toContain(".LexicalViewerTheme__textSubscript");
    expect(cssSource).toContain("line-height: 0;");
    expect(cssSource).toContain(".LexicalViewerTheme__textSuperscript");
  });

  it("mantem layout limpo para embeds, hr estrutural e spacing do viewer publico", () => {
    const cssSource = readFileSync(
      resolve(process.cwd(), "src/components/lexical/lexical-viewer.css"),
      "utf8",
    );
    const tokenCss = readFileSync(
      resolve(process.cwd(), "src/components/lexical/lexical-content-tokens.css"),
      "utf8",
    );
    const appCss = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

    expect(tokenCss).toContain("--lexical-content-font-size: 15px;");
    expect(tokenCss).toContain("--lexical-content-heading-1-size: 28px;");
    expect(tokenCss).toContain("--lexical-content-code-font-size: 13px;");
    expect(cssSource).toContain(".LexicalViewerTheme__embedBlock");
    expect(cssSource).toContain(".LexicalViewerTheme__hr::after");
    expect(cssSource).toContain("height: var(--lexical-content-hr-thickness, 2px);");
    expect(cssSource).toContain(".lexical-playground.lexical-playground--viewer .lexical-tweet");
    expect(cssSource).toContain(".lexical-tweet__target");
    expect(cssSource).toContain("clip-path: inset(0 round var(--lexical-content-embed-radius, 16px));");
    expect(cssSource).toContain(".twitter-tweet-rendered");
    expect(cssSource).toContain('iframe[src*="twitter.com"]');
    expect(cssSource).toContain(".lexical-playground.lexical-playground--viewer .lexical-youtube");
    expect(cssSource).toContain(".LexicalViewerTheme__code");
    expect(cssSource).toContain("font-size: var(--lexical-content-code-font-size, 13px);");
    expect(cssSource).toContain("white-space: pre;");
    expect(cssSource).toContain("overflow-x: auto;");
    expect(cssSource).toContain(".LexicalViewer__content > * + *");
    expect(cssSource).toContain(".Collapsible__container");
    expect(cssSource).toContain(".Collapsible__content");
    expect(appCss).toContain(".post-content:not(.lexical-playground--viewer) h1");
    expect(appCss).toContain(".reader-content:not(.lexical-playground--viewer) h1");
  });

  it("usa a mesma escala nativa no viewer e no editor sem atropelar o escopo global", () => {
    const viewerCss = readFileSync(
      resolve(process.cwd(), "src/components/lexical/lexical-viewer.css"),
      "utf8",
    );
    const editorThemeCss = readFileSync(
      resolve(process.cwd(), "src/lexical-playground/themes/PlaygroundEditorTheme.css"),
      "utf8",
    );
    const editorOverridesCss = readFileSync(
      resolve(process.cwd(), "src/lexical-playground/playground-overrides.css"),
      "utf8",
    );
    const editableCss = readFileSync(
      resolve(process.cwd(), "src/lexical-playground/ui/ContentEditable.css"),
      "utf8",
    );

    expect(viewerCss).toContain("font-size: var(--lexical-content-font-size, 15px);");
    expect(viewerCss).toContain("font-size: var(--lexical-content-heading-1-size, 28px);");
    expect(viewerCss).toContain("font-size: var(--lexical-content-heading-2-size, 18px);");
    expect(viewerCss).toContain("font-size: var(--lexical-content-heading-3-size, 15px);");
    expect(editorThemeCss).toContain("font-size: var(--lexical-content-heading-1-size, 28px);");
    expect(editorThemeCss).toContain("font-size: var(--lexical-content-heading-2-size, 18px);");
    expect(editorThemeCss).toContain("font-size: var(--lexical-content-heading-3-size, 15px);");
    expect(editorThemeCss).toContain("font-size: var(--lexical-content-code-font-size, 13px);");
    expect(editableCss).toContain("font-size: var(--lexical-content-font-size, 15px);");
    expect(editableCss).toContain("line-height: var(--lexical-content-line-height, 1.75);");
    expect(editorOverridesCss).toContain(".ContentEditable__root > * + *");
    expect(editorOverridesCss).toContain(".lexical-tweet__target");
  });
});
