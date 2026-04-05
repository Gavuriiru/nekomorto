import fs from "node:fs";
import path from "node:path";

import {
  PUBLIC_SURFACE_BASELINE_PATH,
  PUBLIC_SURFACE_SUMMARY_PATH,
  WORKSPACE_ROOT,
  createAcceptedPublicSurfaceBaseline,
  readJsonFile,
  writeJsonFile,
} from "./public-surface-performance-lib.mjs";

const main = async () => {
  if (!fs.existsSync(PUBLIC_SURFACE_SUMMARY_PATH)) {
    throw new Error(
      `Summary file not found: ${PUBLIC_SURFACE_SUMMARY_PATH}. Run lighthouse-public-surface first.`,
    );
  }

  const summary = readJsonFile(PUBLIC_SURFACE_SUMMARY_PATH);
  const baseline = createAcceptedPublicSurfaceBaseline({ summary });
  writeJsonFile(PUBLIC_SURFACE_BASELINE_PATH, baseline);

  console.log(
    `[public-surface-accept] baseline written to ${path.relative(
      WORKSPACE_ROOT,
      PUBLIC_SURFACE_BASELINE_PATH,
    )}`,
  );
};

main().catch((error) => {
  console.error("[public-surface-accept] failed:", error?.message || error);
  process.exitCode = 1;
});
