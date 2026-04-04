import { describe, expect, it } from "vitest";

import {
  resolveBundledNpmCliPath,
  resolveNpmInvocation,
} from "../../scripts/lib/npm-invocation.mjs";

describe("npm invocation helper", () => {
  it("uses npm_execpath on Windows when available", () => {
    const result = resolveNpmInvocation(["run", "dev"], {
      platform: "win32",
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      env: {
        npm_execpath: "C:\\Users\\gavur\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
      },
      existsSync: () => false,
    });

    expect(result).toEqual({
      command: "C:\\Program Files\\nodejs\\node.exe",
      args: [
        "C:\\Users\\gavur\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "dev",
      ],
    });
  });

  it("falls back to the bundled npm-cli.js next to node on Windows", () => {
    const execPath = "C:\\Program Files\\nodejs\\node.exe";
    const bundledPath = resolveBundledNpmCliPath({
      execPath,
      platform: "win32",
    });
    const result = resolveNpmInvocation(["exec", "--", "prisma", "migrate", "deploy"], {
      platform: "win32",
      execPath,
      env: {},
      existsSync: (candidatePath) => candidatePath === bundledPath,
    });

    expect(result).toEqual({
      command: execPath,
      args: [bundledPath, "exec", "--", "prisma", "migrate", "deploy"],
    });
  });

  it("uses cmd.exe fallback on Windows when no npm CLI path is discoverable", () => {
    const result = resolveNpmInvocation(["run", "dev"], {
      platform: "win32",
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      env: {
        ComSpec: "C:\\WINDOWS\\system32\\cmd.exe",
      },
      existsSync: () => false,
    });

    expect(result).toEqual({
      command: "C:\\WINDOWS\\system32\\cmd.exe",
      args: ["/d", "/s", "/c", "npm run dev"],
    });
  });

  it("uses the plain npm binary outside Windows when npm-specific paths are unavailable", () => {
    const result = resolveNpmInvocation(["outdated", "--json"], {
      platform: "linux",
      execPath: "/usr/local/bin/node",
      env: {},
      existsSync: () => false,
    });

    expect(result).toEqual({
      command: "npm",
      args: ["outdated", "--json"],
    });
  });
});
