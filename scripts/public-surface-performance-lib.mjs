import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WORKSPACE_ROOT = path.resolve(__dirname, "..");
export const LIGHTHOUSE_DIR = path.join(WORKSPACE_ROOT, ".lighthouse");
export const PUBLIC_SURFACE_SUMMARY_PATH = path.join(LIGHTHOUSE_DIR, "public-surface-summary.json");
export const PUBLIC_SURFACE_COMPARISON_JSON_PATH = path.join(
  LIGHTHOUSE_DIR,
  "public-surface-comparison.json",
);
export const PUBLIC_SURFACE_COMPARISON_MARKDOWN_PATH = path.join(
  LIGHTHOUSE_DIR,
  "public-surface-comparison.md",
);
export const PUBLIC_SURFACE_BASELINE_PATH = path.join(
  WORKSPACE_ROOT,
  "reports",
  "perf",
  "public-surface-baseline.json",
);

export const PUBLIC_SURFACE_CATEGORY_IDS = Object.freeze([
  "performance",
  "accessibility",
  "best-practices",
  "seo",
]);

export const PUBLIC_SURFACE_METRIC_AUDIT_IDS = Object.freeze([
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "cumulative-layout-shift",
  "speed-index",
  "interaction-to-next-paint",
]);

export const PUBLIC_SURFACE_ROUTE_ORDER = Object.freeze([
  "home-mobile",
  "projects-mobile",
  "projects-desktop",
  "reader-post-mobile",
  "reader-chapter-mobile",
]);

export const PUBLIC_SURFACE_ROUTE_LABELS = Object.freeze({
  "home-mobile": "Home mobile",
  "projects-mobile": "Projects mobile",
  "projects-desktop": "Projects desktop",
  "reader-post-mobile": "Reader post mobile",
  "reader-chapter-mobile": "Reader chapter mobile",
});

export const PUBLIC_SURFACE_COMPARISON_THRESHOLDS = Object.freeze({
  performanceScoreDrop: 0.03,
  "largest-contentful-paint": 200,
  "total-blocking-time": 50,
  "cumulative-layout-shift": 0.02,
});

const coerceFiniteNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const median = (values) => {
  const finiteValues = values
    .map((value) => coerceFiniteNumber(value))
    .filter((value) => value !== null);
  if (finiteValues.length === 0) {
    return null;
  }
  const sorted = [...finiteValues].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

export const collectAuditNumericValues = (report, auditIds = PUBLIC_SURFACE_METRIC_AUDIT_IDS) =>
  auditIds.reduce((result, auditId) => {
    result[auditId] = coerceFiniteNumber(report?.audits?.[auditId]?.numericValue);
    return result;
  }, {});

const normalizeNumericMap = (keys, value) =>
  keys.reduce((result, key) => {
    result[key] = coerceFiniteNumber(value?.[key]);
    return result;
  }, {});

export const aggregatePublicSurfaceSummaries = ({
  generatedAt = new Date().toISOString(),
  runs,
  routeEntries,
}) => {
  const routeMap = routeEntries.reduce((result, entry) => {
    if (!entry?.key) {
      return result;
    }
    result[entry.key] = {
      key: entry.key,
      label: entry.label || PUBLIC_SURFACE_ROUTE_LABELS[entry.key] || entry.key,
      url: String(entry.url || "").trim(),
      sourceSummaryPath: String(entry.sourceSummaryPath || "").trim(),
      sourceRouteKey: String(entry.sourceRouteKey || "").trim() || null,
      medianCategories: normalizeNumericMap(PUBLIC_SURFACE_CATEGORY_IDS, entry.medianCategories),
      medianMetrics: normalizeNumericMap(PUBLIC_SURFACE_METRIC_AUDIT_IDS, entry.medianMetrics),
      categoriesByRun: Array.isArray(entry.categoriesByRun) ? entry.categoriesByRun : [],
      metricsByRun: Array.isArray(entry.metricsByRun) ? entry.metricsByRun : [],
    };
    return result;
  }, {});

  const routeOrder = [
    ...PUBLIC_SURFACE_ROUTE_ORDER.filter((key) => routeMap[key]),
    ...Object.keys(routeMap)
      .filter((key) => !PUBLIC_SURFACE_ROUTE_ORDER.includes(key))
      .sort(),
  ];

  return {
    schemaVersion: 1,
    generatedAt,
    runs: coerceFiniteNumber(runs),
    routeOrder,
    categoryIds: [...PUBLIC_SURFACE_CATEGORY_IDS],
    metricAuditIds: [...PUBLIC_SURFACE_METRIC_AUDIT_IDS],
    comparisonThresholds: { ...PUBLIC_SURFACE_COMPARISON_THRESHOLDS },
    routes: routeMap,
  };
};

export const createAcceptedPublicSurfaceBaseline = ({
  summary,
  acceptedAt = new Date().toISOString(),
}) => ({
  schemaVersion: 1,
  acceptedAt,
  sourceGeneratedAt: String(summary?.generatedAt || "").trim() || null,
  routeOrder: Array.isArray(summary?.routeOrder) ? [...summary.routeOrder] : [],
  categoryIds: Array.isArray(summary?.categoryIds)
    ? [...summary.categoryIds]
    : [...PUBLIC_SURFACE_CATEGORY_IDS],
  metricAuditIds: Array.isArray(summary?.metricAuditIds)
    ? [...summary.metricAuditIds]
    : [...PUBLIC_SURFACE_METRIC_AUDIT_IDS],
  comparisonThresholds: {
    ...PUBLIC_SURFACE_COMPARISON_THRESHOLDS,
    ...(summary?.comparisonThresholds && typeof summary.comparisonThresholds === "object"
      ? summary.comparisonThresholds
      : {}),
  },
  routes:
    summary?.routes && typeof summary.routes === "object"
      ? JSON.parse(JSON.stringify(summary.routes))
      : {},
});

const buildPerformanceWarning = ({ baselineValue, currentValue, threshold }) => {
  if (baselineValue === null || currentValue === null) {
    return null;
  }
  const drop = baselineValue - currentValue;
  if (drop <= threshold) {
    return null;
  }
  return {
    kind: "performance-score",
    message: `performance caiu ${Math.round(drop * 100)} pontos (baseline ${Math.round(
      baselineValue * 100,
    )} -> atual ${Math.round(currentValue * 100)})`,
  };
};

const buildMetricWarning = ({ auditId, baselineValue, currentValue, threshold }) => {
  if (baselineValue === null || currentValue === null) {
    return null;
  }
  const delta = currentValue - baselineValue;
  if (delta <= threshold) {
    return null;
  }
  return {
    kind: auditId,
    message: `${auditId} piorou ${delta.toFixed(2)} (baseline ${baselineValue.toFixed(
      2,
    )} -> atual ${currentValue.toFixed(2)})`,
  };
};

export const comparePublicSurfaceSummary = ({
  baseline,
  summary,
  thresholds = PUBLIC_SURFACE_COMPARISON_THRESHOLDS,
}) => {
  const comparedRouteOrder = [
    ...new Set([
      ...(Array.isArray(summary?.routeOrder) ? summary.routeOrder : []),
      ...(Array.isArray(baseline?.routeOrder) ? baseline.routeOrder : []),
      ...PUBLIC_SURFACE_ROUTE_ORDER,
    ]),
  ];

  const routes = {};
  let warningCount = 0;

  for (const routeKey of comparedRouteOrder) {
    const currentRoute = summary?.routes?.[routeKey] || null;
    const baselineRoute = baseline?.routes?.[routeKey] || null;
    const warnings = [];

    if (!currentRoute) {
      warnings.push({
        kind: "missing-current",
        message: "Resumo atual ausente para esta rota.",
      });
    }

    if (!baselineRoute) {
      warnings.push({
        kind: "missing-baseline",
        message: "Baseline ainda não foi aceito para esta rota.",
      });
    }

    if (currentRoute && baselineRoute) {
      const performanceWarning = buildPerformanceWarning({
        baselineValue: coerceFiniteNumber(baselineRoute?.medianCategories?.performance),
        currentValue: coerceFiniteNumber(currentRoute?.medianCategories?.performance),
        threshold: coerceFiniteNumber(thresholds?.performanceScoreDrop) ?? 0,
      });
      if (performanceWarning) {
        warnings.push(performanceWarning);
      }

      for (const auditId of [
        "largest-contentful-paint",
        "total-blocking-time",
        "cumulative-layout-shift",
      ]) {
        const metricWarning = buildMetricWarning({
          auditId,
          baselineValue: coerceFiniteNumber(baselineRoute?.medianMetrics?.[auditId]),
          currentValue: coerceFiniteNumber(currentRoute?.medianMetrics?.[auditId]),
          threshold: coerceFiniteNumber(thresholds?.[auditId]) ?? 0,
        });
        if (metricWarning) {
          warnings.push(metricWarning);
        }
      }
    }

    const hasRegressionWarnings = warnings.some(
      (warning) => warning.kind !== "missing-baseline" && warning.kind !== "missing-current",
    );
    if (hasRegressionWarnings) {
      warningCount += warnings.length;
    }

    routes[routeKey] = {
      key: routeKey,
      label:
        currentRoute?.label ||
        baselineRoute?.label ||
        PUBLIC_SURFACE_ROUTE_LABELS[routeKey] ||
        routeKey,
      url: currentRoute?.url || baselineRoute?.url || "",
      status: !currentRoute
        ? "missing-current"
        : !baselineRoute
          ? "missing-baseline"
          : hasRegressionWarnings
            ? "warn"
            : "ok",
      warnings,
      baseline: baselineRoute
        ? {
            medianCategories: normalizeNumericMap(
              PUBLIC_SURFACE_CATEGORY_IDS,
              baselineRoute.medianCategories,
            ),
            medianMetrics: normalizeNumericMap(
              PUBLIC_SURFACE_METRIC_AUDIT_IDS,
              baselineRoute.medianMetrics,
            ),
          }
        : null,
      current: currentRoute
        ? {
            medianCategories: normalizeNumericMap(
              PUBLIC_SURFACE_CATEGORY_IDS,
              currentRoute.medianCategories,
            ),
            medianMetrics: normalizeNumericMap(
              PUBLIC_SURFACE_METRIC_AUDIT_IDS,
              currentRoute.medianMetrics,
            ),
          }
        : null,
    };
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baselineAcceptedAt: String(baseline?.acceptedAt || "").trim() || null,
    summaryGeneratedAt: String(summary?.generatedAt || "").trim() || null,
    routeOrder: comparedRouteOrder,
    thresholds: {
      ...PUBLIC_SURFACE_COMPARISON_THRESHOLDS,
      ...(thresholds && typeof thresholds === "object" ? thresholds : {}),
    },
    hasRegression: Object.values(routes).some((route) => route.status === "warn"),
    warningCount,
    routes,
  };
};

const formatScore = (value) => {
  const numericValue = coerceFiniteNumber(value);
  if (numericValue === null) {
    return "n/a";
  }
  return String(Math.round(numericValue * 100));
};

const formatMetric = (value) => {
  const numericValue = coerceFiniteNumber(value);
  if (numericValue === null) {
    return "n/a";
  }
  return numericValue.toFixed(2);
};

export const formatPublicSurfaceComparisonMarkdown = (comparison) => {
  const lines = [
    "# Public Surface Performance Comparison",
    "",
    `- Generated at: ${comparison?.generatedAt || "n/a"}`,
    `- Summary generated at: ${comparison?.summaryGeneratedAt || "n/a"}`,
    `- Baseline accepted at: ${comparison?.baselineAcceptedAt || "n/a"}`,
    `- Regression warnings: ${comparison?.warningCount || 0}`,
    "",
  ];

  for (const routeKey of comparison?.routeOrder || []) {
    const route = comparison?.routes?.[routeKey];
    if (!route) {
      continue;
    }
    lines.push(`## ${route.label}`);
    lines.push("");
    lines.push(`- Status: ${route.status}`);
    lines.push(`- URL: ${route.url || "n/a"}`);
    lines.push(
      `- Performance: ${formatScore(route.current?.medianCategories?.performance)} (baseline ${formatScore(
        route.baseline?.medianCategories?.performance,
      )})`,
    );
    lines.push(
      `- LCP: ${formatMetric(route.current?.medianMetrics?.["largest-contentful-paint"])} (baseline ${formatMetric(
        route.baseline?.medianMetrics?.["largest-contentful-paint"],
      )})`,
    );
    lines.push(
      `- TBT: ${formatMetric(route.current?.medianMetrics?.["total-blocking-time"])} (baseline ${formatMetric(
        route.baseline?.medianMetrics?.["total-blocking-time"],
      )})`,
    );
    lines.push(
      `- CLS: ${formatMetric(route.current?.medianMetrics?.["cumulative-layout-shift"])} (baseline ${formatMetric(
        route.baseline?.medianMetrics?.["cumulative-layout-shift"],
      )})`,
    );
    if (Array.isArray(route.warnings) && route.warnings.length > 0) {
      for (const warning of route.warnings) {
        lines.push(`- Warning: ${warning.message}`);
      }
    } else {
      lines.push("- Warning: none");
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
};

export const readJsonFile = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

export const writeJsonFile = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
};
