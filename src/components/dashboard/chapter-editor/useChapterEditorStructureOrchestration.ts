import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { exportMangaCollectionZip } from "@/components/project-reader/manga-collection-export";
import { toast } from "@/components/ui/use-toast";
import type { ProjectEpisode } from "@/data/projects";
import {
  findChapterStructureGroupElement,
  normalizeStructureGroupKeys,
  reorderChaptersWithinStructureGroup,
  resolveChapterStructureGroupKey,
} from "@/lib/dashboard-project-chapter";
import { buildEpisodeKey } from "@/lib/project-episode-key";

import type {
  ChapterStructureGroup,
  ProjectRecord,
  VolumeSelectionOptions,
} from "./chapter-editor-types";

type PersistProjectContext =
  | "epub-import"
  | "volume-editor"
  | "chapter-create"
  | "chapter-reorder"
  | "chapter-delete"
  | "volume-delete"
  | "manga-import"
  | "manga-publication";

type StructureChapterReorderState = { key: string; direction: "up" | "down" } | null;

type UseChapterEditorStructureOrchestrationOptions = {
  activeChapterKey: string | null;
  apiBase: string;
  hasActiveChapter: boolean;
  initialOpenStructureGroupKeys?: string[];
  isVolumeDirty: boolean;
  neutralHref: string;
  onAddChapter: (targetVolume: number | null) => void | Promise<void>;
  onChapterSaved: (
    project: ProjectRecord,
    chapter: ProjectEpisode,
    routeHint?: { number: number; volume?: number },
  ) => void;
  onNavigateToHref: (href: string) => void | Promise<boolean>;
  onPersistProjectSnapshot: (
    snapshot: ProjectRecord,
    options: { context: PersistProjectContext },
  ) => Promise<ProjectRecord | null>;
  onProjectChange: (nextProject: ProjectRecord) => void;
  onSelectedVolumeChange: (
    nextVolume: number,
    options?: VolumeSelectionOptions,
  ) => boolean | Promise<boolean>;
  onStructureGroupKeysChange: (nextKeys: string[]) => void;
  project: ProjectRecord;
  projectSnapshotForImageExport: ProjectRecord;
  requestLeave: () => Promise<boolean>;
  selectedStageChapterId: string | null;
  selectedVolumeNumber: number | null;
  setSelectedStageChapterId: (value: string | null) => void;
  structureGroups: ChapterStructureGroup[];
  structureProjectSnapshot: ProjectRecord;
  supportsStructureReordering: boolean;
};

export type UseChapterEditorStructureOrchestrationResult = {
  activeStructureGroupKey: string;
  handleAddChapterRequest: (targetVolume: number | null) => Promise<void>;
  handleReorderStructureChapter: (chapterKey: string, direction: "up" | "down") => Promise<void>;
  handleSelectPendingStageChapter: (chapterId: string) => Promise<void>;
  handleStructureVolumeExport: (volume: number, groupKey: string) => Promise<void>;
  handleStructureVolumeInteraction: (groupKey: string, nextVolume: number) => Promise<void>;
  openStructureGroupKeys: string[];
  selectedStructureGroupKey: string;
  structureChapterReorderState: StructureChapterReorderState;
  structureVolumeExportKey: string | null;
  toggleStructureGroup: (groupKey: string) => void;
};

export const useChapterEditorStructureOrchestration = ({
  activeChapterKey,
  apiBase,
  hasActiveChapter,
  initialOpenStructureGroupKeys,
  isVolumeDirty,
  neutralHref,
  onAddChapter,
  onChapterSaved,
  onNavigateToHref,
  onPersistProjectSnapshot,
  onProjectChange,
  onSelectedVolumeChange,
  onStructureGroupKeysChange,
  project,
  projectSnapshotForImageExport,
  requestLeave,
  selectedStageChapterId,
  selectedVolumeNumber,
  setSelectedStageChapterId,
  structureGroups,
  structureProjectSnapshot,
  supportsStructureReordering,
}: UseChapterEditorStructureOrchestrationOptions): UseChapterEditorStructureOrchestrationResult => {
  const [structureVolumeExportKey, setStructureVolumeExportKey] = useState<string | null>(null);
  const [structureChapterReorderState, setStructureChapterReorderState] =
    useState<StructureChapterReorderState>(null);

  const activeStructureGroupKey = useMemo(
    () =>
      resolveChapterStructureGroupKey({
        activeChapterKey,
        fallbackToFirstGroup: true,
        hasActiveChapter,
        selectedStageChapterId,
        selectedVolume: selectedVolumeNumber,
        structureGroups,
      }),
    [
      activeChapterKey,
      hasActiveChapter,
      selectedStageChapterId,
      selectedVolumeNumber,
      structureGroups,
    ],
  );

  const selectedStructureGroupKey = useMemo(
    () =>
      resolveChapterStructureGroupKey({
        activeChapterKey,
        hasActiveChapter,
        selectedStageChapterId,
        selectedVolume: selectedVolumeNumber,
        structureGroups,
      }),
    [
      activeChapterKey,
      hasActiveChapter,
      selectedStageChapterId,
      selectedVolumeNumber,
      structureGroups,
    ],
  );

  const structureProjectSnapshotRef = useRef<ProjectRecord>(structureProjectSnapshot);
  useEffect(() => {
    structureProjectSnapshotRef.current = structureProjectSnapshot;
  }, [structureProjectSnapshot]);

  const openStructureGroupKeysRef = useRef<string[]>([]);
  const [openStructureGroupKeys, setOpenStructureGroupKeys] = useState<string[]>(() => {
    const initialKeys = normalizeStructureGroupKeys(initialOpenStructureGroupKeys, structureGroups);
    if (initialKeys.length > 0) {
      return initialKeys;
    }
    return activeStructureGroupKey ? [activeStructureGroupKey] : [];
  });
  const lastAutoSyncedStructureGroupKeyRef = useRef(activeStructureGroupKey);

  useEffect(() => {
    setOpenStructureGroupKeys((currentKeys) => {
      const fallbackGroupKey = structureGroups[0]?.key || "";
      const normalizedActiveStructureGroupKey =
        activeStructureGroupKey &&
        structureGroups.some((group) => group.key === activeStructureGroupKey)
          ? activeStructureGroupKey
          : fallbackGroupKey;
      const normalizedCurrentKeys = normalizeStructureGroupKeys(currentKeys, structureGroups);
      if (normalizedActiveStructureGroupKey !== lastAutoSyncedStructureGroupKeyRef.current) {
        lastAutoSyncedStructureGroupKeyRef.current = normalizedActiveStructureGroupKey;
        if (
          !normalizedActiveStructureGroupKey ||
          normalizedCurrentKeys.includes(normalizedActiveStructureGroupKey)
        ) {
          return normalizedCurrentKeys;
        }
        return [...normalizedCurrentKeys, normalizedActiveStructureGroupKey];
      }
      return normalizedCurrentKeys;
    });
  }, [activeStructureGroupKey, structureGroups]);

  useEffect(() => {
    onStructureGroupKeysChange(openStructureGroupKeys);
  }, [onStructureGroupKeysChange, openStructureGroupKeys]);

  useEffect(() => {
    openStructureGroupKeysRef.current = openStructureGroupKeys;
  }, [openStructureGroupKeys]);

  const handleStructureVolumeInteraction = useCallback(
    async (groupKey: string, nextVolume: number) => {
      const normalizedVolume = Number(nextVolume);
      if (!Number.isFinite(normalizedVolume) || normalizedVolume <= 0) {
        return;
      }
      const scrollAnchorElement = findChapterStructureGroupElement(groupKey);
      const scrollAnchorTop = scrollAnchorElement?.getBoundingClientRect().top;
      const previousOpenGroupKeys = openStructureGroupKeysRef.current;
      const nextOpenGroupKeys = previousOpenGroupKeys.includes(groupKey)
        ? previousOpenGroupKeys.filter((key) => key !== groupKey)
        : [...previousOpenGroupKeys, groupKey];
      setOpenStructureGroupKeys(nextOpenGroupKeys);

      if (!hasActiveChapter && isVolumeDirty && selectedVolumeNumber !== normalizedVolume) {
        const canLeave = await requestLeave();
        if (!canLeave) {
          setOpenStructureGroupKeys(previousOpenGroupKeys);
          return;
        }
      }

      const didSelectVolume = await onSelectedVolumeChange(normalizedVolume, {
        preserveScrollAnchor:
          Number.isFinite(scrollAnchorTop) && typeof scrollAnchorTop === "number"
            ? { groupKey, top: scrollAnchorTop }
            : null,
      });
      if (didSelectVolume === false) {
        setOpenStructureGroupKeys(previousOpenGroupKeys);
      }
    },
    [hasActiveChapter, isVolumeDirty, onSelectedVolumeChange, requestLeave, selectedVolumeNumber],
  );

  const handleSelectPendingStageChapter = useCallback(
    async (chapterId: string) => {
      if (!chapterId || selectedStageChapterId === chapterId) {
        return;
      }
      if (hasActiveChapter) {
        const didNavigate = await onNavigateToHref(neutralHref);
        if (!didNavigate) {
          return;
        }
        setSelectedStageChapterId(chapterId);
        return;
      }
      if (isVolumeDirty) {
        const canLeave = await requestLeave();
        if (!canLeave) {
          return;
        }
      }
      setSelectedStageChapterId(chapterId);
    },
    [
      hasActiveChapter,
      isVolumeDirty,
      neutralHref,
      onNavigateToHref,
      requestLeave,
      selectedStageChapterId,
      setSelectedStageChapterId,
    ],
  );

  const handleAddChapterRequest = useCallback(
    async (targetVolume: number | null) => {
      const canLeave = await requestLeave();
      if (!canLeave) {
        return;
      }
      await onAddChapter(targetVolume);
    },
    [onAddChapter, requestLeave],
  );

  const handleReorderStructureChapter = useCallback(
    async (chapterKey: string, direction: "up" | "down") => {
      if (!supportsStructureReordering || structureChapterReorderState || !chapterKey) {
        return;
      }
      const canLeave = await requestLeave();
      if (!canLeave) {
        return;
      }
      const latestProjectSnapshot = structureProjectSnapshotRef.current;
      const reorderedEpisodes = reorderChaptersWithinStructureGroup(
        Array.isArray(latestProjectSnapshot?.episodeDownloads)
          ? latestProjectSnapshot.episodeDownloads
          : [],
        chapterKey,
        direction,
      );
      if (!reorderedEpisodes) {
        return;
      }
      const optimisticProject = {
        ...latestProjectSnapshot,
        episodeDownloads: reorderedEpisodes,
      };
      setStructureChapterReorderState({ key: chapterKey, direction });
      onProjectChange(optimisticProject);
      try {
        const persistedProject = await onPersistProjectSnapshot(optimisticProject, {
          context: "chapter-reorder",
        });
        if (!persistedProject) {
          onProjectChange(latestProjectSnapshot);
          return;
        }
        const persistedActiveChapter = activeChapterKey
          ? (Array.isArray(persistedProject.episodeDownloads)
              ? persistedProject.episodeDownloads
              : []
            ).find(
              (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
            ) || null
          : null;
        if (persistedActiveChapter) {
          onChapterSaved(persistedProject, persistedActiveChapter, {
            number: persistedActiveChapter.number,
            volume: persistedActiveChapter.volume,
          });
          return;
        }
        onProjectChange(persistedProject);
      } catch {
        onProjectChange(latestProjectSnapshot);
      } finally {
        setStructureChapterReorderState(null);
      }
    },
    [
      activeChapterKey,
      onChapterSaved,
      onPersistProjectSnapshot,
      onProjectChange,
      requestLeave,
      structureChapterReorderState,
      supportsStructureReordering,
    ],
  );

  const handleStructureVolumeExport = useCallback(
    async (volume: number, groupKey: string) => {
      setStructureVolumeExportKey(groupKey);
      try {
        await exportMangaCollectionZip({
          apiBase,
          projectId: String(project.id || ""),
          projectSnapshot: projectSnapshotForImageExport,
          volume,
          includeDrafts: false,
          fallbackName: `${String(project.id || "projeto")}-volume-${volume}.zip`,
        });
        toast({
          title: `ZIP do volume ${volume} exportado`,
          intent: "success",
        });
      } catch {
        toast({
          title: "Não foi possível exportar o volume",
          variant: "destructive",
        });
      } finally {
        setStructureVolumeExportKey(null);
      }
    },
    [apiBase, project.id, projectSnapshotForImageExport],
  );

  const toggleStructureGroup = useCallback(
    (groupKey: string) => {
      setOpenStructureGroupKeys((currentKeys) => {
        const normalizedCurrentKeys = normalizeStructureGroupKeys(currentKeys, structureGroups);
        return normalizedCurrentKeys.includes(groupKey)
          ? normalizedCurrentKeys.filter((key) => key !== groupKey)
          : [...normalizedCurrentKeys, groupKey];
      });
    },
    [structureGroups],
  );

  return {
    activeStructureGroupKey,
    handleAddChapterRequest,
    handleReorderStructureChapter,
    handleSelectPendingStageChapter,
    handleStructureVolumeExport,
    handleStructureVolumeInteraction,
    openStructureGroupKeys,
    selectedStructureGroupKey,
    structureChapterReorderState,
    structureVolumeExportKey,
    toggleStructureGroup,
  };
};

export default useChapterEditorStructureOrchestration;
