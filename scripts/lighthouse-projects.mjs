import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectAuditNumericValues,
  PUBLIC_SURFACE_CATEGORY_IDS,
  PUBLIC_SURFACE_METRIC_AUDIT_IDS,
} from "./public-surface-performance-lib.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const outputDir = path.join(workspaceRoot, ".lighthouse");
const lighthouseTmpDir = path.join(outputDir, "tmp");

const categoryIds = PUBLIC_SURFACE_CATEGORY_IDS;
const strictCategoryIds = ["performance", "accessibility", "seo"];
const reportedMetricAuditIds = PUBLIC_SURFACE_METRIC_AUDIT_IDS;
const defaultRuns = 3;
const defaultUrl = process.env.LIGHTHOUSE_PROJECTS_URL || "http://127.0.0.1:8080/projetos";
const profileConfigs = {
  mobile: path.join(workspaceRoot, "scripts", "lighthouse-projects-mobile.config.cjs"),
  desktop: path.join(workspaceRoot, "scripts", "lighthouse-projects-desktop.config.cjs"),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const commandFor = (baseName) => (process.platform === "win32" ? `${baseName}.cmd` : baseName);

const parseArgs = (argv) => {
  const args = {
    profile: "mobile",
    url: defaultUrl,
    runs: defaultRuns,
    strict: false,
  };

  argv.forEach((arg) => {
    if (arg === "--strict") {
      args.strict = true;
      return;
    }
    if (arg.startsWith("--profile=")) {
      const profile = arg.slice("--profile=".length).trim();
      if (profile === "mobile" || profile === "desktop") {
        args.profile = profile;
      }
      return;
    }
    if (arg.startsWith("--url=")) {
      args.url = arg.slice("--url=".length).trim() || defaultUrl;
      return;
    }
    if (arg.startsWith("--runs=")) {
      const parsed = Number.parseInt(arg.slice("--runs=".length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.runs = parsed;
      }
    }
  });

  return args;
};

const runCommand = ({ cmd, commandArgs, cwd, stdio = "inherit", env = {} }) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, commandArgs, {
      cwd,
      stdio,
      env: {
        ...process.env,
        ...env,
      },
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(code);
        return;
      }
      reject(new Error(`${cmd} ${commandArgs.join(" ")} exited with code ${code}`));
    });
  });

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) {
    return NaN;
  }
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const waitForUrl = async (url, timeoutMs = 60_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
      });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Keep polling while the target environment starts.
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const runLighthouse = async ({ url, profile, runIndex }) => {
  const reportPath = path.join(outputDir, `projects-${profile}-run-${runIndex}.json`);
  const configPath = profileConfigs[profile];
  fs.rmSync(reportPath, { force: true });
  const chromeFlags = "--headless=new --no-sandbox --disable-dev-shm-usage";
  const lighthouseTempEnv = {
    TMPDIR: lighthouseTmpDir,
    TMP: lighthouseTmpDir,
    TEMP: lighthouseTmpDir,
  };
  let commandError = null;
  try {
    await runCommand({
      cmd: commandFor("npx"),
      commandArgs: [
        "lighthouse",
        url,
        `--config-path=${configPath}`,
        "--quiet",
        "--output=json",
        `--output-path=${reportPath}`,
        `--chrome-flags=${chromeFlags}`,
      ],
      cwd: workspaceRoot,
      env: lighthouseTempEnv,
    });
  } catch (error) {
    commandError = error;
  }
  if (!fs.existsSync(reportPath)) {
    throw commandError || new Error(`Lighthouse report missing: ${reportPath}`);
  }
  const reportRaw = fs.readFileSync(reportPath, "utf8");
  if (commandError) {
    console.warn(
      `[lighthouse-projects:${profile}] lighthouse exited with non-zero status but produced ${path.basename(
        reportPath,
      )}; continuing with generated report (${commandError.message})`,
    );
  }
  return JSON.parse(reportRaw);
};

const toCategoryScores = (report) =>
  categoryIds.reduce((result, categoryId) => {
    const score = Number(report?.categories?.[categoryId]?.score);
    result[categoryId] = Number.isFinite(score) ? score : NaN;
    return result;
  }, {});

const toMetricValues = (report) => collectAuditNumericValues(report, reportedMetricAuditIds);

const computeMedianSummary = (reports) => {
  const categoryScoresByRun = reports.map((report) => toCategoryScores(report));
  const metricValuesByRun = reports.map((report) => toMetricValues(report));
  const medianCategories = categoryIds.reduce((result, categoryId) => {
    const values = categoryScoresByRun
      .map((run) => run[categoryId])
      .filter((value) => Number.isFinite(value));
    result[categoryId] = median(values);
    return result;
  }, {});

  const medianMetrics = reportedMetricAuditIds.reduce((result, auditId) => {
    const values = metricValuesByRun
      .map((run) => run[auditId])
      .filter((value) => Number.isFinite(value));
    result[auditId] = median(values);
    return result;
  }, {});

  return {
    categoriesByRun: categoryScoresByRun,
    metricsByRun: metricValuesByRun,
    medianCategories,
    medianMetrics,
  };
};

const assertStrictThresholds = (summary) => {
  const failingCategories = strictCategoryIds.filter(
    (categoryId) => summary.medianCategories[categoryId] < 1,
  );
  if (failingCategories.length > 0) {
    throw new Error(
      `Lighthouse categories below 100: ${failingCategories
        .map((id) => `${id}=${Math.round(summary.medianCategories[id] * 100)}`)
        .join(", ")}`,
    );
  }
};

const writeSummary = ({ url, runs, strict, profile, summary }) => {
  const payload = {
    generatedAt: new Date().toISOString(),
    profile,
    url,
    runs,
    strict,
    medianCategories: summary.medianCategories,
    medianMetrics: summary.medianMetrics,
    categoriesByRun: summary.categoriesByRun,
    metricsByRun: summary.metricsByRun,
    thresholds: {
      blockingCategories: strictCategoryIds.reduce((result, categoryId) => {
        result[categoryId] = 1;
        return result;
      }, {}),
      reportedOnlyCategories: ["best-practices"],
      reportedMetrics: reportedMetricAuditIds,
    },
  };
  const summaryPath = path.join(outputDir, `projects-${profile}-summary.json`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2));
  return summaryPath;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(lighthouseTmpDir, { recursive: true });
    await waitForUrl(args.url);

    const reports = [];
    for (let index = 1; index <= args.runs; index += 1) {
      console.log(`[lighthouse-projects:${args.profile}] running sample ${index}/${args.runs}`);
      const report = await runLighthouse({
        url: args.url,
        profile: args.profile,
        runIndex: index,
      });
      reports.push(report);
    }

    const summary = computeMedianSummary(reports);
    const summaryPath = writeSummary({
      url: args.url,
      runs: args.runs,
      strict: args.strict,
      profile: args.profile,
      summary,
    });

    console.log(`[lighthouse-projects:${args.profile}] summary written to ${summaryPath}`);
    console.log(
      `[lighthouse-projects:${args.profile}] median categories: ${categoryIds
        .map(
          (categoryId) => `${categoryId}=${Math.round(summary.medianCategories[categoryId] * 100)}`,
        )
        .join(", ")}`,
    );

    if (args.strict) {
      assertStrictThresholds(summary);
      console.log(`[lighthouse-projects:${args.profile}] strict gate passed`);
    }
  } catch (error) {
    console.error(`[lighthouse-projects:${args.profile}] failed:`, error?.message || error);
    process.exitCode = 1;
  }
};

main();
