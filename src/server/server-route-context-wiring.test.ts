import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("server route context wiring", () => {
  it("passes upload scope helpers into createServerRouteContext from server/index.js", () => {
    const serverIndexPath = path.resolve(process.cwd(), "server/index.js");
    const source = fs.readFileSync(serverIndexPath, "utf-8");

    expect(source).toMatch(
      /registerServerRoutes\(\s*createServerRouteContext\(\{[\s\S]*\bnormalizeUploadScopeUserId,\s*[\s\S]*\bresolveRequestUploadAccessScope,\s*[\s\S]*\}\),\s*\)\s*;/,
    );
  });
});
