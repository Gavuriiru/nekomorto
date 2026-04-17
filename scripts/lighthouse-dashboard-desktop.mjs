import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const outputDir = path.join(workspaceRoot, ".lighthouse");
const lighthouseTmpDir = path.join(outputDir, "tmp");
const configPath = path.join(workspaceRoot, "scripts", "lighthouse-dashboard-desktop.config.cjs");

const defaultRuns = 3;
const defaultUrl = process.env.LIGHTHOUSE_DASHBOARD_URL || "http://127.0.0.1:8080/dashboard";
const categoryIds = ["performance"];
const metricIds = {
  fcp: "first-contentful-paint",
  lcp: "largest-contentful-paint",
  tbt: "total-blocking-time",
  cls: "cumulative-layout-shift",
};
const strictThresholds = {
  performance: 1,
  fcp: 1800,
  lcp: 2500,
  tbt: 50,
  cls: 0.02,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const commandFor = (baseName) => (process.platform === "win32" ? `${baseName}.cmd` : baseName);

const parseArgs = (argv) => {
  const args = {
    url: defaultUrl,
    runs: defaultRuns,
    strict: false,
    cookie: process.env.LIGHTHOUSE_DASHBOARD_COOKIE || "",
  };

  argv.forEach((arg) => {
    if (arg === "--strict") {
      args.strict = true;
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
      return;
    }
    if (arg.startsWith("--cookie=")) {
      args.cookie = arg.slice("--cookie=".length).trim();
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

const runLighthouse = async ({ url, runIndex, cookie }) => {
  const reportPath = path.join(outputDir, `dashboard-desktop-run-${runIndex}.json`);
  fs.rmSync(reportPath, { force: true });
  const chromeFlags = "--headless=new --no-sandbox --disable-dev-shm-usage";
  const lighthouseTempEnv = {
    TMPDIR: lighthouseTmpDir,
    TMP: lighthouseTmpDir,
    TEMP: lighthouseTmpDir,
  };
  const commandArgs = [
    "lighthouse",
    url,
    `--config-path=${configPath}`,
    "--quiet",
    "--output=json",
    `--output-path=${reportPath}`,
    `--chrome-flags=${chromeFlags}`,
  ];
  if (cookie) {
    commandArgs.push(`--extra-headers=${JSON.stringify({ Cookie: cookie })}`);
  }
  let commandError = null;
  try {
    await runCommand({
      cmd: commandFor("npx"),
      commandArgs,
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
      `[lighthouse-dashboard:desktop] lighthouse exited with non-zero status but produced ${path.basename(
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

const toMetricSnapshot = (report) => ({
  fcp: Number(report?.audits?.[metricIds.fcp]?.numericValue),
  lcp: Number(report?.audits?.[metricIds.lcp]?.numericValue),
  tbt: Number(report?.audits?.[metricIds.tbt]?.numericValue),
  cls: Number(report?.audits?.[metricIds.cls]?.numericValue),
});

const computeMedianSummary = (reports) => {
  const categoriesByRun = reports.map((report) => toCategoryScores(report));
  const metricsByRun = reports.map((report) => toMetricSnapshot(report));
  const medianCategories = categoryIds.reduce((result, categoryId) => {
    const values = categoriesByRun
      .map((run) => run[categoryId])
      .filter((value) => Number.isFinite(value));
    result[categoryId] = median(values);
    return result;
  }, {});
  const medianMetrics = Object.keys(metricIds).reduce((result, metricId) => {
    const values = metricsByRun
      .map((run) => run[metricId])
      .filter((value) => Number.isFinite(value));
    result[metricId] = median(values);
    return result;
  }, {});

  return {
    categoriesByRun,
    metricsByRun,
    medianCategories,
    medianMetrics,
  };
};

const assertStrictThresholds = (summary) => {
  const failures = [];
  if (summary.medianCategories.performance < strictThresholds.performance) {
    failures.push(`performance=${Math.round(summary.medianCategories.performance * 100)}`);
  }
  if (summary.medianMetrics.fcp > strictThresholds.fcp) {
    failures.push(`FCP=${Math.round(summary.medianMetrics.fcp)}ms`);
  }
  if (summary.medianMetrics.lcp > strictThresholds.lcp) {
    failures.push(`LCP=${Math.round(summary.medianMetrics.lcp)}ms`);
  }
  if (summary.medianMetrics.tbt > strictThresholds.tbt) {
    failures.push(`TBT=${Math.round(summary.medianMetrics.tbt)}ms`);
  }
  if (summary.medianMetrics.cls > strictThresholds.cls) {
    failures.push(`CLS=${summary.medianMetrics.cls.toFixed(3)}`);
  }
  if (failures.length > 0) {
    throw new Error(`Lighthouse dashboard desktop below gate: ${failures.join(", ")}`);
  }
};

const writeSummary = ({ url, runs, strict, summary, cookieSupplied }) => {
  const payload = {
    generatedAt: new Date().toISOString(),
    profile: "desktop",
    url,
    runs,
    strict,
    cookieSupplied,
    medianCategories: summary.medianCategories,
    medianMetrics: summary.medianMetrics,
    categoriesByRun: summary.categoriesByRun,
    metricsByRun: summary.metricsByRun,
    thresholds: strictThresholds,
  };
  const summaryPath = path.join(outputDir, "dashboard-desktop-summary.json");
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
      console.log(`[lighthouse-dashboard:desktop] running sample ${index}/${args.runs}`);
      const report = await runLighthouse({
        url: args.url,
        runIndex: index,
        cookie: args.cookie,
      });
      reports.push(report);
    }

    const summary = computeMedianSummary(reports);
    const summaryPath = writeSummary({
      url: args.url,
      runs: args.runs,
      strict: args.strict,
      summary,
      cookieSupplied: Boolean(args.cookie),
    });

    console.log(`[lighthouse-dashboard:desktop] summary written to ${summaryPath}`);
    console.log(
      `[lighthouse-dashboard:desktop] median performance=${Math.round(
        summary.medianCategories.performance * 100,
      )}, FCP=${Math.round(summary.medianMetrics.fcp)}ms, LCP=${Math.round(
        summary.medianMetrics.lcp,
      )}ms, TBT=${Math.round(summary.medianMetrics.tbt)}ms, CLS=${summary.medianMetrics.cls.toFixed(
        3,
      )}`,
    );

    if (args.strict) {
      assertStrictThresholds(summary);
      console.log("[lighthouse-dashboard:desktop] strict gate passed");
    }
  } catch (error) {
    console.error("[lighthouse-dashboard:desktop] failed:", error?.message || error);
    process.exitCode = 1;
  }
};

main();
