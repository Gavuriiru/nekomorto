import { useCallback, useEffect, useRef, useState } from "react";

export type LeaveGuardRequestOptions = {
  nextHref?: string;
  routeExit?: boolean;
};

export type LeaveGuardDialogState = {
  chapterDirty: boolean;
  volumeDirty: boolean;
  mangaWorkflowDirty: boolean;
};

type UseChapterEditorLeaveGuardOptions = {
  hasActiveChapter: boolean;
  hasMangaWorkflowUnsavedChanges: () => boolean;
  isDirty: boolean;
  isMangaProject: boolean;
  isVolumeDirty: boolean;
  neutralHref: string;
  onClearSelectedVolume: () => void;
  onDiscardPreparedChapters: () => void;
  onSaveChapter: (publicationStatus: "draft" | "published") => Promise<boolean>;
  onSavePreparedChaptersAsDraft: () => Promise<boolean>;
  onSaveVolumes: () => void | Promise<boolean>;
  selectedVolumeNumber: number | null;
};

export const useChapterEditorLeaveGuard = ({
  hasActiveChapter,
  hasMangaWorkflowUnsavedChanges,
  isDirty,
  isMangaProject,
  isVolumeDirty,
  neutralHref,
  onClearSelectedVolume,
  onDiscardPreparedChapters,
  onSaveChapter,
  onSavePreparedChaptersAsDraft,
  onSaveVolumes,
  selectedVolumeNumber,
}: UseChapterEditorLeaveGuardOptions) => {
  const leaveDialogResolversRef = useRef<Array<(value: boolean) => void>>([]);
  const [leaveDialogState, setLeaveDialogState] = useState<LeaveGuardDialogState | null>(null);

  const resolveLeaveDialog = useCallback((nextValue: boolean) => {
    const resolvers = [...leaveDialogResolversRef.current];
    leaveDialogResolversRef.current = [];
    setLeaveDialogState(null);
    resolvers.forEach((resolve) => resolve(nextValue));
  }, []);

  const isEditorRouteHref = useCallback(
    (href?: string | null) => {
      const normalizedHref = String(href || "").trim();
      if (!normalizedHref) {
        return false;
      }
      try {
        const resolvedUrl = new URL(normalizedHref, window.location.origin);
        const editorBaseUrl = new URL(neutralHref, window.location.origin);
        const editorPath = editorBaseUrl.pathname.replace(/\/+$/, "");
        const candidatePath = resolvedUrl.pathname.replace(/\/+$/, "");
        return (
          resolvedUrl.origin === editorBaseUrl.origin &&
          (candidatePath === editorPath || candidatePath.startsWith(`${editorPath}/`))
        );
      } catch {
        return false;
      }
    },
    [neutralHref],
  );

  const hasUnsavedChanges = useCallback(
    (options?: LeaveGuardRequestOptions) => {
      const chapterDirty = hasActiveChapter && isDirty;
      const volumeDirty = isVolumeDirty;
      const shouldCheckMangaWorkflow =
        Boolean(options?.routeExit) ||
        (!!options?.nextHref && !isEditorRouteHref(options.nextHref));
      const mangaWorkflowDirty =
        shouldCheckMangaWorkflow &&
        isMangaProject &&
        Boolean(hasMangaWorkflowUnsavedChanges());
      return chapterDirty || volumeDirty || mangaWorkflowDirty;
    },
    [
      hasActiveChapter,
      hasMangaWorkflowUnsavedChanges,
      isDirty,
      isEditorRouteHref,
      isMangaProject,
      isVolumeDirty,
    ],
  );

  const requestLeave = useCallback(
    async (options?: LeaveGuardRequestOptions) => {
      const chapterDirty = hasActiveChapter && isDirty;
      const volumeDirty = isVolumeDirty;
      const mangaWorkflowDirty =
        (Boolean(options?.routeExit) ||
          (!!options?.nextHref && !isEditorRouteHref(options.nextHref))) &&
        isMangaProject &&
        Boolean(hasMangaWorkflowUnsavedChanges());
      if (!chapterDirty && !volumeDirty && !mangaWorkflowDirty) {
        return true;
      }
      return await new Promise<boolean>((resolve) => {
        leaveDialogResolversRef.current.push(resolve);
        setLeaveDialogState({ chapterDirty, volumeDirty, mangaWorkflowDirty });
      });
    },
    [
      hasActiveChapter,
      hasMangaWorkflowUnsavedChanges,
      isDirty,
      isEditorRouteHref,
      isMangaProject,
      isVolumeDirty,
    ],
  );

  const handleLeaveDialogSaveAndContinue = useCallback(
    async (publicationStatus: "draft" | "published") => {
      const shouldPersistChapter = Boolean(leaveDialogState?.chapterDirty && hasActiveChapter);
      const shouldPersistVolumes = Boolean(leaveDialogState?.volumeDirty);
      const shouldPersistMangaWorkflow = Boolean(leaveDialogState?.mangaWorkflowDirty);

      if (shouldPersistChapter) {
        const didSaveChapter = await onSaveChapter(
          shouldPersistMangaWorkflow ? "draft" : publicationStatus,
        );
        if (!didSaveChapter) {
          return;
        }
      }

      if (shouldPersistVolumes) {
        const didSaveVolumes = await onSaveVolumes();
        if (!didSaveVolumes) {
          return;
        }
      }

      if (shouldPersistMangaWorkflow) {
        const didSavePreparedChapters = await onSavePreparedChaptersAsDraft();
        if (!didSavePreparedChapters) {
          return;
        }
      }

      resolveLeaveDialog(true);
    },
    [
      hasActiveChapter,
      leaveDialogState?.chapterDirty,
      leaveDialogState?.mangaWorkflowDirty,
      leaveDialogState?.volumeDirty,
      onSaveChapter,
      onSavePreparedChaptersAsDraft,
      onSaveVolumes,
      resolveLeaveDialog,
    ],
  );

  const handleLeaveDialogDiscardAndContinue = useCallback(() => {
    if (leaveDialogState?.mangaWorkflowDirty) {
      onDiscardPreparedChapters();
    }
    resolveLeaveDialog(true);
  }, [leaveDialogState?.mangaWorkflowDirty, onDiscardPreparedChapters, resolveLeaveDialog]);

  const handleLeaveDialogCancel = useCallback(() => {
    resolveLeaveDialog(false);
  }, [resolveLeaveDialog]);

  const handleCloseSelectedVolume = useCallback(async () => {
    if (selectedVolumeNumber === null || hasActiveChapter) {
      return;
    }
    const canLeave = await requestLeave();
    if (!canLeave) {
      return;
    }
    onClearSelectedVolume();
  }, [hasActiveChapter, onClearSelectedVolume, requestLeave, selectedVolumeNumber]);

  useEffect(
    () => () => {
      if (leaveDialogResolversRef.current.length > 0) {
        const resolvers = [...leaveDialogResolversRef.current];
        leaveDialogResolversRef.current = [];
        resolvers.forEach((resolve) => resolve(false));
      }
    },
    [],
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const mangaWorkflowDirty =
        isMangaProject && Boolean(hasMangaWorkflowUnsavedChanges());
      if ((!hasActiveChapter || !isDirty) && !isVolumeDirty && !mangaWorkflowDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    hasActiveChapter,
    hasMangaWorkflowUnsavedChanges,
    isDirty,
    isMangaProject,
    isVolumeDirty,
  ]);

  return {
    handleCloseSelectedVolume,
    handleLeaveDialogCancel,
    handleLeaveDialogDiscardAndContinue,
    handleLeaveDialogSaveAndContinue,
    hasUnsavedChanges,
    leaveDialogState,
    requestLeave,
  };
};
