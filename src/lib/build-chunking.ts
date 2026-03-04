export type ManualChunkName =
  | "lexical"
  | "charts"
  | "mui-date-time-fields"
  | "mui"
  | "react-core";

const includesAny = (id: string, patterns: readonly string[]) =>
  patterns.some((pattern) => id.includes(pattern));

const lexicalNodeModulePatterns = [
  "/node_modules/@lexical/",
  "/node_modules/lexical/",
  "/node_modules/yjs/",
] as const;

const lexicalLocalPatterns = [
  "/src/lexical-playground/",
  "/src/components/lexical/",
  "/src/lib/lexical/",
] as const;

const chartsNodeModulePatterns = [
  "/node_modules/recharts/",
  "/node_modules/recharts-scale/",
  "/node_modules/victory-vendor/",
  "/node_modules/d3-",
] as const;

const chartsLocalPatterns = [
  "/src/pages/DashboardAnalytics.tsx",
  "/src/components/ui/chart.tsx",
] as const;

const muiDateTimeFieldsPatterns = [
  "/node_modules/@mui/x-date-pickers/",
  "/node_modules/@mui/x-date-pickers-pro/",
  "/node_modules/@mui/x-internals/",
  "/node_modules/rifm/",
  "/src/components/ui/mui-date-time-fields.tsx",
] as const;

const muiPatterns = [
  "/node_modules/@mui/",
  "/node_modules/@emotion/",
  "/node_modules/@popperjs/core/",
  "/node_modules/react-transition-group/",
] as const;

const reactCorePatterns = [
  "/node_modules/react/",
  "/node_modules/react-dom/",
  "/node_modules/scheduler/",
  "commonjsHelpers.js",
] as const;

export const normalizeChunkModuleId = (id: string) => id.replace(/\\/g, "/");

export const classifyManualChunk = (id: string): ManualChunkName | undefined => {
  const normalizedId = normalizeChunkModuleId(id);

  if (
    includesAny(normalizedId, lexicalNodeModulePatterns) ||
    includesAny(normalizedId, lexicalLocalPatterns)
  ) {
    return "lexical";
  }

  if (
    includesAny(normalizedId, chartsNodeModulePatterns) ||
    includesAny(normalizedId, chartsLocalPatterns)
  ) {
    return "charts";
  }

  if (includesAny(normalizedId, muiDateTimeFieldsPatterns)) {
    return "mui-date-time-fields";
  }

  if (includesAny(normalizedId, muiPatterns)) {
    return "mui";
  }

  if (includesAny(normalizedId, reactCorePatterns)) {
    return "react-core";
  }

  return undefined;
};
