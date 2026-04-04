import { useCallback, useState } from "react";

import { toast } from "@/components/ui/use-toast";
import { refetchPublicBootstrapCache } from "@/hooks/use-public-bootstrap";
import { apiFetch } from "@/lib/api-client";
import {
  IMAGE_PUBLICATION_PAGES_REQUIRED_MESSAGE,
  VOLUME_REQUIRED_IDENTITY_MESSAGE,
  normalizeChapterForSave,
} from "@/lib/dashboard-project-chapter";
import {
  getEpisodeCoverAltFallback,
  resolveAssetAltText,
} from "@/lib/image-alt";
import { resolveEpisodeLookup } from "@/lib/project-episode-key";
import { overlayDraftOnProject } from "@/lib/project-epub";
import { findIncompleteDownloadSourceIndex } from "@/lib/project-download-sources";

import type { ProjectEpisode } from "@/data/projects";
import type { ProjectRecord } from "./chapter-editor-types";

type UseChapterEditorPersistenceOptions = {
  activeChapter: ProjectEpisode | null;
  activeChapterKey: string | null;
  apiBase: string;
  draft: ProjectEpisode;
  hasActiveChapter: boolean;
  isDirty: boolean;
  isImageChapter: boolean;
  isPublishedImageChapterMissingPages: boolean;
  normalizeEditorChapter: (chapter: ProjectEpisode) => ProjectEpisode;
  onChapterSaved: (
    project: ProjectRecord,
    chapter: ProjectEpisode,
    routeHint?: { number: number; volume?: number },
  ) => void;
  onVolumeRequiredConflict?: () => void;
  project: ProjectRecord;
};

type UseChapterEditorPersistenceResult = {
  clearIdentityError: () => void;
  closeVolumeRequiredSaveDialog: () => void;
  handleChapterSave: (nextPublicationStatus?: "draft" | "published") => Promise<boolean>;
  handleManualSave: () => Promise<boolean>;
  identityError: string | null;
  isSavingChapter: boolean;
  isVolumeRequiredSaveDialogOpen: boolean;
};

export const useChapterEditorPersistence = ({
  activeChapter,
  activeChapterKey,
  apiBase,
  draft,
  hasActiveChapter,
  isDirty,
  isImageChapter,
  isPublishedImageChapterMissingPages,
  normalizeEditorChapter,
  onChapterSaved,
  onVolumeRequiredConflict,
  project,
}: UseChapterEditorPersistenceOptions): UseChapterEditorPersistenceResult => {
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [isSavingChapter, setIsSavingChapter] = useState(false);
  const [isVolumeRequiredSaveDialogOpen, setIsVolumeRequiredSaveDialogOpen] = useState(false);

  const focusChapterVolumeInput = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }
    const volumeInput = document.getElementById(
      isImageChapter ? "chapter-volume-image" : "chapter-volume-standard",
    );
    if (!(volumeInput instanceof HTMLInputElement)) {
      return;
    }
    volumeInput.focus();
    if (typeof volumeInput.select === "function") {
      volumeInput.select();
    }
  }, [isImageChapter]);

  const closeVolumeRequiredSaveDialog = useCallback(() => {
    setIsVolumeRequiredSaveDialogOpen(false);
    if (typeof window === "undefined") {
      return;
    }
    const scheduleFocus =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) =>
            window.setTimeout(() => callback(performance.now()), 0);
    scheduleFocus(() => {
      focusChapterVolumeInput();
    });
  }, [focusChapterVolumeInput]);

  const blockAmbiguousChapterSave = useCallback(
    (snapshot: ProjectEpisode) => {
      const normalizedSnapshot = normalizeChapterForSave(snapshot, "manga");
      if (normalizedSnapshot.volume !== undefined) {
        return false;
      }
      const nextProjectSnapshot = overlayDraftOnProject(project, activeChapterKey, normalizedSnapshot);
      const saveLookup = resolveEpisodeLookup(
        Array.isArray(nextProjectSnapshot.episodeDownloads)
          ? nextProjectSnapshot.episodeDownloads
          : [],
        normalizedSnapshot.number,
        normalizedSnapshot.volume,
      );
      if (saveLookup.ok || saveLookup.code !== "volume_required") {
        return false;
      }
      setIdentityError(VOLUME_REQUIRED_IDENTITY_MESSAGE);
      onVolumeRequiredConflict?.();
      setIsVolumeRequiredSaveDialogOpen(true);
      return true;
    },
    [activeChapterKey, onVolumeRequiredConflict, project],
  );

  const persistChapter = useCallback(
    async (snapshot: ProjectEpisode) => {
      if (!activeChapter) {
        return snapshot;
      }
      setIdentityError(null);
      const normalizedSnapshot = normalizeChapterForSave(snapshot, "manga");
      const response = await apiFetch(
        apiBase,
        `/api/projects/${project.id}/chapters/${activeChapter.number}${Number.isFinite(Number(activeChapter.volume)) ? `?volume=${Number(activeChapter.volume)}` : ""}`,
        {
          method: "PUT",
          auth: true,
          json: {
            ifRevision: project.revision || "",
            chapter: {
              ...normalizedSnapshot,
              coverImageAlt: snapshot.coverImageUrl
                ? resolveAssetAltText(
                    snapshot.coverImageAlt,
                    getEpisodeCoverAltFallback(true),
                  )
                : "",
            },
          },
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorCode = String(data?.error || "").trim();
        if (errorCode === "duplicate_episode_key") {
          setIdentityError("Já existe um capítulo com essa combinação de número e volume.");
        } else if (errorCode === "volume_required") {
          setIdentityError("Informe o volume para salvar um capítulo com número ambíguo.");
        } else if (errorCode === "image_pages_required_for_publication") {
          toast({
            title: "Não foi possível publicar o capítulo",
            description: IMAGE_PUBLICATION_PAGES_REQUIRED_MESSAGE,
            variant: "destructive",
          });
        } else if (errorCode === "not_found") {
          toast({
            title: "Capítulo não encontrado",
            description: "Recarregue o projeto antes de continuar editando.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Não foi possível salvar o capítulo",
            description: "Tente novamente em alguns instantes.",
            variant: "destructive",
          });
        }
        throw new Error(errorCode || "chapter_save_failed");
      }
      const data = (await response.json()) as {
        project?: ProjectRecord;
        chapter?: ProjectEpisode;
      };
      if (!data?.project || !data?.chapter) {
        throw new Error("chapter_save_missing_payload");
      }
      const normalizedSavedChapter = normalizeEditorChapter(data.chapter);
      onChapterSaved(data.project, normalizedSavedChapter, {
        number: normalizedSnapshot.number,
        volume: normalizedSnapshot.volume,
      });
      void refetchPublicBootstrapCache(apiBase).catch(() => undefined);
      return normalizedSavedChapter;
    },
    [activeChapter, apiBase, normalizeEditorChapter, onChapterSaved, project.id, project.revision],
  );

  const handleChapterSave = useCallback(
    async (nextPublicationStatus?: "draft" | "published") => {
      if (!hasActiveChapter || isSavingChapter) {
        return true;
      }
      if (findIncompleteDownloadSourceIndex(draft.sources) >= 0) {
        toast({
          title: "Complete as fontes de download",
          description: "Selecione uma fonte e informe a URL antes de salvar o capítulo.",
          variant: "destructive",
        });
        return false;
      }
      const resolvedPublicationStatus = nextPublicationStatus ?? draft.publicationStatus;
      if (
        resolvedPublicationStatus === "published" &&
        isPublishedImageChapterMissingPages
      ) {
        toast({
          title: "Não foi possível publicar o capítulo",
          description: IMAGE_PUBLICATION_PAGES_REQUIRED_MESSAGE,
          variant: "destructive",
        });
        return false;
      }
      const shouldPersist = isDirty || resolvedPublicationStatus !== draft.publicationStatus;
      if (!shouldPersist) {
        return true;
      }
      const nextSnapshot = {
        ...draft,
        publicationStatus: resolvedPublicationStatus,
      };
      if (blockAmbiguousChapterSave(nextSnapshot)) {
        return false;
      }
      setIsSavingChapter(true);
      try {
        await persistChapter(nextSnapshot);
        return true;
      } catch {
        return false;
      } finally {
        setIsSavingChapter(false);
      }
    },
    [
      blockAmbiguousChapterSave,
      draft,
      hasActiveChapter,
      isDirty,
      isPublishedImageChapterMissingPages,
      isSavingChapter,
      persistChapter,
    ],
  );

  const handleManualSave = useCallback(async () => {
    if (!hasActiveChapter) {
      return true;
    }
    return handleChapterSave(draft.publicationStatus);
  }, [draft.publicationStatus, handleChapterSave, hasActiveChapter]);

  return {
    clearIdentityError: () => setIdentityError(null),
    closeVolumeRequiredSaveDialog,
    handleChapterSave,
    handleManualSave,
    identityError,
    isSavingChapter,
    isVolumeRequiredSaveDialogOpen,
  };
};
