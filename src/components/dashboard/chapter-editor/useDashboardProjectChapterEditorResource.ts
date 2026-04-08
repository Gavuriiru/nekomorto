import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import { toast } from "@/components/ui/use-toast";
import type { ProjectVolumeEntry } from "@/data/projects";
import { refetchPublicBootstrapCache } from "@/hooks/use-public-bootstrap";
import { apiFetch } from "@/lib/api-client";
import {
  IMAGE_PUBLICATION_PAGES_REQUIRED_MESSAGE,
  normalizeProjectSnapshotChapterOrderForPersist,
} from "@/lib/dashboard-project-chapter";
import {
  DOWNLOAD_SOURCES_REQUIRED_FOR_PUBLICATION_MESSAGE,
  READER_CONTENT_OR_DOWNLOAD_REQUIRED_FOR_PUBLICATION_MESSAGE,
} from "@/lib/project-publication";
import { normalizeProjectVolumeEntries } from "@/lib/project-volume-entries";
import {
  DEFAULT_API_CAPABILITIES,
  EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
  extractEpubTempImportIdsFromPayload,
  normalizeApiContractBuildMetadata,
  normalizeApiContractCapabilities,
} from "@/lib/project-epub";
import type {
  ApiContractBuildMetadata,
  ApiContractCapabilities,
} from "@/types/api-contract";
import type { EpubRouteStatus } from "@/lib/project-epub";

import type { ProjectRecord } from "./chapter-editor-types";

export type PersistProjectContext =
  | "epub-import"
  | "volume-editor"
  | "chapter-create"
  | "chapter-reorder"
  | "chapter-delete"
  | "volume-delete"
  | "manga-import"
  | "manga-publication";

export type DashboardProjectChapterEditorResourceState = {
  backendBuildMetadata: ApiContractBuildMetadata | null;
  backendCapabilities: ApiContractCapabilities | null;
  backendCapabilitiesError: string | null;
  clearPendingEpubImportIds: () => void;
  cleanupPendingEpubImports: () => void;
  epubRouteStatus: EpubRouteStatus;
  handleProjectChange: (nextProject: ProjectRecord) => void;
  hasLoadError: boolean;
  isLoading: boolean;
  pendingEpubImportIdsRef: MutableRefObject<Set<string>>;
  persistProjectSnapshot: (
    snapshot: ProjectRecord,
    options: { context: PersistProjectContext },
  ) => Promise<ProjectRecord | null>;
  persistedStructureGroupKeys: string[];
  project: ProjectRecord | null;
  projectRef: MutableRefObject<ProjectRecord | null>;
  projectSnapshotRef: MutableRefObject<ProjectRecord | null>;
  registerPendingEpubImportIds: (payload: unknown) => void;
  reloadProject: () => void;
  selectedVolume: number | null;
  setEpubRouteStatus: (nextValue: EpubRouteStatus) => void;
  setPersistedStructureGroupKeys: Dispatch<SetStateAction<string[]>>;
  setSelectedVolume: Dispatch<SetStateAction<number | null>>;
  setVolumeEntriesDraft: Dispatch<SetStateAction<ProjectVolumeEntry[]>>;
  syncProjectSnapshot: (snapshot: ProjectRecord | null) => void;
  volumeEntriesDraft: ProjectVolumeEntry[];
};

type UseDashboardProjectChapterEditorResourceOptions = {
  apiBase: string;
  onProjectResourceReset?: () => void;
  projectId?: string;
};

const buildProjectPersistenceFailureState = ({
  context,
  errorCode,
}: {
  context: PersistProjectContext;
  errorCode: string;
}) => {
  if (errorCode === "duplicate_episode_key") {
    return {
      title:
        context === "volume-editor"
          ? "Não foi possível salvar os volumes"
          : context === "chapter-delete"
            ? "Não foi possível excluir o capítulo"
            : context === "volume-delete"
              ? "Não foi possível excluir o volume"
              : context === "chapter-create"
                ? "Não foi possível criar o capítulo"
                : "Falha ao importar EPUB",
      description:
        context === "volume-editor"
          ? "O projeto possui capítulos duplicados por número e volume."
          : context === "chapter-delete"
            ? "A remoção deixou o projeto com capítulos duplicados."
            : context === "volume-delete"
              ? "A remoção deixou o projeto com capítulos duplicados."
              : context === "chapter-create"
                ? "Já existe um capítulo com essa combinação de número e volume."
                : EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
    };
  }

  if (errorCode === "duplicate_volume_cover_key") {
    return {
      title:
        context === "volume-editor"
          ? "Volumes duplicados"
          : context === "volume-delete"
            ? "Volumes duplicados"
            : context === "chapter-create"
              ? "Não foi possível criar o capítulo"
              : "Falha ao importar EPUB",
      description:
        context === "volume-editor"
          ? "Cada volume pode aparecer apenas uma vez."
          : context === "volume-delete"
            ? "Cada volume pode aparecer apenas uma vez."
            : context === "chapter-create"
              ? "Os metadados de volume ficaram duplicados neste snapshot."
              : "O projeto resultante ficou com mais de uma entrada para o mesmo volume.",
    };
  }

  if (errorCode === "image_pages_required_for_publication") {
    return {
      title: "Não foi possível publicar o capítulo",
      description: IMAGE_PUBLICATION_PAGES_REQUIRED_MESSAGE,
    };
  }

  if (errorCode === "reader_content_or_download_required_for_publication") {
    return {
      title: "NÃ£o foi possÃ­vel publicar o capÃ­tulo",
      description: READER_CONTENT_OR_DOWNLOAD_REQUIRED_FOR_PUBLICATION_MESSAGE,
    };
  }

  if (errorCode === "download_sources_required_for_publication") {
    return {
      title: "NÃ£o foi possÃ­vel publicar o capÃ­tulo",
      description: DOWNLOAD_SOURCES_REQUIRED_FOR_PUBLICATION_MESSAGE,
    };
  }

  return {
    title:
      context === "volume-editor"
        ? "Não foi possível salvar os volumes"
        : context === "chapter-delete"
          ? "Não foi possível excluir o capítulo"
          : context === "volume-delete"
            ? "Não foi possível excluir o volume"
            : context === "chapter-create"
              ? "Não foi possível criar o capítulo"
              : "Não foi possível salvar o projeto",
    description: "Tente novamente em alguns instantes.",
  };
};

export const useDashboardProjectChapterEditorResource = ({
  apiBase,
  onProjectResourceReset,
  projectId,
}: UseDashboardProjectChapterEditorResourceOptions): DashboardProjectChapterEditorResourceState => {
  const [backendCapabilities, setBackendCapabilities] =
    useState<ApiContractCapabilities | null>(null);
  const [backendBuildMetadata, setBackendBuildMetadata] =
    useState<ApiContractBuildMetadata | null>(null);
  const [backendCapabilitiesError, setBackendCapabilitiesError] = useState<string | null>(null);
  const [epubRouteStatus, setEpubRouteStatus] = useState<EpubRouteStatus>("unknown");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [projectLoadVersion, setProjectLoadVersion] = useState(0);
  const [volumeEntriesDraft, setVolumeEntriesDraft] = useState<ProjectVolumeEntry[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<number | null>(null);
  const [persistedStructureGroupKeys, setPersistedStructureGroupKeys] = useState<string[]>([]);
  const pendingEpubImportIdsRef = useRef<Set<string>>(new Set());
  const projectRef = useRef<ProjectRecord | null>(null);
  const projectSnapshotRef = useRef<ProjectRecord | null>(null);

  const clearPendingEpubImportIds = useCallback(() => {
    pendingEpubImportIdsRef.current.clear();
  }, []);

  const registerPendingEpubImportIds = useCallback((payload: unknown) => {
    extractEpubTempImportIdsFromPayload(payload).forEach((importId) => {
      pendingEpubImportIdsRef.current.add(importId);
    });
  }, []);

  const cleanupPendingEpubImports = useCallback(() => {
    const importIds = Array.from(pendingEpubImportIdsRef.current)
      .map((importId) => String(importId || "").trim())
      .filter(Boolean);
    if (!importIds.length) {
      return;
    }
    pendingEpubImportIdsRef.current.clear();
    void apiFetch(apiBase, "/api/projects/epub/import/cleanup", {
      method: "POST",
      auth: true,
      keepalive: true,
      json: { importIds },
    });
  }, [apiBase]);

  const applyLoadedProject = useCallback(
    (nextProject: ProjectRecord | null) => {
      projectRef.current = nextProject;
      projectSnapshotRef.current = nextProject;
      setProject(nextProject);
      setVolumeEntriesDraft(normalizeProjectVolumeEntries(nextProject?.volumeEntries));
      setSelectedVolume(null);
      setPersistedStructureGroupKeys([]);
      onProjectResourceReset?.();
    },
    [onProjectResourceReset],
  );

  const syncProjectSnapshot = useCallback((snapshot: ProjectRecord | null) => {
    projectSnapshotRef.current = snapshot;
  }, []);

  const handleProjectChange = useCallback((nextProject: ProjectRecord) => {
    projectRef.current = nextProject;
    projectSnapshotRef.current = nextProject;
    setProject(nextProject);
    setVolumeEntriesDraft(normalizeProjectVolumeEntries(nextProject.volumeEntries));
  }, []);

  const reloadProject = useCallback(() => {
    setProjectLoadVersion((previous) => previous + 1);
  }, []);

  const persistProjectSnapshot = useCallback(
    async (
      snapshot: ProjectRecord,
      options: { context: PersistProjectContext },
    ): Promise<ProjectRecord | null> => {
      const normalizedSnapshot =
        normalizeProjectSnapshotChapterOrderForPersist<ProjectRecord | null, ProjectRecord>(
          projectRef.current,
          snapshot,
        ) as ProjectRecord;
      const { revision: _ignoredRevision, ...payload } = normalizedSnapshot;
      const response = await apiFetch(apiBase, `/api/projects/${normalizedSnapshot.id}`, {
        method: "PUT",
        auth: true,
        json: {
          ...payload,
          ifRevision: projectRef.current?.revision || "",
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const failureState = buildProjectPersistenceFailureState({
          context: options.context,
          errorCode: String(data?.error || "").trim(),
        });
        toast({
          title: failureState.title,
          description: failureState.description,
          variant: "destructive",
        });
        return null;
      }
      const data = (await response.json()) as { project?: ProjectRecord };
      if (data?.project) {
        void refetchPublicBootstrapCache(apiBase).catch(() => undefined);
      }
      return data?.project || null;
    },
    [apiBase],
  );

  useEffect(() => {
    let isActive = true;
    const loadApiContract = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/contracts/v1.json", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`api_contract_${response.status}`);
        }
        const data = await response.json();
        if (!isActive) {
          return;
        }
        setBackendCapabilities(normalizeApiContractCapabilities(data?.capabilities));
        setBackendBuildMetadata(normalizeApiContractBuildMetadata(data?.build));
        setBackendCapabilitiesError(null);
        setEpubRouteStatus("ok");
      } catch {
        if (!isActive) {
          return;
        }
        setBackendCapabilities(DEFAULT_API_CAPABILITIES);
        setBackendBuildMetadata(null);
        setBackendCapabilitiesError("api_contract_unavailable");
        setEpubRouteStatus("unknown");
      }
    };
    void loadApiContract();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadProject = async () => {
      if (!projectId) {
        applyLoadedProject(null);
        setHasLoadError(false);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setHasLoadError(false);
      try {
        const response = await apiFetch(apiBase, `/api/projects/${projectId}`, { auth: true });
        if (!isActive) {
          return;
        }
        if (!response.ok) {
          applyLoadedProject(null);
          setHasLoadError(response.status !== 404);
          return;
        }
        const data = (await response.json()) as { project?: ProjectRecord };
        if (!isActive) {
          return;
        }
        applyLoadedProject(data?.project || null);
        setHasLoadError(false);
      } catch {
        if (!isActive) {
          return;
        }
        applyLoadedProject(null);
        setHasLoadError(true);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };
    void loadProject();
    return () => {
      isActive = false;
    };
  }, [apiBase, applyLoadedProject, projectId, projectLoadVersion]);

  return {
    backendBuildMetadata,
    backendCapabilities,
    backendCapabilitiesError,
    clearPendingEpubImportIds,
    cleanupPendingEpubImports,
    epubRouteStatus,
    handleProjectChange,
    hasLoadError,
    isLoading,
    pendingEpubImportIdsRef,
    persistProjectSnapshot,
    persistedStructureGroupKeys,
    project,
    projectRef,
    projectSnapshotRef,
    registerPendingEpubImportIds,
    reloadProject,
    selectedVolume,
    setEpubRouteStatus,
    setPersistedStructureGroupKeys,
    setSelectedVolume,
    setVolumeEntriesDraft,
    syncProjectSnapshot,
    volumeEntriesDraft,
  };
};

export default useDashboardProjectChapterEditorResource;
