import type { ComponentProps } from "react";
import { useCallback, useMemo, useState } from "react";

import LazyImageLibraryDialog from "@/components/lazy/LazyImageLibraryDialog";
import type { ProjectEpisode, ProjectVolumeEntry } from "@/data/projects";
import {
  buildProjectChapterAssetLibraryOptions,
  buildProjectVolumeAssetLibraryOptions,
  resolveProjectEpisodeAssetAltText,
  resolveProjectVolumeAssetAltText,
} from "@/lib/dashboard-image-library";
import { resolveProjectImageFolders } from "@/lib/project-image-folders";

type UseChapterEditorImageLibraryParams = {
  apiBase: string;
  chapterIndex: number;
  draft: ProjectEpisode;
  onNavigateToUploads: () => boolean | Promise<boolean>;
  projectId: string;
  projectTitle: string;
  selectedVolumeEntry: ProjectVolumeEntry | null;
  selectedVolumeNumber: number | null;
  updateDraft: (recipe: (current: ProjectEpisode) => ProjectEpisode) => void;
  updateSelectedVolumeEntry: (updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry) => void;
};

type UseChapterEditorImageLibraryResult = {
  chapterFolder: string;
  chapterImageLibraryOptions: ReturnType<typeof buildProjectChapterAssetLibraryOptions>;
  libraryDialogProps: ComponentProps<typeof LazyImageLibraryDialog> | null;
  openChapterCoverLibrary: () => void;
  openVolumeCoverLibrary: () => void;
};

export function useChapterEditorImageLibrary({
  apiBase,
  chapterIndex,
  draft,
  onNavigateToUploads,
  projectId,
  projectTitle,
  selectedVolumeEntry,
  selectedVolumeNumber,
  updateDraft,
  updateSelectedVolumeEntry,
}: UseChapterEditorImageLibraryParams): UseChapterEditorImageLibraryResult {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<"chapter-cover" | "volume-cover" | null>(null);

  const projectImageFolders = useMemo(
    () => resolveProjectImageFolders(projectId, projectTitle),
    [projectId, projectTitle],
  );
  const chapterImageLibraryOptions = useMemo(
    () =>
      buildProjectChapterAssetLibraryOptions({
        projectFolders: projectImageFolders,
        projectId,
        episode: draft,
        index: Math.max(chapterIndex, 0),
        onRequestNavigateToUploads: onNavigateToUploads,
      }),
    [chapterIndex, draft, onNavigateToUploads, projectId, projectImageFolders],
  );
  const volumeImageLibraryOptions = useMemo(
    () =>
      buildProjectVolumeAssetLibraryOptions({
        projectFolders: projectImageFolders,
        projectId,
      }),
    [projectId, projectImageFolders],
  );

  const openChapterCoverLibrary = useCallback(() => {
    setLibraryTarget("chapter-cover");
    setIsLibraryOpen(true);
  }, []);

  const openVolumeCoverLibrary = useCallback(() => {
    if (selectedVolumeNumber === null) {
      return;
    }
    setLibraryTarget("volume-cover");
    setIsLibraryOpen(true);
  }, [selectedVolumeNumber]);

  const libraryDialogProps = useMemo<ComponentProps<typeof LazyImageLibraryDialog> | null>(() => {
    if (!libraryTarget) {
      return null;
    }

    const isVolumeTarget = libraryTarget === "volume-cover";
    const activeOptions = isVolumeTarget ? volumeImageLibraryOptions : chapterImageLibraryOptions;

    return {
      open: isLibraryOpen,
      onOpenChange: (nextOpen) => {
        setIsLibraryOpen(nextOpen);
        if (!nextOpen) {
          setLibraryTarget(null);
        }
      },
      apiBase,
      uploadFolder: activeOptions.uploadFolder,
      listFolders: activeOptions.listFolders,
      listAll: activeOptions.listAll,
      includeProjectImages: activeOptions.includeProjectImages,
      projectImageProjectIds: activeOptions.projectImageProjectIds,
      projectImagesView: activeOptions.projectImagesView,
      description: isVolumeTarget
        ? "Selecione uma capa para o volume."
        : "Selecione uma capa para o capítulo.",
      allowDeselect: true,
      mode: "single",
      onRequestNavigateToUploads: onNavigateToUploads,
      currentSelectionUrls: isVolumeTarget
        ? selectedVolumeEntry?.coverImageUrl
          ? [selectedVolumeEntry.coverImageUrl]
          : []
        : draft.coverImageUrl
          ? [draft.coverImageUrl]
          : [],
      onSave: ({ urls, items }) => {
        const nextUrl = String(urls[0] || "").trim();
        if (isVolumeTarget && selectedVolumeNumber !== null) {
          updateSelectedVolumeEntry((entry) => ({
            ...entry,
            coverImageUrl: nextUrl,
            coverImageAlt: nextUrl
              ? resolveProjectVolumeAssetAltText(selectedVolumeNumber, items[0]?.altText)
              : "",
          }));
        } else {
          updateDraft((current) => ({
            ...current,
            coverImageUrl: nextUrl,
            coverImageAlt: nextUrl
              ? resolveProjectEpisodeAssetAltText({
                  altText: items[0]?.altText,
                  isChapterBased: true,
                })
              : "",
          }));
        }
        setIsLibraryOpen(false);
        setLibraryTarget(null);
      },
    };
  }, [
    chapterImageLibraryOptions,
    draft.coverImageUrl,
    apiBase,
    isLibraryOpen,
    libraryTarget,
    onNavigateToUploads,
    selectedVolumeEntry?.coverImageUrl,
    selectedVolumeNumber,
    updateDraft,
    updateSelectedVolumeEntry,
    volumeImageLibraryOptions,
  ]);

  return {
    chapterFolder: chapterImageLibraryOptions.uploadFolder,
    chapterImageLibraryOptions,
    libraryDialogProps,
    openChapterCoverLibrary,
    openVolumeCoverLibrary,
  };
}

export default useChapterEditorImageLibrary;
