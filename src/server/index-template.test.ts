import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexHtmlPath = path.resolve(__dirname, "../../index.html");

describe("index template", () => {
  it("mantem marcadores de bootstrap/preload sem script bloqueante externo", () => {
    const html = fs.readFileSync(indexHtmlPath, "utf-8");

    expect(html).not.toContain('<script src="/bootstrap-init.js"></script>');
    expect(html).not.toContain("(function () {");
    expect(html).toContain("<!-- APP_BOOTSTRAP -->");
    expect(html).toContain("<!-- APP_PRELOADS -->");
  });
});
