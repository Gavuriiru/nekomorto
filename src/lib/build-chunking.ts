export type ManualChunkName =
  | "lexical"
  | "lexical-editor"
  | "lexical-viewer"
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

const lexicalSharedLocalPatterns = [
  "/src/components/lexical/nodes/EpubHeadingNode.ts",
  "/src/components/lexical/nodes/EpubImageNode.tsx",
  "/src/components/lexical/nodes/EpubParagraphNode.ts",
  "/src/components/lexical/nodes/ImageNode.tsx",
  "/src/components/lexical/nodes/VideoNode.tsx",
  "/src/components/lexical/nodes/epub-style.ts",
  "/src/lib/lexical/empty-state.ts",
] as const;

const lexicalViewerLocalPatterns = [
  "/src/components/lexical/LexicalViewer.tsx",
  "/src/components/lexical/LexicalViewerNodes.ts",
  "/src/components/lexical/lexical-viewer.css",
  "/src/components/lexical/LexicalViewerTheme.ts",
  "/src/components/lexical/viewer-nodes/",
  "/src/lib/lexical/viewer.ts",
  "/src/components/lexical/editor/nodes/EmojiNode.tsx",
  "/src/components/lexical/editor/nodes/KeywordNode.ts",
  "/src/components/lexical/editor/nodes/LayoutContainerNode.ts",
  "/src/components/lexical/editor/nodes/LayoutItemNode.ts",
  "/src/components/lexical/editor/nodes/MentionNode.ts",
  "/src/components/lexical/editor/nodes/SpecialTextNode.tsx",
  "/src/components/lexical/editor/nodes/TweetComponent.tsx",
  "/src/components/lexical/editor/nodes/TweetNode.ts",
  "/src/components/lexical/editor/nodes/YouTubeComponent.tsx",
  "/src/components/lexical/editor/nodes/YouTubeNode.ts",
  "/src/components/lexical/editor/plugins/CollapsiblePlugin/CollapsibleContainerNode.ts",
  "/src/components/lexical/editor/plugins/CollapsiblePlugin/CollapsibleContentNode.ts",
  "/src/components/lexical/editor/plugins/CollapsiblePlugin/CollapsibleTitleNode.ts",
  "/src/components/lexical/editor/plugins/CollapsiblePlugin/CollapsibleUtils.ts",
] as const;

const lexicalEditorLocalPatterns = [
  "/src/components/lexical/editor/",
  "/src/components/lexical/LexicalEditor.tsx",
  "/src/components/lexical/LexicalEditorShell.tsx",
  "/src/components/lexical/LexicalToolbar.tsx",
  "/src/components/lexical/editor-nodes.ts",
  "/src/lib/lexical/nodes.ts",
  "/src/lib/lexical/serialize.ts",
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

  if (includesAny(normalizedId, lexicalViewerLocalPatterns)) {
    return "lexical-viewer";
  }

  if (
    includesAny(normalizedId, lexicalNodeModulePatterns) ||
    includesAny(normalizedId, lexicalSharedLocalPatterns)
  ) {
    return "lexical";
  }

  if (includesAny(normalizedId, lexicalEditorLocalPatterns)) {
    return "lexical-editor";
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
