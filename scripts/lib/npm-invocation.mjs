import fs from "node:fs";
import path from "node:path";

const resolvePathModule = (platform) => (platform === "win32" ? path.win32 : path.posix);

export const resolveBundledNpmCliPath = ({
  execPath = process.execPath,
  platform = process.platform,
} = {}) => {
  const pathModule = resolvePathModule(platform);
  return pathModule.join(pathModule.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js");
};

export const resolveNpmInvocation = (npmArgs = [], options = {}) => {
  const platform = options.platform ?? process.platform;
  const execPath = options.execPath ?? process.execPath;
  const existsSync = options.existsSync ?? fs.existsSync;
  const normalizedArgs = Array.isArray(npmArgs) ? [...npmArgs] : [];

  const bundledNpmCliPath = resolveBundledNpmCliPath({ execPath, platform });
  if (existsSync(bundledNpmCliPath)) {
    return {
      command: execPath,
      args: [bundledNpmCliPath, ...normalizedArgs],
    };
  }

  if (platform === "win32") {
    return {
      command: "npm.cmd",
      args: normalizedArgs,
    };
  }

  return {
    command: "npm",
    args: normalizedArgs,
  };
};
