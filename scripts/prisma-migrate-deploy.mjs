import { spawnSync } from "node:child_process";
import {
  getDatabaseStartupRetryConfig,
  isRetryableDatabaseStartupError,
} from "../server/lib/database-startup-retry.js";
import { resolveNpmInvocation } from "./lib/npm-invocation.mjs";

const sleep = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(delayMs) || 0));
  });

const runPrismaMigrateDeploy = () => {
  const { command, args } = resolveNpmInvocation(["exec", "--", "prisma", "migrate", "deploy"]);
  const result = spawnSync(command, args, {
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
