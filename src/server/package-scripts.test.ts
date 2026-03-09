import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const packageJsonPath = path.resolve(process.cwd(), "package.json");

describe("package.json scripts", () => {
  it("prepara prisma antes do dev integrado e do dev do servidor", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    expect(packageJson.scripts["prisma:prepare"]).toBe(
      "npm run prisma:generate && npm run prisma:migrate:deploy",
    );
    expect(packageJson.scripts.predev).toBe("npm run prisma:prepare");
    expect(packageJson.scripts["predev:server"]).toBe("npm run prisma:prepare");
  });
});
