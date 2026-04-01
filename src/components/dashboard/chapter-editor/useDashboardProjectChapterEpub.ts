import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import type { Project, ProjectEpisode, ProjectVolumeCover } from "@/data/projects";
import { toast } from "@/components/ui/use-toast";
import { createSlug } from "@/lib/post-content";
import { buildEpisodeKey } from "@/lib/project-episode-key";
import {
  EPUB_CAPABILITY_UNKNOWN_MESSAGE,
  EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
  EPUB_EXPORT_GENERIC_MESSAGE,
  EPUB_EXPORT_ROUTE_MISSING_MESSAGE,
  EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
  EPUB_IMPORT_INVALID_SNAPSHOT_MESSAGE,
  EPUB_IMPORT_LEGACY_PROJECT_MISSING_MESSAGE,
  EPUB_IMPORT_PROCESSING_MESSAGE,
  EPUB_IMPORT_ROUTE_MISSING_MESSAGE,
  EPUB_IMPORT_SNAPSHOT_TOO_LARGE_MESSAGE,
  EPUB_NETWORK_ERROR_MESSAGE,
  buildEpubImportProjectSnapshot,
  buildProjectSnapshotForEpubExport,
  downloadBinaryResponse,
  isEpubCssEngineFailureDetail,
  isLegacyMultipartSnapshotTooLargeError,
  mergeImportedChaptersIntoProject,
  mergeImportedVolumeCoversIntoProject,
  normalizeEpubImportJob,
  type EpubImportJob,
} from "@/lib/project-epub";
import { apiFetch } from "@/lib/api-client";
import { formatBuildMetadataLabel, getFrontendBuildMetadata } from "@/lib/frontend-build";
import { logOriginApiBaseMismatchOnce } from "@/lib/dev-diagnostics";
import {
  normalizeEpubImportPreviewPayload,
  normalizeOriginLabel,
  resolveImportedChapterCount,
} from "@/lib/dashboard-project-chapter";

import { useDashboardProjectChapterEditorResource } from "./useDashboardProjectChapterEditorResource";

type ProjectRecord = Project & {
  revision?: string;
};

type PersistProjectContext =
  | "epub-import"
  | "volume-editor"
  | "chapter-create"
  | "chapter-reorder"
  | "chapter-delete"
  | "volume-delete"
  | "manga-import"
  | "manga-publication";

type EpubCapabilityState = {
  message: string;
  variant: "destructive" | "warning";
} | null;

type UseDashboardProjectChapterEpubOptions = {
  activeChapterKey: string | null;
  apiBase: string;
  navigateToChapterEditor: (
    targetProjectId: string,
    targetChapterNumber: unknown,
    targetVolume?: unknown,
    options?: { replace?: boolean },
  ) => void;
  normalizeChapterDraft: (chapter: ProjectEpisode) => ProjectEpisode;
  onProjectUpdated: (project: ProjectRecord) => void;
  onDraftUpdated: (chapter: ProjectEpisode) => void;
  persistProjectSnapshot: (
    snapshot: ProjectRecord,
    options: { context: PersistProjectContext },
  ) => Promise<ProjectRecord | null>;
  projectSnapshot: ProjectRecord | null;
};

export type DashboardProjectChapterEpubState = {
  backendBuildLabel: string | null;
  backendSupportsEpubExport: boolean;
  backendSupportsEpubImport: boolean;
  epubCapabilityState: EpubCapabilityState;
  epubExportIncludeDrafts: boolean;
  epubExportVolume: string;
  epubImportAsDraft: boolean;
  epubImportFile: File | null;
  epubImportInputRef: RefObject<HTMLInputElement | null>;
  epubImportTargetVolume: string;
  frontendBuildLabel: string | null;
  handleEpubImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleExportEpub: () => Promise<void>;
  handleImportEpub: () => Promise<void>;
  isExportingEpub: boolean;
  isImportingEpub: boolean;
  openEpubImportPicker: (options: { autoImportAfterSelect: boolean }) => void;
  resetPendingEpubAutoImport: () => void;
  setEpubExportIncludeDrafts: Dispatch<SetStateAction<boolean>>;
  setEpubExportVolume: Dispatch<SetStateAction<string>>;
  setEpubImportAsDraft: Dispatch<SetStateAction<boolean>>;
  setEpubImportTargetVolume: Dispatch<SetStateAction<string>>;
};

export const useDashboardProjectChapterEpub = ({
  activeChapterKey,
  apiBase,
  navigateToChapterEditor,
  normalizeChapterDraft,
  onProjectUpdated,
  onDraftUpdated,
  persistProjectSnapshot,
  projectSnapshot,
}: UseDashboardProjectChapterEpubOptions): DashboardProjectChapterEpubState => {
  const [epubImportFile, setEpubImportFile] = useState<File | null>(null);
  const [epubImportTargetVolume, setEpubImportTargetVolume] = useState("");
  const [epubImportAsDraft, setEpubImportAsDraft] = useState(true);
  const [isImportingEpub, setIsImportingEpub] = useState(false);
  const [epubExportVolume, setEpubExportVolume] = useState("");
  const [epubExportIncludeDrafts, setEpubExportIncludeDrafts] = useState(false);
  const [isExportingEpub, setIsExportingEpub] = useState(false);
  const epubImportInputRef = useRef<HTMLInputElement | null>(null);
  const pendingEpubAutoImportRef = useRef(false);
  const {
    backendBuildMetadata,
    backendCapabilities,
    backendCapabilitiesError,
    clearPendingEpubImportIds,
    cleanupPendingEpubImports,
    registerPendingEpubImportIds,
    setEpubRouteStatus,
  } = useDashboardProjectChapterEditorResource(apiBase);

  useEffect(() => {
    return () => {
      cleanupPendingEpubImports();
    };
  }, [cleanupPendingEpubImports]);

  const frontendBuildMetadata = useMemo(() => getFrontendBuildMetadata(), []);
  const locationOrigin = useMemo(
    () => (typeof window !== "undefined" && window.location ? window.location.origin : ""),
    [],
  );
  const backendSupportsEpubImport = backendCapabilities?.project_epub_import === true;
  const backendSupportsEpubExport = backendCapabilities?.project_epub_export === true;
  const backendSupportsEpubImportAsync = backendCapabilities?.project_epub_import_async === true;
  const epubCapabilityState = useMemo(() => {
    if (backendCapabilitiesError) {
      return {
        message: EPUB_CAPABILITY_UNKNOWN_MESSAGE,
        variant: "destructive" as const,
      };
    }
    if (
      backendCapabilities &&
      (!backendCapabilities.project_epub_import || !backendCapabilities.project_epub_export)
    ) {
      return {
        message: EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
        variant: "warning" as const,
      };
    }
    return null;
  }, [backendCapabilities, backendCapabilitiesError]);
  const backendBuildLabel = useMemo(
    () => formatBuildMetadataLabel(backendBuildMetadata),
    [backendBuildMetadata],
  );
  const frontendBuildLabel = useMemo(
    () => formatBuildMetadataLabel(frontendBuildMetadata),
    [frontendBuildMetadata],
  );

  const logEpubParityIssue = useCallback(
    ({
      path,
      status,
      reason,
    }: {
      path: string;
      reason: string;
      status: number | "blocked" | "network";
    }) => {
      console.warn("epub_backend_parity_mismatch", {
        apiBase,
        backend: backendBuildMetadata,
        contractVersion: "v1",
        frontend: frontendBuildMetadata,
        locationOrigin,
        path,
        reason,
        status,
      });
    },
    [apiBase, backendBuildMetadata, frontendBuildMetadata, locationOrigin],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    const normalizedLocationOrigin = normalizeOriginLabel(locationOrigin);
    const normalizedApiBase = normalizeOriginLabel(apiBase);
    if (
      normalizedLocationOrigin === "indisponivel" ||
      normalizedApiBase === "indisponivel" ||
      normalizedLocationOrigin === normalizedApiBase
    ) {
      return;
    }
    logOriginApiBaseMismatchOnce({
      locationOrigin: normalizedLocationOrigin,
      apiBase: normalizedApiBase,
      frontend: frontendBuildMetadata,
      backend: backendBuildMetadata,
    });
  }, [apiBase, backendBuildMetadata, frontendBuildMetadata, locationOrigin]);

  const openEpubImportPicker = useCallback(
    ({ autoImportAfterSelect }: { autoImportAfterSelect: boolean }) => {
      const input = epubImportInputRef.current;
      if (!input || isImportingEpub || !backendSupportsEpubImport) {
        return;
      }
      pendingEpubAutoImportRef.current = autoImportAfterSelect;
      input.value = "";
      input.click();
    },
    [backendSupportsEpubImport, isImportingEpub],
  );

  const handleEpubImportFailureResponse = useCallback((response: Response, data: unknown) => {
    const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    if (response.status === 404) {
      if (payload?.error === "project_not_found") {
        setEpubRouteStatus("legacy_project_not_found");
        toast({
          title: "Falha ao importar EPUB",
          description: EPUB_IMPORT_LEGACY_PROJECT_MISSING_MESSAGE,
          variant: "destructive",
        });
        return;
      }
      setEpubRouteStatus("route_unreachable_for_current_origin");
      toast({
        title: "Falha ao importar EPUB",
        description: EPUB_IMPORT_ROUTE_MISSING_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (response.status === 403) {
      setEpubRouteStatus("forbidden");
      toast({
        title: "Falha ao importar EPUB",
        description: "Você não tem permissão para importar EPUB.",
        variant: "destructive",
      });
      return;
    }
    if (
      (typeof payload?.error === "string" && payload.error === "project_snapshot_too_large") ||
      isLegacyMultipartSnapshotTooLargeError(payload?.error, payload?.detail)
    ) {
      setEpubRouteStatus("ok");
      toast({
        title: "Falha ao importar EPUB",
        description: EPUB_IMPORT_SNAPSHOT_TOO_LARGE_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (typeof payload?.error === "string" && payload.error === "invalid_project_snapshot") {
      setEpubRouteStatus("ok");
      toast({
        title: "Falha ao importar EPUB",
        description: EPUB_IMPORT_INVALID_SNAPSHOT_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (typeof payload?.error === "string" && payload.error === "duplicate_episode_key") {
      setEpubRouteStatus("ok");
      toast({
        title: "Falha ao importar EPUB",
        description: EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (
      typeof payload?.error === "string" &&
      payload.error === "epub_import_failed" &&
      (isEpubCssEngineFailureDetail(payload?.detail) ||
        !(typeof payload?.detail === "string" && payload.detail.trim().length > 0))
    ) {
      toast({
        title: "Falha ao importar EPUB",
        description: EPUB_IMPORT_PROCESSING_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Falha ao importar EPUB",
      description:
        typeof payload?.detail === "string"
          ? payload.detail
          : "Não foi possível processar o arquivo informado.",
      variant: "destructive",
    });
  }, [setEpubRouteStatus]);

  const applyImportedEpubPayload = useCallback(
    async (payload: unknown, baseProjectSnapshot: ProjectRecord) => {
      setEpubRouteStatus("ok");
      registerPendingEpubImportIds(payload);
      const data = normalizeEpubImportPreviewPayload(payload);
      const chapters = Array.isArray(data?.chapters) ? (data.chapters as ProjectEpisode[]) : [];
      const volumeCovers = Array.isArray(data?.volumeCovers)
        ? (data.volumeCovers as Array<
            ProjectVolumeCover & { mergeMode?: "create" | "update" | "preserve_existing" }
          >)
        : [];

      const importedSnapshot = mergeImportedVolumeCoversIntoProject(
        mergeImportedChaptersIntoProject(baseProjectSnapshot, chapters),
        volumeCovers,
      );
      const persistedProject = await persistProjectSnapshot(importedSnapshot, {
        context: "epub-import",
      });
      if (!persistedProject) {
        return;
      }

      clearPendingEpubImportIds();
      onProjectUpdated(persistedProject);

      const importedKeys = chapters
        .map((chapter) => buildEpisodeKey(chapter.number, chapter.volume))
        .filter(Boolean);
      const persistedChapters = Array.isArray(persistedProject.episodeDownloads)
        ? [...persistedProject.episodeDownloads]
        : [];
      persistedChapters.sort((left, right) => {
        const leftVolume = Number(left.volume || 0);
        const rightVolume = Number(right.volume || 0);
        if (leftVolume !== rightVolume) {
          return leftVolume - rightVolume;
        }
        return Number(left.number || 0) - Number(right.number || 0);
      });

      const currentPersistedChapter =
        activeChapterKey && importedKeys.includes(activeChapterKey)
          ? persistedChapters.find(
              (chapter) => buildEpisodeKey(chapter.number, chapter.volume) === activeChapterKey,
            ) || null
          : null;
      const firstImportedChapter =
        persistedChapters.find((chapter) =>
          importedKeys.includes(buildEpisodeKey(chapter.number, chapter.volume)),
        ) || null;

      if (currentPersistedChapter) {
        onDraftUpdated(normalizeChapterDraft(currentPersistedChapter));
      } else if (firstImportedChapter) {
        navigateToChapterEditor(
          persistedProject.id,
          firstImportedChapter.number,
          firstImportedChapter.volume,
          { replace: true },
        );
      }

      const importedChapterCount = resolveImportedChapterCount(data, chapters);
      toast({
        title: "EPUB importado",
        description: `${importedChapterCount} capítulo(s) incorporados ao projeto.`,
        intent: "success",
      });
    },
    [
      activeChapterKey,
      clearPendingEpubImportIds,
      navigateToChapterEditor,
      normalizeChapterDraft,
      onDraftUpdated,
      onProjectUpdated,
      persistProjectSnapshot,
      registerPendingEpubImportIds,
      setEpubRouteStatus,
    ],
  );

  const pollEpubImportJob = useCallback(
    async (jobId: string) => {
      while (true) {
        const response = await apiFetch(apiBase, `/api/projects/epub/import/jobs/${jobId}`, {
          auth: true,
          cache: "no-store",
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          handleEpubImportFailureResponse(response, data);
          return null;
        }
        const data = (await response.json().catch(() => null)) as { job?: EpubImportJob } | null;
        const job = normalizeEpubImportJob(data?.job);
        if (!job) {
          toast({
            title: "Falha ao importar EPUB",
            description: EPUB_IMPORT_PROCESSING_MESSAGE,
            variant: "destructive",
          });
          return null;
        }
        if (job.status === "queued" || job.status === "processing") {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
          continue;
        }
        return job;
      }
    },
    [apiBase, handleEpubImportFailureResponse],
  );

  const submitEpubImportSyncLegacy = useCallback(
    async (file: File, options: { skipImportingState?: boolean } = {}) => {
      if (!projectSnapshot || (isImportingEpub && !options.skipImportingState)) {
        return;
      }
      if (!backendSupportsEpubImport) {
        logEpubParityIssue({
          path: "/api/projects/epub/import",
          status: "blocked",
          reason: backendCapabilitiesError ? "contract_unreachable" : "capability_missing",
        });
        toast({
          title: "Falha ao importar EPUB",
          description: backendCapabilitiesError
            ? EPUB_CAPABILITY_UNKNOWN_MESSAGE
            : EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
          variant: "destructive",
        });
        return;
      }

      if (!options.skipImportingState) {
        setIsImportingEpub(true);
      }

      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("project", JSON.stringify(buildEpubImportProjectSnapshot(projectSnapshot)));
        if (epubImportTargetVolume.trim()) {
          formData.set("targetVolume", epubImportTargetVolume.trim());
        }
        formData.set("defaultStatus", epubImportAsDraft ? "draft" : "published");

        const response = await apiFetch(apiBase, "/api/projects/epub/import", {
          method: "POST",
          auth: true,
          body: formData,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          handleEpubImportFailureResponse(response, data);
          return;
        }

        await applyImportedEpubPayload(await response.json(), projectSnapshot);
      } catch {
        setEpubRouteStatus("network_unreachable");
        logEpubParityIssue({
          path: "/api/projects/epub/import",
          status: "network",
          reason: "network_unreachable",
        });
        toast({
          title: "Falha ao importar EPUB",
          description: EPUB_NETWORK_ERROR_MESSAGE,
          variant: "destructive",
        });
      } finally {
        pendingEpubAutoImportRef.current = false;
        if (!options.skipImportingState) {
          setIsImportingEpub(false);
        }
      }
    },
    [
      apiBase,
      applyImportedEpubPayload,
      backendCapabilitiesError,
      backendSupportsEpubImport,
      epubImportAsDraft,
      epubImportTargetVolume,
      handleEpubImportFailureResponse,
      isImportingEpub,
      logEpubParityIssue,
      projectSnapshot,
      setEpubRouteStatus,
    ],
  );

  const submitEpubImport = useCallback(
    async (file: File) => {
      if (!projectSnapshot || isImportingEpub) {
        return;
      }
      if (!backendSupportsEpubImport) {
        logEpubParityIssue({
          path: "/api/projects/epub/import",
          status: "blocked",
          reason: backendCapabilitiesError ? "contract_unreachable" : "capability_missing",
        });
        toast({
          title: "Falha ao importar EPUB",
          description: backendCapabilitiesError
            ? EPUB_CAPABILITY_UNKNOWN_MESSAGE
            : EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
          variant: "destructive",
        });
        return;
      }

      setIsImportingEpub(true);
      try {
        const projectSnapshotForImport = projectSnapshot;
        const formData = new FormData();
        formData.set("file", file);
        formData.set(
          "project",
          JSON.stringify(buildEpubImportProjectSnapshot(projectSnapshotForImport)),
        );
        if (epubImportTargetVolume.trim()) {
          formData.set("targetVolume", epubImportTargetVolume.trim());
        }
        formData.set("defaultStatus", epubImportAsDraft ? "draft" : "published");

        if (backendSupportsEpubImportAsync) {
          const jobResponse = await apiFetch(apiBase, "/api/projects/epub/import/jobs", {
            method: "POST",
            auth: true,
            body: formData,
          });
          if (jobResponse.status === 404) {
            logEpubParityIssue({
              path: "/api/projects/epub/import/jobs",
              status: jobResponse.status,
              reason: "route_unreachable_for_current_origin",
            });
          } else if (!jobResponse.ok) {
            const data = await jobResponse.json().catch(() => null);
            handleEpubImportFailureResponse(jobResponse, data);
            return;
          } else {
            const data = (await jobResponse.json().catch(() => null)) as {
              job?: EpubImportJob;
            } | null;
            const initialJob = normalizeEpubImportJob(data?.job);
            if (!initialJob) {
              toast({
                title: "Falha ao importar EPUB",
                description: EPUB_IMPORT_PROCESSING_MESSAGE,
                variant: "destructive",
              });
              return;
            }
            const finalJob =
              initialJob.status === "queued" || initialJob.status === "processing"
                ? await pollEpubImportJob(initialJob.id)
                : initialJob;
            if (!finalJob) {
              return;
            }
            if (finalJob.status === "completed" && finalJob.result) {
              await applyImportedEpubPayload(finalJob.result, projectSnapshotForImport);
              return;
            }
            toast({
              title: "Falha ao importar EPUB",
              description: finalJob.error || EPUB_IMPORT_PROCESSING_MESSAGE,
              variant: "destructive",
            });
            return;
          }
        }

        await submitEpubImportSyncLegacy(file, { skipImportingState: true });
      } catch {
        setEpubRouteStatus("network_unreachable");
        logEpubParityIssue({
          path: backendSupportsEpubImportAsync
            ? "/api/projects/epub/import/jobs"
            : "/api/projects/epub/import",
          status: "network",
          reason: "network_unreachable",
        });
        toast({
          title: "Falha ao importar EPUB",
          description: EPUB_NETWORK_ERROR_MESSAGE,
          variant: "destructive",
        });
      } finally {
        pendingEpubAutoImportRef.current = false;
        setIsImportingEpub(false);
      }
    },
    [
      apiBase,
      applyImportedEpubPayload,
      backendCapabilitiesError,
      backendSupportsEpubImport,
      backendSupportsEpubImportAsync,
      epubImportAsDraft,
      epubImportTargetVolume,
      handleEpubImportFailureResponse,
      isImportingEpub,
      logEpubParityIssue,
      pollEpubImportJob,
      projectSnapshot,
      setEpubRouteStatus,
      submitEpubImportSyncLegacy,
    ],
  );

  const handleEpubImportFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0] || null;
      setEpubImportFile(selectedFile);
      if (!selectedFile) {
        pendingEpubAutoImportRef.current = false;
        return;
      }
      if (!pendingEpubAutoImportRef.current) {
        return;
      }
      pendingEpubAutoImportRef.current = false;
      void submitEpubImport(selectedFile);
    },
    [submitEpubImport],
  );

  const handleImportEpub = useCallback(async () => {
    if (!backendSupportsEpubImport) {
      toast({
        title: "Falha ao importar EPUB",
        description: backendCapabilitiesError
          ? EPUB_CAPABILITY_UNKNOWN_MESSAGE
          : EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
        variant: "destructive",
      });
      return;
    }
    if (!epubImportFile) {
      openEpubImportPicker({ autoImportAfterSelect: true });
      return;
    }
    await submitEpubImport(epubImportFile);
  }, [
    backendCapabilitiesError,
    backendSupportsEpubImport,
    epubImportFile,
    openEpubImportPicker,
    submitEpubImport,
  ]);

  const handleExportEpub = useCallback(async () => {
    if (!projectSnapshot) {
      return;
    }
    if (!backendSupportsEpubExport) {
      toast({
        title: "Falha ao exportar EPUB",
        description: backendCapabilitiesError
          ? EPUB_CAPABILITY_UNKNOWN_MESSAGE
          : EPUB_CAPABILITY_UNAVAILABLE_MESSAGE,
        variant: "destructive",
      });
      return;
    }

    setIsExportingEpub(true);
    try {
      const response = await apiFetch(apiBase, "/api/projects/epub/export", {
        method: "POST",
        auth: true,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project: buildProjectSnapshotForEpubExport(projectSnapshot),
          volume: epubExportVolume.trim() ? Number(epubExportVolume) : null,
          includeDrafts: epubExportIncludeDrafts,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 404) {
          setEpubRouteStatus("route_unreachable_for_current_origin");
          toast({
            title: "Falha ao exportar EPUB",
            description: EPUB_EXPORT_ROUTE_MISSING_MESSAGE,
            variant: "destructive",
          });
          return;
        }
        if (response.status === 403) {
          setEpubRouteStatus("forbidden");
          toast({
            title: "Falha ao exportar EPUB",
            description: "Você não tem permissão para exportar EPUB.",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Falha ao exportar EPUB",
          description:
            typeof data?.error === "string" && data.error === "no_eligible_chapters"
              ? "Não há capítulos elegíveis para esse volume."
              : typeof data?.detail === "string"
                ? data.detail
                : EPUB_EXPORT_GENERIC_MESSAGE,
          variant: "destructive",
        });
        return;
      }
      setEpubRouteStatus("ok");
      await downloadBinaryResponse(
        response,
        `${createSlug(projectSnapshot.title || "projeto") || "projeto"}.epub`,
      );
      toast({
        title: "EPUB exportado",
        description: "O volume foi gerado com o snapshot atual da página.",
        intent: "success",
      });
    } catch {
      setEpubRouteStatus("network_unreachable");
      toast({
        title: "Falha ao exportar EPUB",
        description: EPUB_NETWORK_ERROR_MESSAGE,
        variant: "destructive",
      });
    } finally {
      setIsExportingEpub(false);
    }
  }, [
    apiBase,
    backendCapabilitiesError,
    backendSupportsEpubExport,
    epubExportIncludeDrafts,
    epubExportVolume,
    projectSnapshot,
    setEpubRouteStatus,
  ]);

  const resetPendingEpubAutoImport = useCallback(() => {
    pendingEpubAutoImportRef.current = false;
  }, []);

  return {
    backendBuildLabel,
    backendSupportsEpubExport,
    backendSupportsEpubImport,
    epubCapabilityState,
    epubExportIncludeDrafts,
    epubExportVolume,
    epubImportAsDraft,
    epubImportFile,
    epubImportInputRef,
    epubImportTargetVolume,
    frontendBuildLabel,
    handleEpubImportFileChange,
    handleExportEpub,
    handleImportEpub,
    isExportingEpub,
    isImportingEpub,
    openEpubImportPicker,
    resetPendingEpubAutoImport,
    setEpubExportIncludeDrafts,
    setEpubExportVolume,
    setEpubImportAsDraft,
    setEpubImportTargetVolume,
  };
};

export default useDashboardProjectChapterEpub;
