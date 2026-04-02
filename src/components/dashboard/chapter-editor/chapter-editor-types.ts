import type { StageChapter } from "@/components/project-reader/MangaWorkflowPanel";
import type { Project, ProjectEpisode } from "@/data/projects";

export type ChapterStructureGroup = {
  key: string;
  label: string;
  volume: number | null;
  hasMetadata: boolean;
  chapterCount: number;
  allItems: ProjectEpisode[];
  visibleItems: ProjectEpisode[];
  pendingItems: StageChapter[];
  visiblePendingItems: StageChapter[];
};

export type StructureScrollAnchor = {
  groupKey: string;
  top: number;
};

export type VolumeSelectionOptions = {
  preserveScrollAnchor?: StructureScrollAnchor | null;
};

export type ProjectRecord = Project & {
  revision?: string;
};

export type ChapterEditorPaneHandle = {
  hasUnsavedChanges: (options?: { nextHref?: string; routeExit?: boolean }) => boolean;
  requestLeave: (options?: { nextHref?: string; routeExit?: boolean }) => Promise<boolean>;
};
