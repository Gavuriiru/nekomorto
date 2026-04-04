import { spawnSync } from "node:child_process";
import {
  getDatabaseStartupRetryConfig,
  isRetryableDatabaseStartupError,
} from "../server/lib/database-startup-retry.js";

const sleep = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
  });

const runPrismaMigrateDeploy = () => {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["exec", "--", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
};

const main = async () => {
  const { maxAttempts, retryDelayMs } = getDatabaseStartupRetryConfig();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runPrismaMigrateDeploy();

    if (result.error) {
      throw result.error;
    }

    if (result.status === 0) {
      return;
    }

    const combinedOutput = [result.stdout || "", result.stderr || ""].join("\n");
    const canRetry =
      attempt < maxAttempts && isRetryableDatabaseStartupError(combinedOutput);

    if (!canRetry) {
      process.exit(result.status || 1);
    }

    console.warn(
      `[prisma:migrate:deploy] database not ready on attempt ${attempt}/${maxAttempts}; retrying in ${retryDelayMs}ms.`,
    );
    await sleep(retryDelayMs);
  }
};

main().catch((error) => {
  console.error(`[prisma:migrate:deploy] ${String(error?.message || error || "failed")}`);
  process.exit(1);
});
