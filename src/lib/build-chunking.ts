export type ManualChunkName =
  | "lexical"
  | "lexical-editor"
  | "lexical-viewer"
  | "charts"
  | "react-core";

const includesAny = (id: string, patterns: readonly string[]) =>
  patterns.some((pattern) => id.includes(pattern));

const lexicalNodeModulePatterns = [
  "/node_modules/@lexical/",
  "/node_modules/lexical/",
  "/node_modules/yjs/",
] as const;

const chartsNodeModulePatterns = [
  "/node_modules/recharts/",
  "/node_modules/recharts-scale/",
  "/node_modules/victory-vendor/",
  "/node_modules/d3-",
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

  if (includesAny(normalizedId, lexicalNodeModulePatterns)) {
    return "lexical";
  }

  if (includesAny(normalizedId, chartsNodeModulePatterns)) {
    return "charts";
  }

  if (includesAny(normalizedId, reactCorePatterns)) {
    return "react-core";
  }

  return undefined;
};
