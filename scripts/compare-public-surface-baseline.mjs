import fs from "node:fs";
import path from "node:path";

import {
  PUBLIC_SURFACE_BASELINE_PATH,
  PUBLIC_SURFACE_COMPARISON_JSON_PATH,
  PUBLIC_SURFACE_COMPARISON_MARKDOWN_PATH,
  PUBLIC_SURFACE_SUMMARY_PATH,
  WORKSPACE_ROOT,
  comparePublicSurfaceSummary,
  formatPublicSurfaceComparisonMarkdown,
  readJsonFile,
  writeJsonFile,
} from "./public-surface-performance-lib.mjs";

const parseArgs = (argv) => {
  const args = {
    summaryPath: PUBLIC_SURFACE_SUMMARY_PATH,
    baselinePath: PUBLIC_SURFACE_BASELINE_PATH,
    jsonOutputPath: PUBLIC_SURFACE_COMPARISON_JSON_PATH,
    markdownOutputPath: PUBLIC_SURFACE_COMPARISON_MARKDOWN_PATH,
  };

  for (const arg of argv) {
    if (arg.startsWith("--summary=")) {
      args.summaryPath = path.resolve(WORKSPACE_ROOT, arg.slice("--summary=".length).trim());
      continue;
    }
    if (arg.startsWith("--baseline=")) {
      args.baselinePath = path.resolve(WORKSPACE_ROOT, arg.slice("--baseline=".length).trim());
      continue;
    }
    if (arg.startsWith("--json-output=")) {
      args.jsonOutputPath = path.resolve(
        WORKSPACE_ROOT,
        arg.slice("--json-output=".length).trim(),
      );
      continue;
    }
    if (arg.startsWith("--markdown-output=")) {
      args.markdownOutputPath = path.resolve(
        WORKSPACE_ROOT,
        arg.slice("--markdown-output=".length).trim(),
      );
    }
  }

  return args;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.summaryPath)) {
    throw new Error(`Summary file not found: ${args.summaryPath}`);
  }

  const summary = readJsonFile(args.summaryPath);
  const baseline = fs.existsSync(args.baselinePath)
    ? readJsonFile(args.baselinePath)
    : {
        schemaVersion: 1,
        acceptedAt: null,
        routeOrder: [],
        routes: {},
      };

  const comparison = comparePublicSurfaceSummary({ baseline, summary });
  const comparisonMarkdown = formatPublicSurfaceComparisonMarkdown(comparison);

  writeJsonFile(args.jsonOutputPath, comparison);
  fs.mkdirSync(path.dirname(args.markdownOutputPath), { recursive: true });
  fs.writeFileSync(args.markdownOutputPath, comparisonMarkdown);

  const routeWarnings = comparison.routeOrder
    .map((routeKey) => comparison.routes?.[routeKey])
    .filter(Boolean)
    .filter((route) => route.status === "warn");

  if (routeWarnings.length > 0) {
    console.warn(
      `[public-surface-compare] regressions detected in ${routeWarnings
        .map((route) => route.label)
        .join(", ")}`,
    );
  } else {
    console.log("[public-surface-compare] no route regressions detected");
  }

  const missingBaselineRoutes = comparison.routeOrder
    .map((routeKey) => comparison.routes?.[routeKey])
    .filter(Boolean)
    .filter((route) => route.status === "missing-baseline");

  if (missingBaselineRoutes.length > 0) {
    console.warn(
      `[public-surface-compare] baseline missing for ${missingBaselineRoutes
        .map((route) => route.label)
        .join(", ")}`,
    );
  }

  console.log(
    `[public-surface-compare] artifacts written to ${path.relative(
      WORKSPACE_ROOT,
      args.jsonOutputPath,
    )} and ${path.relative(WORKSPACE_ROOT, args.markdownOutputPath)}`,
  );
};

main().catch((error) => {
  console.error("[public-surface-compare] failed:", error?.message || error);
  process.exitCode = 1;
});
