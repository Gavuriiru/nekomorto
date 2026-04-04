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

const quoteWindowsCmdArgument = (value) => {
  const raw = String(value ?? "");
  if (!raw) {
    return '""';
  }
  if (!/[\s"&()^<>|]/.test(raw)) {
    return raw;
  }
  return `"${raw.replace(/"/g, '""')}"`;
};

export const resolveNpmInvocation = (npmArgs = [], options = {}) => {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const execPath = options.execPath ?? process.execPath;
  const existsSync = options.existsSync ?? fs.existsSync;
  const normalizedArgs = Array.isArray(npmArgs) ? [...npmArgs] : [];
  const npmExecPath = String(env?.npm_execpath || "").trim();

  if (npmExecPath) {
    return {
      command: execPath,
      args: [npmExecPath, ...normalizedArgs],
    };
  }

  const bundledNpmCliPath = resolveBundledNpmCliPath({ execPath, platform });
  if (existsSync(bundledNpmCliPath)) {
    return {
      command: execPath,
      args: [bundledNpmCliPath, ...normalizedArgs],
    };
  }

  if (platform === "win32") {
    const command = String(options.comSpec || env?.ComSpec || env?.COMSPEC || "cmd.exe").trim();
    return {
      command: command || "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        ["npm", ...normalizedArgs].map(quoteWindowsCmdArgument).join(" "),
      ],
    };
  }

  return {
    command: "npm",
    args: normalizedArgs,
  };
};
