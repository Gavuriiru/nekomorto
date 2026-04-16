import { describe, expect, it } from "vitest";

import {
  resolveBundledNpmCliPath,
  resolveNpmInvocation,
} from "../../scripts/lib/npm-invocation.mjs";

describe("npm invocation helper", () => {
  it("falls back to the bundled npm-cli.js next to node on Windows", () => {
    const execPath = "C:\\Program Files\\nodejs\\node.exe";
    const bundledPath = resolveBundledNpmCliPath({
      execPath,
      platform: "win32",
    });
    const result = resolveNpmInvocation(["exec", "--", "prisma", "migrate", "deploy"], {
      platform: "win32",
      execPath,
      existsSync: (candidatePath) => candidatePath === bundledPath,
    });

    expect(result).toEqual({
      command: execPath,
      args: [bundledPath, "exec", "--", "prisma", "migrate", "deploy"],
    });
  });

  it("uses the direct npm.cmd fallback on Windows when no npm CLI path is discoverable", () => {
    const result = resolveNpmInvocation(["run", "dev"], {
      platform: "win32",
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      existsSync: () => false,
    });

    expect(result).toEqual({
      command: "npm.cmd",
      args: ["run", "dev"],
    });
  });

  it("uses the plain npm binary outside Windows when npm-specific paths are unavailable", () => {
    const result = resolveNpmInvocation(["outdated", "--json"], {
      platform: "linux",
      execPath: "/usr/local/bin/node",
      existsSync: () => false,
    });

    expect(result).toEqual({
      command: "npm",
      args: ["outdated", "--json"],
    });
  });
});
