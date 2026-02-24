import { spawn } from "node:child_process";
import { runDevPreflight } from "./dev-preflight.mjs";

const WATCH_ARGS = [
  "--watch",
  "--watch-path=server/index.js",
  "--watch-path=server/lib",
  "server/index.js",
];

const signalToExitCode = (signal) => {
  if (signal === "SIGINT") {
    return 130;
  }
  if (signal === "SIGTERM") {
    return 143;
  }
  return 1;
};

const run = async () => {
  await runDevPreflight();

  const child = spawn(process.execPath, WATCH_ARGS, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        // ignore signal forwarding failures
      }
    }
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("error", (error) => {
    console.error(`[dev:runner] Failed to start watcher: ${error.message}`);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(signalToExitCode(signal));
      return;
    }
    process.exit(Number.isInteger(code) ? code : 1);
  });
};

run().catch((error) => {
  console.error(`[dev:runner] ${String(error?.message || error)}`);
  process.exit(1);
});
