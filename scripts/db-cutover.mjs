import "dotenv/config";
import { spawnSync } from "child_process";
import path from "path";

const rootDir = path.resolve(process.cwd());

const npmCmd = "npm";
const npxCmd = "npx";

const args = process.argv.slice(2);
const stage = String(args[0] || "help").trim().toLowerCase();

const getArgValue = (name) => {
  const match = args.find((item) => item.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : "";
};

const hasFlag = (flag) => args.includes(flag);

const baseUrl = getArgValue("--base");

const isTruthy = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const runCommand = ({ label, command, commandArgs, useShell = false }) => {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
    shell: useShell,
  });
  if (result.error) {
    throw new Error(`Failed: ${label} (${result.error.message})`);
  }
  if (result.status !== 0) {
    throw new Error(`Failed: ${label} (exit ${result.status ?? "unknown"})`);
  }
};

const quoteShellArg = (arg) => {
  const value = String(arg);
  const safePattern = /^[A-Za-z0-9_./:=+@,-]+$/;
  if (safePattern.test(value)) {
    return value;
  }
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

const runShellCommand = ({ label, tokens }) => {
  const commandLine = tokens.map((token) => quoteShellArg(token)).join(" ");
  runCommand({
    label,
    command: commandLine,
    commandArgs: [],
    useShell: true,
  });
};

const runNpm = ({ label, commandArgs }) =>
  runShellCommand({
    label,
    tokens: [npmCmd, ...commandArgs],
  });

const runNpx = ({ label, commandArgs }) =>
  runShellCommand({
    label,
    tokens: [npxCmd, ...commandArgs],
  });

const ensureDatabaseUrl = () => {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("DATABASE_URL is required for this stage");
  }
};

const ensureMaintenanceEnabled = () => {
  if (hasFlag("--allow-no-maintenance")) {
    return;
  }
  if (!isTruthy(process.env.MAINTENANCE_MODE)) {
    throw new Error(
      "MAINTENANCE_MODE must be true for cutover stage. Use --allow-no-maintenance to bypass.",
    );
  }
};

const runSmoke = () => {
  if (baseUrl) {
    runNpm({
      label: `API smoke (${baseUrl})`,
      commandArgs: ["run", "api:smoke", "--", `--base=${baseUrl}`],
    });
    return;
  }
  runNpm({
    label: "API smoke (default base)",
    commandArgs: ["run", "api:smoke"],
  });
};

const runHealthCheck = ({ expectedSource, expectedMaintenance }) => {
  const commandArgs = ["scripts/check-health.mjs"];
  if (baseUrl) {
    commandArgs.push(`--base=${baseUrl}`);
  }
  if (expectedSource) {
    commandArgs.push(`--expect-source=${expectedSource}`);
  }
  if (typeof expectedMaintenance === "boolean") {
    commandArgs.push(`--expect-maintenance=${expectedMaintenance ? "true" : "false"}`);
  }
  runCommand({
    label: "Health check",
    command: process.execPath,
    commandArgs,
  });
};

const stages = {
  help() {
    console.log(`Usage:
  node scripts/db-cutover.mjs preflight
  node scripts/db-cutover.mjs prepare-schema
  node scripts/db-cutover.mjs cutover [--allow-no-maintenance]
  node scripts/db-cutover.mjs smoke [--base=https://staging.example.com]
  node scripts/db-cutover.mjs health-db-maintenance [--base=https://staging.example.com]
  node scripts/db-cutover.mjs health-db-open [--base=https://staging.example.com]
  node scripts/db-cutover.mjs staging-all [--base=https://staging.example.com] [--allow-no-maintenance]

Notes:
  - preflight: runs db preflight and migration dry-run.
  - prepare-schema: runs prisma generate + migrate deploy + migrate status.
  - cutover: backup + hash + json->db apply + parity verify.
  - this script does not mutate .env; switch DATA_SOURCE and MAINTENANCE_MODE in your deploy env.`);
  },

  preflight() {
    runNpm({
      label: "DB preflight",
      commandArgs: ["run", "db:preflight"],
    });
    runNpm({
      label: "JSON -> DB dry-run",
      commandArgs: ["run", "db:migrate:json:dry-run"],
    });
  },

  "prepare-schema"() {
    ensureDatabaseUrl();
    runNpm({
      label: "Prisma generate",
      commandArgs: ["run", "prisma:generate"],
    });
    runNpm({
      label: "Prisma migrate deploy",
      commandArgs: ["run", "prisma:migrate:deploy"],
    });
    runNpx({
      label: "Prisma migrate status",
      commandArgs: ["prisma", "migrate", "status"],
    });
  },

  cutover() {
    ensureDatabaseUrl();
    ensureMaintenanceEnabled();
    runCommand({
      label: "Backup JSON/uploads snapshot",
      command: process.execPath,
      commandArgs: ["scripts/backup-data.mjs"],
    });
    runNpm({
      label: "Hash JSON snapshot",
      commandArgs: ["run", "db:hash:snapshot"],
    });
    runNpm({
      label: "Apply JSON -> DB migration",
      commandArgs: ["run", "db:migrate:json:apply"],
    });
    runNpm({
      label: "Verify parity JSON vs DB",
      commandArgs: ["run", "db:verify:parity"],
    });
  },

  smoke() {
    runSmoke();
  },

  "health-db-maintenance"() {
    runHealthCheck({ expectedSource: "db", expectedMaintenance: true });
  },

  "health-db-open"() {
    runHealthCheck({ expectedSource: "db", expectedMaintenance: false });
  },

  "staging-all"() {
    stages.preflight();
    stages["prepare-schema"]();
    stages.cutover();
    runSmoke();
  },
};

const selected = stages[stage];
if (!selected) {
  console.error(`Unknown stage "${stage}"`);
  stages.help();
  process.exit(1);
}

selected();
