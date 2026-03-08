import DashboardShell from "@/components/DashboardShell";
import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import { ImageLibraryDialogLoadingFallback } from "@/components/ImageLibraryDialogLoading";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import type { Project, ProjectEpisode, ProjectVolumeCover } from "@/data/projects";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { logOriginApiBaseMismatchOnce } from "@/lib/dev-diagnostics";
import { formatBuildMetadataLabel, getFrontendBuildMetadata } from "@/lib/frontend-build";
import {
  DEFAULT_PROJECT_COVER_ALT,
  getEpisodeCoverAltFallback,
  resolveAssetAltText,
} from "@/lib/image-alt";
import { filterImageLibraryFoldersByAccess } from "@/lib/image-library-scope";
import { createSlug } from "@/lib/post-content";
import {
  DEFAULT_API_CAPABILITIES,
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
  type EpubRouteStatus,
  buildEpubImportProjectSnapshot,
  buildProjectSnapshotForEpubExport,
  downloadBinaryResponse,
  extractEpubTempImportIdsFromPayload,
  isEpubCssEngineFailureDetail,
  isLegacyMultipartSnapshotTooLargeError,
  mergeImportedChaptersIntoProject,
  mergeImportedVolumeCoversIntoProject,
  normalizeApiContractBuildMetadata,
  normalizeApiContractCapabilities,
  overlayDraftOnProject,
} from "@/lib/project-epub";
import {
  buildDashboardProjectChapterEditorHref,
  buildDashboardProjectChaptersEditorHref,
  buildDashboardProjectEditorHref,
  buildProjectPublicReadingHref,
} from "@/lib/project-editor-routes";
import { buildEpisodeKey, resolveEpisodeLookup } from "@/lib/project-episode-key";
import { buildChapterFolder, resolveProjectImageFolders } from "@/lib/project-image-folders";
import { isLightNovelType } from "@/lib/project-utils";
import type {
  ApiContractBuildMetadata,
  ApiContractCapabilities,
  ApiContractV1,
} from "@/types/api-contract";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import {
  Suspense,
  forwardRef,
  lazy,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import NotFound from "./NotFound";

const LexicalEditor = lazy(() => import("@/components/lexical/LexicalEditor"));
const ImageLibraryDialog = lazy(() => import("@/components/ImageLibraryDialog"));

const LexicalEditorFallback = () => (
  <div
    className="min-h-[380px] w-full rounded-2xl border border-border/60 bg-card/60 p-4"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="h-8 w-20 rounded-lg bg-muted/60" />
        <div className="h-8 w-24 rounded-lg bg-muted/60" />
        <div className="h-8 w-32 rounded-lg bg-muted/60" />
      </div>
      <div className="h-10 w-full rounded-xl bg-muted/60" />
      <div className="h-24 w-full rounded-xl bg-muted/60" />
      <div className="h-4 w-full rounded bg-muted/60" />
      <div className="h-4 w-10/12 rounded bg-muted/60" />
      <div className="h-40 w-full rounded-xl bg-muted/60" />
    </div>
    <span className="sr-only">Carregando editor...</span>
  </div>
);

type ChapterFilterMode = "all" | "draft" | "published" | "with-content" | "without-content";

type GroupedChapterEntry = {
  key: string;
  label: string;
  items: ProjectEpisode[];
};

type ProjectRecord = Project & {
  revision?: string;
};

type CurrentUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  permissions?: string[];
};

type ChapterEditorPaneHandle = {
  requestLeave: () => Promise<boolean>;
};

type EpubCapabilityState = {
  message: string;
  variant: "destructive" | "warning";
} | null;

type ChapterEditorPaneProps = {
  project: ProjectRecord;
  activeChapter: ProjectEpisode | null;
  activeDraft: ProjectEpisode | null;
  onDraftChange: (nextChapter: ProjectEpisode) => void;
  activeChapterKey: string | null;
  chapterCount: number;
  chapterIndex: number;
  groupedFilteredChapters: GroupedChapterEntry[];
  chapterSearchQuery: string;
  onChapterSearchQueryChange: (nextValue: string) => void;
  filterMode: ChapterFilterMode;
  onFilterModeChange: (nextValue: ChapterFilterMode) => void;
  previousChapterHref: string | null;
  nextChapterHref: string | null;
  neutralHref: string;
  onNavigateToHref: (href: string) => void;
  onChapterSaved: (project: ProjectRecord, chapter: ProjectEpisode) => void;
  backendSupportsEpubImport: boolean;
  backendSupportsEpubExport: boolean;
  backendBuildLabel: string | null;
  frontendBuildLabel: string | null;
  epubCapabilityState: EpubCapabilityState;
  epubImportInputRef: RefObject<HTMLInputElement | null>;
  epubImportFile: File | null;
  epubImportTargetVolume: string;
  onEpubImportTargetVolumeChange: (nextValue: string) => void;
  epubImportAsDraft: boolean;
  onEpubImportAsDraftChange: (nextValue: boolean) => void;
  isImportingEpub: boolean;
  onOpenEpubPicker: (options: { autoImportAfterSelect: boolean }) => void;
  onEpubImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onEpubImportFileCancel: () => void;
  onImportEpub: () => void | Promise<void>;
  epubExportVolume: string;
  onEpubExportVolumeChange: (nextValue: string) => void;
  epubExportIncludeDrafts: boolean;
  onEpubExportIncludeDraftsChange: (nextValue: boolean) => void;
  isExportingEpub: boolean;
  onExportEpub: () => void | Promise<void>;
};

const EMPTY_CHAPTER_DRAFT: ProjectEpisode = {
  number: 1,
  title: "",
  synopsis: "",
  releaseDate: "",
  duration: "",
  sourceType: "TV",
  sources: [],
  completedStages: [],
  content: "",
  contentFormat: "lexical",
  publicationStatus: "draft",
  coverImageUrl: "",
  coverImageAlt: "",
};

const editorSectionClassName =
  "project-editor-section rounded-2xl border border-border/60 bg-card/70 px-4";
const editorSectionHeaderClassName =
  "project-editor-section-trigger flex w-full items-center justify-between gap-4 py-2 text-left";
const editorAccordionTriggerClassName =
  "project-editor-section-trigger flex w-full items-start gap-4 py-3.5 text-left hover:no-underline md:py-4";
const editorSectionContentClassName = "project-editor-section-content px-1 pb-2.5";
const editorAccordionHeaderTextClassName = "min-w-0 flex-1 space-y-1 text-left";
const editorAccordionTitleClassName =
  "block text-[15px] font-semibold leading-tight md:text-base";
const editorAccordionSubtitleClassName = "block text-xs leading-5 text-muted-foreground";

const EditorAccordionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className={editorAccordionHeaderTextClassName}>
    <span className={editorAccordionTitleClassName}>{title}</span>
    <span className={editorAccordionSubtitleClassName}>{subtitle}</span>
  </div>
);

const chapterHasContent = (episode: ProjectEpisode | null | undefined) =>
  typeof episode?.content === "string" && episode.content.trim().length > 0;

const chapterStatusLabel = (episode: ProjectEpisode | null | undefined) =>
  episode?.publicationStatus === "draft" ? "Rascunho" : "Publicado";

const sortChapters = (episodes: ProjectEpisode[]) =>
  [...episodes].sort((left, right) => {
    const leftReadingOrder = Number(left.readingOrder);
    const rightReadingOrder = Number(right.readingOrder);
    const hasLeftReadingOrder = Number.isFinite(leftReadingOrder);
    const hasRightReadingOrder = Number.isFinite(rightReadingOrder);
    if (hasLeftReadingOrder || hasRightReadingOrder) {
      if (!hasLeftReadingOrder) {
        return 1;
      }
      if (!hasRightReadingOrder) {
        return -1;
      }
      if (leftReadingOrder !== rightReadingOrder) {
        return leftReadingOrder - rightReadingOrder;
      }
    }
    const volumeDelta = (Number(left.volume) || 0) - (Number(right.volume) || 0);
    if (volumeDelta !== 0) {
      return volumeDelta;
    }
    const numberDelta = (Number(left.number) || 0) - (Number(right.number) || 0);
    if (numberDelta !== 0) {
      return numberDelta;
    }
    return String(left.title || "").localeCompare(String(right.title || ""), "pt-BR");
  });

const buildChapterVolumeLabel = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Sem volume";
  }
  return `Volume ${Math.floor(parsed)}`;
};

const matchesFilter = (episode: ProjectEpisode, mode: ChapterFilterMode) => {
  if (mode === "draft") {
    return episode.publicationStatus === "draft";
  }
  if (mode === "published") {
    return episode.publicationStatus !== "draft";
  }
  if (mode === "with-content") {
    return chapterHasContent(episode);
  }
  if (mode === "without-content") {
    return !chapterHasContent(episode);
  }
  return true;
};

const normalizeChapterForSave = (chapter: ProjectEpisode): ProjectEpisode => {
  const parsedNumber = Number(chapter.number);
  const parsedVolume = Number(chapter.volume);
  const parsedReadingOrder = Number(chapter.readingOrder);
  const parsedSizeBytes = Number(chapter.sizeBytes);
  const entryKind =
    String(chapter.entryKind || "")
      .trim()
      .toLowerCase() === "extra"
      ? "extra"
      : "main";
  return {
    ...chapter,
    number: Number.isFinite(parsedNumber) ? Math.floor(parsedNumber) : 1,
    volume: Number.isFinite(parsedVolume) ? Math.floor(parsedVolume) : undefined,
    title: String(chapter.title || ""),
    entryKind,
    entrySubtype: String(chapter.entrySubtype || "").trim() || undefined,
    readingOrder: Number.isFinite(parsedReadingOrder) ? Math.floor(parsedReadingOrder) : undefined,
    displayLabel:
      entryKind === "extra" ? String(chapter.displayLabel || "").trim() || undefined : undefined,
    synopsis: String(chapter.synopsis || ""),
    releaseDate: String(chapter.releaseDate || "").trim(),
    duration: String(chapter.duration || "").trim(),
    coverImageUrl: String(chapter.coverImageUrl || "").trim(),
    coverImageAlt: String(chapter.coverImageAlt || ""),
    sourceType:
      chapter.sourceType === "Web" || chapter.sourceType === "Blu-ray" ? chapter.sourceType : "TV",
    sources: (Array.isArray(chapter.sources) ? chapter.sources : [])
      .map((source) => ({
        label: String(source.label || "").trim(),
        url: String(source.url || "").trim(),
      }))
      .filter((source) => source.label || source.url),
    hash: String(chapter.hash || "").trim() || undefined,
    sizeBytes:
      Number.isFinite(parsedSizeBytes) && parsedSizeBytes > 0
        ? Math.floor(parsedSizeBytes)
        : undefined,
    progressStage: String(chapter.progressStage || "").trim() || undefined,
    completedStages: Array.isArray(chapter.completedStages)
      ? Array.from(
          new Set(chapter.completedStages.map((item) => String(item || "").trim()).filter(Boolean)),
        )
      : [],
    content: String(chapter.content || ""),
    contentFormat: "lexical",
    publicationStatus: chapter.publicationStatus === "draft" ? "draft" : "published",
    chapterUpdatedAt: String(chapter.chapterUpdatedAt || "").trim() || undefined,
  };
};

const normalizeOriginLabel = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized || "indisponivel";
};

const buildChapterSnapshot = (chapter: ProjectEpisode | null) =>
  chapter ? JSON.stringify(normalizeChapterForSave(chapter)) : "";

const ChapterEditorPane = forwardRef<ChapterEditorPaneHandle, ChapterEditorPaneProps>(
  (
    {
      project,
      activeChapter,
      activeDraft,
      onDraftChange,
      activeChapterKey,
      chapterCount,
      chapterIndex,
      groupedFilteredChapters,
      chapterSearchQuery,
      onChapterSearchQueryChange,
      filterMode,
      onFilterModeChange,
      previousChapterHref,
      nextChapterHref,
      neutralHref,
      onNavigateToHref,
      onChapterSaved,
      backendSupportsEpubImport,
      backendSupportsEpubExport,
      backendBuildLabel,
      frontendBuildLabel,
      epubCapabilityState,
      epubImportInputRef,
      epubImportFile,
      epubImportTargetVolume,
      onEpubImportTargetVolumeChange,
      epubImportAsDraft,
      onEpubImportAsDraftChange,
      isImportingEpub,
      onOpenEpubPicker,
      onEpubImportFileChange,
      onEpubImportFileCancel,
      onImportEpub,
      epubExportVolume,
      onEpubExportVolumeChange,
      epubExportIncludeDrafts,
      onEpubExportIncludeDraftsChange,
      isExportingEpub,
      onExportEpub,
    },
    ref,
  ) => {
    const apiBase = getApiBase();
    const editorRef = useRef<LexicalEditorHandle | null>(null);
    const [identityError, setIdentityError] = useState<string | null>(null);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isSavingChapter, setIsSavingChapter] = useState(false);
    const hasActiveChapter = Boolean(activeChapter && activeChapterKey);
    const draft =
      activeDraft || (activeChapter ? normalizeChapterForSave(activeChapter) : EMPTY_CHAPTER_DRAFT);
    const activeChapterSnapshot = useMemo(() => buildChapterSnapshot(activeChapter), [activeChapter]);
    const draftSnapshot = useMemo(
      () => (hasActiveChapter ? buildChapterSnapshot(draft) : ""),
      [draft, hasActiveChapter],
    );
    const isDirty = hasActiveChapter && draftSnapshot !== activeChapterSnapshot;

    const scopedProjectImageIds = useMemo(() => {
      const normalizedProjectId = String(project.id || "").trim();
      return normalizedProjectId ? [normalizedProjectId] : [];
    }, [project.id]);
    const { projectRootFolder, projectEpisodesFolder, projectChaptersFolder } = useMemo(
      () => resolveProjectImageFolders(project.id, project.title),
      [project.id, project.title],
    );
    const filterProjectLibraryFolders = useCallback(
      (folders: string[]) =>
        filterImageLibraryFoldersByAccess(folders, {
          grants: { projetos: true },
        }),
      [],
    );
    const chapterFolder = useMemo(
      () =>
        buildChapterFolder({
          projectChaptersFolder,
          episode: draft,
          index: Math.max(chapterIndex, 0),
        }),
      [chapterIndex, draft, projectChaptersFolder],
    );
    const chapterImageLibraryOptions = useMemo(
      (): ImageLibraryOptions => ({
        uploadFolder: chapterFolder,
        listFolders: filterProjectLibraryFolders([
          chapterFolder,
          projectChaptersFolder,
          projectEpisodesFolder,
          projectRootFolder,
        ]),
        listAll: false,
        includeProjectImages: true,
        projectImageProjectIds: scopedProjectImageIds,
        projectImagesView: "by-project",
      }),
      [
        chapterFolder,
        filterProjectLibraryFolders,
        projectChaptersFolder,
        projectEpisodesFolder,
        projectRootFolder,
        scopedProjectImageIds,
      ],
    );

    const saveChapter = useCallback(
      async (snapshot: ProjectEpisode) => {
        if (!activeChapter) {
          return snapshot;
        }
        setIdentityError(null);
        const response = await apiFetch(
          apiBase,
          `/api/projects/${project.id}/chapters/${activeChapter.number}${
            Number.isFinite(Number(activeChapter.volume))
              ? `?volume=${Number(activeChapter.volume)}`
              : ""
          }`,
          {
            method: "PUT",
            auth: true,
            json: {
              ifRevision: project.revision || "",
              chapter: {
                ...normalizeChapterForSave(snapshot),
                coverImageAlt: snapshot.coverImageUrl
                  ? resolveAssetAltText(snapshot.coverImageAlt, getEpisodeCoverAltFallback(true))
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

        const normalizedSavedChapter = normalizeChapterForSave(data.chapter);
        onChapterSaved(data.project, normalizedSavedChapter);
        return normalizedSavedChapter;
      },
      [activeChapter, apiBase, onChapterSaved, project.id, project.revision],
    );

    const handleManualSave = useCallback(async () => {
      if (!hasActiveChapter || !isDirty || isSavingChapter) {
        return true;
      }
      setIsSavingChapter(true);
      try {
        await saveChapter(draft);
        return true;
      } catch {
        return false;
      } finally {
        setIsSavingChapter(false);
      }
    }, [draft, hasActiveChapter, isDirty, isSavingChapter, saveChapter]);

    const requestLeave = useCallback(async () => {
      if (!hasActiveChapter || !isDirty) {
        return true;
      }
      return window.confirm(
        "Você tem alterações não salvas neste capítulo. Deseja sair mesmo assim?",
      );
    }, [hasActiveChapter, isDirty]);

    useImperativeHandle(
      ref,
      () => ({
        requestLeave,
      }),
      [requestLeave],
    );

    useEffect(() => {
      if (!hasActiveChapter || !isDirty) {
        return;
      }
      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasActiveChapter, isDirty]);

    useEffect(() => {
      if (!hasActiveChapter) {
        return;
      }
      const handleHotkeys = (event: KeyboardEvent) => {
        const isSaveShortcut =
          (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "s";
        if (isSaveShortcut) {
          event.preventDefault();
          void handleManualSave();
          return;
        }
        if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === "ArrowUp") {
          if (previousChapterHref) {
            event.preventDefault();
            onNavigateToHref(previousChapterHref);
          }
          return;
        }
        if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === "ArrowDown") {
          if (nextChapterHref) {
            event.preventDefault();
            onNavigateToHref(nextChapterHref);
          }
        }
      };
      window.addEventListener("keydown", handleHotkeys);
      return () => window.removeEventListener("keydown", handleHotkeys);
    }, [handleManualSave, hasActiveChapter, nextChapterHref, onNavigateToHref, previousChapterHref]);

    const publicReadingHref = useMemo(
      () =>
        hasActiveChapter ? buildProjectPublicReadingHref(project.id, draft.number, draft.volume) : "",
      [draft.number, draft.volume, hasActiveChapter, project.id],
    );
    const chapterTitle = hasActiveChapter
      ? String(draft.title || "").trim() || `Capítulo ${draft.number}`
      : "Nenhum capítulo aberto";
    const chapterSummaryLabel =
      hasActiveChapter && draft.entryKind === "extra" ? "Extra em edição" : "Capítulo em edição";
    const chapterPositionLabel = `${Math.max(chapterIndex + 1, 1)} de ${Math.max(chapterCount, 1)}`;
    const activeNavigationVolumeKey = useMemo(() => {
      const activeGroup = activeChapterKey
        ? groupedFilteredChapters.find((group) =>
            group.items.some(
              (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
            ),
          )
        : null;
      return activeGroup?.key || groupedFilteredChapters[0]?.key || "";
    }, [activeChapterKey, groupedFilteredChapters]);
    const [openNavigationVolumeKey, setOpenNavigationVolumeKey] =
      useState(activeNavigationVolumeKey);

    useEffect(() => {
      setOpenNavigationVolumeKey((currentValue) => {
        if (activeNavigationVolumeKey && currentValue !== activeNavigationVolumeKey) {
          return activeNavigationVolumeKey;
        }
        if (currentValue && groupedFilteredChapters.some((group) => group.key === currentValue)) {
          return currentValue;
        }
        return groupedFilteredChapters[0]?.key || "";
      });
    }, [activeNavigationVolumeKey, groupedFilteredChapters]);

    const firstChapterHref = useMemo(() => {
      const firstEpisode = groupedFilteredChapters[0]?.items[0];
      if (!firstEpisode) {
        return null;
      }
      return buildDashboardProjectChapterEditorHref(project.id, firstEpisode.number, firstEpisode.volume);
    }, [groupedFilteredChapters, project.id]);

    const updateDraft = useCallback(
      (recipe: (current: ProjectEpisode) => ProjectEpisode) => {
        if (!hasActiveChapter) {
          return;
        }
        onDraftChange(normalizeChapterForSave(recipe(draft)));
      },
      [draft, hasActiveChapter, onDraftChange],
    );

    const epubToolsAccordion = (
      <Accordion
        type="single"
        collapsible
        defaultValue="epub-tools"
        className="project-editor-accordion space-y-2.5"
        data-testid="chapter-epub-tools"
      >
        <AccordionItem value="epub-tools" className={editorSectionClassName}>
          <AccordionTrigger className={editorAccordionTriggerClassName}>
            <EditorAccordionHeader
              title="Ferramentas EPUB"
              subtitle="Importação e exportação por volume"
            />
          </AccordionTrigger>
          <AccordionContent className={editorSectionContentClassName}>
            <div className="space-y-5">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Importe capítulos para o editor Lexical e exporte o snapshot atual da página.
                </p>
                {epubCapabilityState ? (
                  <p
                    className={
                      epubCapabilityState.variant === "destructive"
                        ? "text-xs text-destructive"
                        : "text-xs text-amber-700"
                    }
                  >
                    {epubCapabilityState.message}
                  </p>
                ) : null}
                {backendBuildLabel ? (
                  <p className="text-[11px] text-muted-foreground">
                    Contrato da API: {backendBuildLabel}
                  </p>
                ) : null}
                {frontendBuildLabel ? (
                  <p className="text-[11px] text-muted-foreground">Frontend: {frontendBuildLabel}</p>
                ) : null}
              </div>

              <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-foreground">Importar EPUB</h4>
                  <p className="text-xs text-muted-foreground">
                    O arquivo é convertido para Lexical, mergeado no projeto e salvo imediatamente.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chapter-editor-epub-import-file">Arquivo .epub</Label>
                  <Input
                    ref={epubImportInputRef}
                    id="chapter-editor-epub-import-file"
                    type="file"
                    accept=".epub,application/epub+zip"
                    className="sr-only"
                    onChange={onEpubImportFileChange}
                    onCancel={onEpubImportFileCancel}
                  />
                  {epubImportFile ? (
                    <button
                      type="button"
                      onClick={() => onOpenEpubPicker({ autoImportAfterSelect: false })}
                      disabled={isImportingEpub || !backendSupportsEpubImport}
                      className="w-full rounded-xl border border-border/60 bg-background/50 px-3 py-3 text-left transition hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {epubImportFile.name}
                      </span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenEpubPicker({ autoImportAfterSelect: false })}
                        disabled={isImportingEpub || !backendSupportsEpubImport}
                      >
                        Escolher arquivo
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Nenhum arquivo selecionado
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chapter-editor-epub-import-volume">Volume de destino</Label>
                  <Input
                    id="chapter-editor-epub-import-volume"
                    type="number"
                    value={epubImportTargetVolume}
                    onChange={(event) => onEpubImportTargetVolumeChange(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm">
                  <Checkbox
                    checked={epubImportAsDraft}
                    onCheckedChange={(checked) => onEpubImportAsDraftChange(checked === true)}
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-foreground">Importar como rascunho</span>
                    <span className="block text-xs text-muted-foreground">
                      Capítulos importados ficam ocultos ao público até a publicação.
                    </span>
                  </span>
                </label>
                <Button
                  type="button"
                  onClick={onImportEpub}
                  disabled={isImportingEpub || !backendSupportsEpubImport}
                  className="gap-2"
                >
                  {isImportingEpub ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Importar EPUB
                </Button>
              </div>

              <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-foreground">Exportar EPUB</h4>
                  <p className="text-xs text-muted-foreground">
                    Usa o estado atual da página, inclusive alterações ainda não salvas no capítulo
                    aberto.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chapter-editor-epub-export-volume">Volume para exportação</Label>
                  <Input
                    id="chapter-editor-epub-export-volume"
                    type="number"
                    value={epubExportVolume}
                    onChange={(event) => onEpubExportVolumeChange(event.target.value)}
                    placeholder="Deixe vazio para Sem volume"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm">
                  <Checkbox
                    checked={epubExportIncludeDrafts}
                    onCheckedChange={(checked) =>
                      onEpubExportIncludeDraftsChange(checked === true)
                    }
                  />
                  <span className="space-y-1">
                    <span className="block font-medium text-foreground">Incluir rascunhos</span>
                    <span className="block text-xs text-muted-foreground">
                      Exporta também capítulos em draft que tenham conteúdo.
                    </span>
                  </span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onExportEpub}
                  disabled={isExportingEpub || !backendSupportsEpubExport}
                  className="gap-2"
                >
                  {isExportingEpub ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Exportar volume em EPUB
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    return (
      <>
        <div
          className="sticky top-3 z-20 overflow-hidden rounded-[28px] border border-border/60 bg-background/90 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.82)] backdrop-blur supports-backdrop-filter:bg-background/75"
          data-testid="chapter-editor-header-shell"
        >
          <div
            className="project-editor-top border-b border-border/60 bg-transparent shadow-none [clip-path:none]"
            data-testid="chapter-editor-sticky-top"
          >
            <div className="space-y-0 px-4 pb-2.5 pt-3.5 text-left md:px-6 lg:px-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {hasActiveChapter ? (
                      <>
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                          {chapterSummaryLabel}
                        </Badge>
                        <Badge
                          variant={draft.publicationStatus === "draft" ? "outline" : "default"}
                          className="text-[10px] uppercase tracking-[0.12em]"
                        >
                          {chapterStatusLabel(draft)}
                        </Badge>
                        {Number.isFinite(Number(draft.volume)) ? (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                            {buildChapterVolumeLabel(draft.volume)}
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                        Seleção de capítulo
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-xl font-semibold md:text-2xl">
                      Gerenciamento de Conteúdo
                    </h1>
                    <p className="max-w-3xl text-xs text-muted-foreground md:text-sm">
                      Edição de capítulos e volumes para light novels.
                    </p>
                  </div>
                </div>

                <div className="flex w-full max-w-full flex-col gap-3 lg:w-auto lg:min-w-[320px] lg:max-w-[440px]">
                  <div className="rounded-xl border border-border/60 bg-card/65 px-3 py-2 text-left lg:text-right">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      Projeto
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">{project.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {hasActiveChapter
                        ? `${chapterTitle} - ${chapterPositionLabel}`
                        : `${chapterCount} capítulo(s) disponível(is)`}
                    </p>
                  </div>
                  {hasActiveChapter ? (
                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-end">
                      <Badge
                        variant={isDirty ? "outline" : "secondary"}
                        className="text-[10px] uppercase tracking-[0.12em]"
                      >
                        {isSavingChapter
                          ? "Salvando..."
                          : isDirty
                            ? "Alterações pendentes"
                            : "Sem alterações pendentes"}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          void handleManualSave();
                        }}
                        disabled={isSavingChapter || !isDirty}
                        className="gap-2"
                      >
                        {isSavingChapter ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Salvar capítulo
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div
            className="project-editor-status-bar flex flex-wrap items-center gap-2 px-4 py-1.5 md:px-6 lg:px-8"
            data-testid="chapter-editor-status-bar"
          >
            {hasActiveChapter ? (
              <>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  {chapterPositionLabel}
                </Badge>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.12em]">
                  Capítulo {draft.number}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {chapterHasContent(draft) ? "Com leitura" : "Sem leitura"}
                </span>
                {draft.sources?.length ? (
                  <span className="text-[11px] text-muted-foreground">
                    {draft.sources.length} fonte(s)
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
                  Nenhum capítulo aberto
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Escolha um capítulo na sidebar ou use as ferramentas EPUB logo abaixo.
                </span>
              </>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={buildDashboardProjectEditorHref(project.id)}>
                  <ArrowLeft className="h-4 w-4" />
                  <span>Voltar ao projeto</span>
                </Link>
              </Button>
              {hasActiveChapter ? (
                <>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={publicReadingHref} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      <span>Abrir leitura</span>
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onNavigateToHref(neutralHref)}>
                    <span>Fechar capítulo</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (previousChapterHref) {
                        onNavigateToHref(previousChapterHref);
                      }
                    }}
                    disabled={!previousChapterHref}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Anterior</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (nextChapterHref) {
                        onNavigateToHref(nextChapterHref);
                      }
                    }}
                    disabled={!nextChapterHref}
                  >
                    <span>Próximo</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="project-editor-layout mx-auto grid w-full gap-5 pb-8 pt-4 md:pb-10 2xl:grid-cols-[minmax(0,1fr)_340px] 2xl:items-start"
          data-testid="chapter-editor-upper-layout"
        >
          <div
            className="order-1 min-w-0 w-full space-y-4 2xl:col-start-1 2xl:row-start-1"
            data-testid="chapter-editor-main-column"
          >
            {hasActiveChapter ? (
              <Accordion
                type="multiple"
                defaultValue={["identity"]}
                className="project-editor-accordion space-y-2.5"
              >
                <AccordionItem value="identity" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <EditorAccordionHeader
                      title="Identidade do capítulo"
                      subtitle="Título, numeração, tipo e resumo"
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="space-y-5">
                      {identityError ? (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                          {identityError}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <Label htmlFor="chapter-title">Título</Label>
                        <Input
                          id="chapter-title"
                          value={draft.title || ""}
                          onChange={(event) =>
                            updateDraft((current) => ({ ...current, title: event.target.value }))
                          }
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2">
                          <Label htmlFor="chapter-number">Número</Label>
                          <Input
                            id="chapter-number"
                            type="number"
                            value={draft.number}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                number: Number(event.target.value || current.number),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chapter-volume">Volume</Label>
                          <Input
                            id="chapter-volume"
                            type="number"
                            value={draft.volume ?? ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                volume:
                                  event.target.value.trim() === ""
                                    ? undefined
                                    : Number(event.target.value),
                              }))
                            }
                            placeholder="Sem volume"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo de entrada</Label>
                          <Select
                            value={draft.entryKind === "extra" ? "extra" : "main"}
                            onValueChange={(value) =>
                              updateDraft((current) => ({
                                ...current,
                                entryKind: value === "extra" ? "extra" : "main",
                                displayLabel:
                                  value === "extra" ? current.displayLabel || "Extra" : undefined,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="main">Capítulo</SelectItem>
                              <SelectItem value="extra">Extra</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chapter-reading-order">Ordem de leitura</Label>
                          <Input
                            id="chapter-reading-order"
                            type="number"
                            value={draft.readingOrder ?? ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                readingOrder:
                                  event.target.value.trim() === ""
                                    ? undefined
                                    : Number(event.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {draft.entryKind === "extra" ? (
                          <div className="space-y-2">
                            <Label htmlFor="chapter-display-label">Rótulo do extra</Label>
                            <Input
                              id="chapter-display-label"
                              value={draft.displayLabel || ""}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  displayLabel: event.target.value,
                                }))
                              }
                              placeholder="Ex.: Side Story"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label htmlFor="chapter-entry-subtype">Subtipo</Label>
                            <Input
                              id="chapter-entry-subtype"
                              value={draft.entrySubtype || ""}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  entrySubtype: event.target.value,
                                }))
                              }
                              placeholder="Ex.: capítulo, prólogo, epílogo"
                            />
                          </div>
                        )}

                        {draft.entryKind === "extra" ? (
                          <div className="space-y-2">
                            <Label htmlFor="chapter-entry-subtype-extra">Subtipo</Label>
                            <Input
                              id="chapter-entry-subtype-extra"
                              value={draft.entrySubtype || ""}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  entrySubtype: event.target.value,
                                }))
                              }
                              placeholder="Ex.: capítulo, prólogo, epílogo"
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="chapter-synopsis">Sinopse</Label>
                        <Textarea
                          id="chapter-synopsis"
                          value={draft.synopsis || ""}
                          onChange={(event) =>
                            updateDraft((current) => ({ ...current, synopsis: event.target.value }))
                          }
                          rows={5}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              <>
                <section className={`${editorSectionClassName} min-w-0`} data-testid="chapter-neutral-state">
                  <div className={editorSectionHeaderClassName}>
                    <div className="flex w-full items-center justify-between gap-4 text-left">
                      <span className="text-sm font-semibold">Conteúdo</span>
                      <span className="text-xs text-muted-foreground">
                        Selecione um capítulo para começar a editar
                      </span>
                    </div>
                  </div>
                  <div className={editorSectionContentClassName}>
                    <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-8">
                      <AsyncState
                        kind="empty"
                        title="Nenhum capítulo aberto"
                        description="Escolha um capítulo na sidebar para editar o conteúdo ou use as ferramentas EPUB logo abaixo para importar ou exportar arquivos."
                        action={
                          <Button
                            type="button"
                            onClick={() => {
                              if (firstChapterHref) {
                                onNavigateToHref(firstChapterHref);
                              }
                            }}
                            disabled={!firstChapterHref}
                          >
                            Abrir primeiro capítulo
                          </Button>
                        }
                      />
                    </div>
                  </div>
                </section>
                {epubToolsAccordion}
              </>
            )}
          </div>

          <aside
            className="order-2 min-w-0 space-y-4 2xl:col-start-2 2xl:row-span-2 2xl:w-[340px] 2xl:shrink-0"
            data-testid="chapter-editor-sidebar"
          >
            {hasActiveChapter ? (
              <Accordion
                type="multiple"
                defaultValue={["publication", "cover", "sources"]}
                className="project-editor-accordion space-y-2.5"
                data-testid="chapter-metadata-accordion"
              >
                <AccordionItem value="publication" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <EditorAccordionHeader
                      title="Publicação"
                      subtitle="Release e visibilidade do capítulo"
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="chapter-release-date">Data de release</Label>
                        <Input
                          id="chapter-release-date"
                          type="date"
                          value={draft.releaseDate || ""}
                          onChange={(event) =>
                            updateDraft((current) => ({ ...current, releaseDate: event.target.value }))
                          }
                        />
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <Label className="text-sm">Publicado</Label>
                            <p className="text-xs text-muted-foreground">
                              Controle se o capítulo fica visível ao público.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Publicado</span>
                            <Switch
                              checked={draft.publicationStatus !== "draft"}
                              onCheckedChange={(checked) =>
                                updateDraft((current) => ({
                                  ...current,
                                  publicationStatus: checked ? "published" : "draft",
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cover" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <EditorAccordionHeader
                      title="Capa do capítulo"
                      subtitle="Biblioteca dedicada e texto alternativo"
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div>
                          <Label className="text-sm">Imagem de capa</Label>
                          <p className="text-xs text-muted-foreground">
                            Usa a pasta dedicada do capítulo na biblioteca.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsLibraryOpen(true)}
                        >
                          <ImagePlus className="h-4 w-4" />
                          <span>Biblioteca</span>
                        </Button>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-[112px_minmax(0,1fr)] 2xl:grid-cols-1">
                        {draft.coverImageUrl ? (
                          <img
                            src={draft.coverImageUrl}
                            alt={draft.coverImageAlt || DEFAULT_PROJECT_COVER_ALT}
                            className="h-40 w-28 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-40 w-28 items-center justify-center rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                            Sem capa
                          </div>
                        )}
                        <div className="space-y-3">
                          <Input
                            value={draft.coverImageUrl || ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                coverImageUrl: event.target.value,
                              }))
                            }
                            placeholder="URL da capa"
                          />
                          <Input
                            value={draft.coverImageAlt || ""}
                            onChange={(event) =>
                              updateDraft((current) => ({
                                ...current,
                                coverImageAlt: event.target.value,
                              }))
                            }
                            placeholder="Texto alternativo da capa"
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="sources" className={editorSectionClassName}>
                  <AccordionTrigger className={editorAccordionTriggerClassName}>
                    <EditorAccordionHeader
                      title="Fontes de download"
                      subtitle="Links opcionais para capítulos híbridos"
                    />
                  </AccordionTrigger>
                  <AccordionContent className={editorSectionContentClassName}>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                        <div>
                          <Label className="text-sm">Fontes</Label>
                          <p className="text-xs text-muted-foreground">
                            Opcional para capítulos com leitura e download.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateDraft((current) => ({
                              ...current,
                              sources: [...(current.sources || []), { label: "", url: "" }],
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" />
                          <span>Adicionar</span>
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {(draft.sources || []).map((source, sourceIndex) => (
                          <div
                            key={`chapter-source-${sourceIndex}`}
                            className="grid gap-2 rounded-xl border border-border/60 bg-card/70 p-3"
                          >
                            <Input
                              value={source.label}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  sources: (current.sources || []).map((item, index) =>
                                    index === sourceIndex
                                      ? { ...item, label: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder="Fonte"
                            />
                            <Input
                              value={source.url}
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  sources: (current.sources || []).map((item, index) =>
                                    index === sourceIndex
                                      ? { ...item, url: event.target.value }
                                      : item,
                                  ),
                                }))
                              }
                              placeholder="URL"
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updateDraft((current) => ({
                                    ...current,
                                    sources: (current.sources || []).filter(
                                      (_, index) => index !== sourceIndex,
                                    ),
                                  }))
                                }
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        ))}
                        {(draft.sources || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>
                        ) : null}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : null}
            <Accordion
              type="single"
              collapsible
              defaultValue="navigation"
              className="project-editor-accordion space-y-2.5"
            >
              <AccordionItem
                value="navigation"
                className={editorSectionClassName}
                data-testid="chapter-navigation-section"
              >
                <AccordionTrigger className={editorAccordionTriggerClassName}>
                  <EditorAccordionHeader
                    title="Navegação"
                    subtitle="Busca, filtros e troca rápida de capítulo"
                  />
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] 2xl:grid-cols-1">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={chapterSearchQuery}
                          onChange={(event) => onChapterSearchQueryChange(event.target.value)}
                          placeholder="Buscar capítulo..."
                          className="pl-9"
                        />
                      </div>
                      <Select
                        value={filterMode}
                        onValueChange={(value) => onFilterModeChange(value as ChapterFilterMode)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Filtrar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="draft">Rascunhos</SelectItem>
                          <SelectItem value="published">Publicados</SelectItem>
                          <SelectItem value="with-content">Com conteúdo</SelectItem>
                          <SelectItem value="without-content">Sem conteúdo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {groupedFilteredChapters.length > 0 ? (
                      <Accordion
                        type="single"
                        collapsible
                        value={openNavigationVolumeKey}
                        onValueChange={setOpenNavigationVolumeKey}
                        className="space-y-2.5"
                        data-testid="chapter-navigation-volume-accordion"
                      >
                        {groupedFilteredChapters.map((group) => (
                          <AccordionItem
                            key={group.key}
                            value={group.key}
                            className="overflow-hidden rounded-2xl border border-border/60 bg-background/45 px-3"
                            data-testid={`chapter-navigation-volume-${group.key}`}
                          >
                            <AccordionTrigger className="gap-3 py-3 text-left hover:no-underline">
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                <span className="truncate text-sm font-semibold">{group.label}</span>
                                <Badge variant="outline" className="shrink-0">
                                  {group.items.length}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-3">
                              <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                                {group.items.map((episode) => {
                                  const episodeKey = buildEpisodeKey(episode.number, episode.volume);
                                  const href = buildDashboardProjectChapterEditorHref(
                                    project.id,
                                    episode.number,
                                    episode.volume,
                                  );
                                  const isActive = episodeKey === activeChapterKey;
                                  return (
                                    <button
                                      key={episodeKey}
                                      type="button"
                                      onClick={() => void onNavigateToHref(href)}
                                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                        isActive
                                          ? "border-primary/50 bg-primary/5 shadow-sm"
                                          : "border-border/60 bg-background/50 hover:bg-background/80"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                            Capítulo {episode.number}
                                          </p>
                                          <p className="line-clamp-2 text-sm font-semibold text-foreground">
                                            {String(episode.title || "").trim() ||
                                              `Capítulo ${episode.number}`}
                                          </p>
                                        </div>
                                        <Badge
                                          variant={
                                            episode.publicationStatus === "draft"
                                              ? "outline"
                                              : "secondary"
                                          }
                                        >
                                          {chapterStatusLabel(episode)}
                                        </Badge>
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>
                                          {chapterHasContent(episode) ? "Com leitura" : "Sem leitura"}
                                        </span>
                                        {episode.sources?.length ? (
                                          <span>- {episode.sources.length} fonte(s)</span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                        Nenhum capítulo corresponde ao filtro atual.
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </aside>

          {hasActiveChapter ? (
            <section
              className={`${editorSectionClassName} order-3 mt-1 min-w-0 2xl:col-start-1 2xl:row-start-2 2xl:mt-0`}
              data-state="open"
              data-testid="chapter-content-section"
            >
              <div className={editorSectionHeaderClassName}>
                <div className="flex w-full items-center justify-between gap-4 text-left">
                  <span className="text-sm font-semibold">Conteúdo</span>
                  <span className="text-xs text-muted-foreground">
                    Lexical com largura ampliada para a escrita do capítulo
                  </span>
                </div>
              </div>
              <div className={editorSectionContentClassName}>
                <div
                  className="chapter-editor-lexical-wrapper min-w-0"
                  data-testid="chapter-lexical-wrapper"
                >
                  <Suspense fallback={<LexicalEditorFallback />}>
                    <LexicalEditor
                      ref={editorRef}
                      value={draft.content || ""}
                      onChange={(nextValue) =>
                        updateDraft((current) => ({
                          ...current,
                          content: nextValue,
                          contentFormat: "lexical",
                        }))
                      }
                      placeholder="Escreva o capítulo..."
                      className="lexical-playground--modal lexical-playground--stretch lexical-playground--chapter-editor min-w-0 w-full"
                      imageLibraryOptions={chapterImageLibraryOptions}
                      autoFocus={false}
                    />
                  </Suspense>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        {hasActiveChapter ? (
          <Suspense
            fallback={
              isLibraryOpen ? (
                <ImageLibraryDialogLoadingFallback
                  open={isLibraryOpen}
                  onOpenChange={setIsLibraryOpen}
                  description="Selecione uma capa para o capítulo."
                />
              ) : null
            }
          >
            <ImageLibraryDialog
              open={isLibraryOpen}
              onOpenChange={setIsLibraryOpen}
              apiBase={apiBase}
              uploadFolder={chapterImageLibraryOptions.uploadFolder}
              listFolders={chapterImageLibraryOptions.listFolders}
              listAll={chapterImageLibraryOptions.listAll}
              includeProjectImages={chapterImageLibraryOptions.includeProjectImages}
              projectImageProjectIds={chapterImageLibraryOptions.projectImageProjectIds}
              projectImagesView={chapterImageLibraryOptions.projectImagesView}
              allowDeselect
              mode="single"
              currentSelectionUrls={draft.coverImageUrl ? [draft.coverImageUrl] : []}
              onSave={({ urls, items }) => {
                const nextUrl = String(urls[0] || "").trim();
                updateDraft((current) => ({
                  ...current,
                  coverImageUrl: nextUrl,
                  coverImageAlt: nextUrl
                    ? resolveAssetAltText(items[0]?.altText, getEpisodeCoverAltFallback(true))
                    : "",
                }));
                setIsLibraryOpen(false);
              }}
            />
          </Suspense>
        ) : null}
      </>
    );
  },
);

ChapterEditorPane.displayName = "ChapterEditorPane";

const DashboardProjectChapterEditor = () => {
  usePageMeta({ title: "Gerenciamento de Conteúdo", noIndex: true });
  const apiBase = getApiBase();
  const navigate = useNavigate();
  const { projectId, chapterNumber } = useParams<{ projectId: string; chapterNumber?: string }>();
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [hasLoadedCurrentUser, setHasLoadedCurrentUser] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<ChapterFilterMode>("all");
  const [activeDraft, setActiveDraft] = useState<ProjectEpisode | null>(null);
  const editorPaneRef = useRef<ChapterEditorPaneHandle | null>(null);
  const [backendCapabilities, setBackendCapabilities] = useState<ApiContractCapabilities | null>(
    null,
  );
  const [backendBuildMetadata, setBackendBuildMetadata] =
    useState<ApiContractBuildMetadata | null>(null);
  const [backendCapabilitiesError, setBackendCapabilitiesError] = useState<string | null>(null);
  const [epubRouteStatus, setEpubRouteStatus] = useState<EpubRouteStatus>("unknown");
  const [epubImportFile, setEpubImportFile] = useState<File | null>(null);
  const [epubImportTargetVolume, setEpubImportTargetVolume] = useState("");
  const [epubImportAsDraft, setEpubImportAsDraft] = useState(true);
  const [isImportingEpub, setIsImportingEpub] = useState(false);
  const [epubExportVolume, setEpubExportVolume] = useState("");
  const [epubExportIncludeDrafts, setEpubExportIncludeDrafts] = useState(false);
  const [isExportingEpub, setIsExportingEpub] = useState(false);
  const epubImportInputRef = useRef<HTMLInputElement | null>(null);
  const pendingEpubAutoImportRef = useRef(false);
  const pendingEpubImportIdsRef = useRef<Set<string>>(new Set());

  const canManageProjects = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);
  const frontendBuildMetadata = useMemo(() => getFrontendBuildMetadata(), []);
  const locationOrigin = useMemo(
    () => (typeof window !== "undefined" && window.location ? window.location.origin : ""),
    [],
  );
  const backendSupportsEpubImport = backendCapabilities?.project_epub_import === true;
  const backendSupportsEpubExport = backendCapabilities?.project_epub_export === true;
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
      status: number | "network" | "blocked";
      reason: string;
    }) => {
      console.warn("epub_backend_parity_mismatch", {
        reason,
        path,
        status,
        locationOrigin,
        apiBase,
        contractVersion: "v1",
        frontend: frontendBuildMetadata,
        backend: backendBuildMetadata,
      });
    },
    [apiBase, backendBuildMetadata, frontendBuildMetadata, locationOrigin],
  );

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

  useEffect(() => {
    return () => {
      cleanupPendingEpubImports();
    };
  }, [cleanupPendingEpubImports]);

  const volumeParam = searchParams.get("volume");
  const parsedVolume = Number(volumeParam);
  const resolvedVolume =
    volumeParam !== null && Number.isFinite(parsedVolume) ? parsedVolume : undefined;

  useEffect(() => {
    let isMounted = true;
    const loadCurrentUser = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
          if (isMounted) {
            setCurrentUser(null);
          }
          return;
        }
        const data = await response.json();
        const nextUser =
          data && typeof data === "object" && "user" in data
            ? (data.user as CurrentUser | null | undefined)
            : (data as CurrentUser | null | undefined);
        if (isMounted) {
          setCurrentUser(nextUser ?? null);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setHasLoadedCurrentUser(true);
        }
      }
    };
    void loadCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [apiBase]);

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
        const data = (await response.json()) as ApiContractV1;
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

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setHasLoadError(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setHasLoadError(false);
    try {
      const response = await apiFetch(apiBase, `/api/projects/${projectId}`, { auth: true });
      if (!response.ok) {
        setProject(null);
        setHasLoadError(response.status !== 404);
        return;
      }
      const data = (await response.json()) as { project?: ProjectRecord };
      setProject(data?.project || null);
    } catch {
      setProject(null);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const isLightNovel = isLightNovelType(project?.type || "");
  const chapters = useMemo(
    () => sortChapters(Array.isArray(project?.episodeDownloads) ? project.episodeDownloads : []),
    [project?.episodeDownloads],
  );

  const activeChapterLookup = useMemo(() => {
    if (!chapterNumber) {
      return { ok: false as const, code: "neutral" as const };
    }
    return resolveEpisodeLookup(chapters, chapterNumber, resolvedVolume);
  }, [chapterNumber, chapters, resolvedVolume]);
  const activeChapter =
    activeChapterLookup.ok && "episode" in activeChapterLookup ? activeChapterLookup.episode : null;
  const activeChapterIndex =
    activeChapterLookup.ok && "index" in activeChapterLookup ? activeChapterLookup.index : -1;
  const activeChapterKey =
    activeChapter && chapterNumber ? buildEpisodeKey(activeChapter.number, activeChapter.volume) : null;
  const activeChapterSnapshot = useMemo(() => buildChapterSnapshot(activeChapter), [activeChapter]);

  useEffect(() => {
    if (!activeChapter || !activeChapterKey) {
      setActiveDraft(null);
      return;
    }
    const nextDraft = normalizeChapterForSave(activeChapter);
    setActiveDraft((current) => {
      if (!current) {
        return nextDraft;
      }
      const currentKey = buildEpisodeKey(current.number, current.volume);
      if (currentKey !== activeChapterKey) {
        return nextDraft;
      }
      const currentSnapshot = buildChapterSnapshot(current);
      if (currentSnapshot === activeChapterSnapshot) {
        return nextDraft;
      }
      return current;
    });
  }, [activeChapter, activeChapterKey, activeChapterSnapshot]);

  const projectSnapshot = useMemo(() => {
    if (!project) {
      return null;
    }
    return overlayDraftOnProject(project, activeChapterKey, activeDraft);
  }, [activeChapterKey, activeDraft, project]);

  const filteredChapters = useMemo(() => {
    const normalizedQuery = String(chapterSearchQuery || "")
      .trim()
      .toLowerCase();
    return chapters.filter((episode) => {
      if (!matchesFilter(episode, filterMode)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = [
        episode.number,
        episode.volume,
        episode.title,
        episode.displayLabel,
        episode.synopsis,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(normalizedQuery);
    });
  }, [chapterSearchQuery, chapters, filterMode]);

  const groupedFilteredChapters = useMemo(() => {
    const groups = new Map<string, { label: string; items: ProjectEpisode[] }>();
    filteredChapters.forEach((episode) => {
      const key = Number.isFinite(Number(episode.volume)) ? String(Number(episode.volume)) : "none";
      if (!groups.has(key)) {
        groups.set(key, {
          label: buildChapterVolumeLabel(episode.volume),
          items: [],
        });
      }
      groups.get(key)?.items.push(episode);
    });
    return Array.from(groups.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
  }, [filteredChapters]);

  const navigableChapters = useMemo(() => {
    if (
      activeChapterKey &&
      filteredChapters.some(
        (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
      )
    ) {
      return filteredChapters;
    }
    return chapters;
  }, [activeChapterKey, chapters, filteredChapters]);

  const activeNavigableChapterIndex = useMemo(
    () =>
      activeChapterKey
        ? navigableChapters.findIndex(
            (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
          )
        : -1,
    [activeChapterKey, navigableChapters],
  );

  const previousChapterHref =
    activeNavigableChapterIndex > 0
      ? buildDashboardProjectChapterEditorHref(
          project?.id || "",
          navigableChapters[activeNavigableChapterIndex - 1]?.number,
          navigableChapters[activeNavigableChapterIndex - 1]?.volume,
        )
      : null;
  const nextChapterHref =
    activeNavigableChapterIndex >= 0 && activeNavigableChapterIndex < navigableChapters.length - 1
      ? buildDashboardProjectChapterEditorHref(
          project?.id || "",
          navigableChapters[activeNavigableChapterIndex + 1]?.number,
          navigableChapters[activeNavigableChapterIndex + 1]?.volume,
        )
      : null;
  const neutralHref = buildDashboardProjectChaptersEditorHref(project?.id || projectId || "");

  const requestNavigateToHref = useCallback(
    async (href: string) => {
      const canLeave = await editorPaneRef.current?.requestLeave?.();
      if (canLeave === false) {
        return;
      }
      navigate(href);
    },
    [navigate],
  );

  const handleChapterSaved = useCallback(
    (nextProject: ProjectRecord, nextChapter: ProjectEpisode) => {
      setProject(nextProject);
      setActiveDraft(nextChapter);
      navigate(
        buildDashboardProjectChapterEditorHref(
          nextProject.id,
          nextChapter.number,
          nextChapter.volume,
        ),
        { replace: true },
      );
    },
    [navigate],
  );

  const persistProjectSnapshot = useCallback(
    async (snapshot: ProjectRecord) => {
      const { revision: _ignoredRevision, ...payload } = snapshot;
      const response = await apiFetch(apiBase, `/api/projects/${snapshot.id}`, {
        method: "PUT",
        auth: true,
        json: {
          ...payload,
          ifRevision: project?.revision || "",
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errorCode = String(data?.error || "").trim();
        if (errorCode === "duplicate_episode_key") {
          toast({
            title: "Falha ao importar EPUB",
            description: EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
            variant: "destructive",
          });
          return null;
        }
        if (errorCode === "duplicate_volume_cover_key") {
          toast({
            title: "Falha ao importar EPUB",
            description: "O projeto resultante ficou com mais de uma entrada para o mesmo volume.",
            variant: "destructive",
          });
          return null;
        }
        toast({
          title: "Não foi possível salvar o projeto",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
        return null;
      }
      const data = (await response.json()) as { project?: ProjectRecord };
      return data?.project || null;
    },
    [apiBase, project?.revision],
  );

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
          if (response.status === 404) {
            if (data?.error === "project_not_found") {
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
            (typeof data?.error === "string" && data.error === "project_snapshot_too_large") ||
            isLegacyMultipartSnapshotTooLargeError(data?.error, data?.detail)
          ) {
            setEpubRouteStatus("ok");
            toast({
              title: "Falha ao importar EPUB",
              description: EPUB_IMPORT_SNAPSHOT_TOO_LARGE_MESSAGE,
              variant: "destructive",
            });
            return;
          }
          if (typeof data?.error === "string" && data.error === "invalid_project_snapshot") {
            setEpubRouteStatus("ok");
            toast({
              title: "Falha ao importar EPUB",
              description: EPUB_IMPORT_INVALID_SNAPSHOT_MESSAGE,
              variant: "destructive",
            });
            return;
          }
          if (typeof data?.error === "string" && data.error === "duplicate_episode_key") {
            setEpubRouteStatus("ok");
            toast({
              title: "Falha ao importar EPUB",
              description: EPUB_IMPORT_DUPLICATE_EPISODE_MESSAGE,
              variant: "destructive",
            });
            return;
          }
          if (
            typeof data?.error === "string" &&
            data.error === "epub_import_failed" &&
            (isEpubCssEngineFailureDetail(data?.detail) ||
              !(typeof data?.detail === "string" && data.detail.trim().length > 0))
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
              typeof data?.detail === "string"
                ? data.detail
                : "Não foi possível processar o arquivo informado.",
            variant: "destructive",
          });
          return;
        }

        setEpubRouteStatus("ok");
        const data = await response.json();
        registerPendingEpubImportIds(data);
        const chapters = Array.isArray(data?.chapters) ? (data.chapters as ProjectEpisode[]) : [];
        const volumeCovers = Array.isArray(data?.volumeCovers)
          ? (data.volumeCovers as Array<
              ProjectVolumeCover & { mergeMode?: "create" | "update" | "preserve_existing" }
            >)
          : [];

        const importedSnapshot = mergeImportedVolumeCoversIntoProject(
          mergeImportedChaptersIntoProject(projectSnapshot, chapters),
          volumeCovers,
        );
        const persistedProject = await persistProjectSnapshot(importedSnapshot);
        if (!persistedProject) {
          return;
        }
        clearPendingEpubImportIds();
        setProject(persistedProject);

        const importedKeys = chapters
          .map((chapter) => buildEpisodeKey(chapter.number, chapter.volume))
          .filter(Boolean);
        const persistedChapters = sortChapters(
          Array.isArray(persistedProject.episodeDownloads) ? persistedProject.episodeDownloads : [],
        );
        const currentPersistedChapter =
          activeChapterKey && importedKeys.includes(activeChapterKey)
            ? persistedChapters.find(
                (chapter) => buildEpisodeKey(chapter.number, chapter.volume) === activeChapterKey,
              ) || null
            : null;
        const firstImportedChapter = persistedChapters.find((chapter) =>
          importedKeys.includes(buildEpisodeKey(chapter.number, chapter.volume)),
        );
        if (currentPersistedChapter) {
          setActiveDraft(normalizeChapterForSave(currentPersistedChapter));
        } else if (firstImportedChapter) {
          navigate(
            buildDashboardProjectChapterEditorHref(
              persistedProject.id,
              firstImportedChapter.number,
              firstImportedChapter.volume,
            ),
            { replace: true },
          );
        }

        const importedChapterCount = Number.isFinite(Number(data?.summary?.chapters))
          ? Number(data.summary.chapters)
          : chapters.length;
        toast({
          title: "EPUB importado",
          description: `${importedChapterCount} capítulo(s) incorporados ao projeto.`,
          intent: "success",
        });
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
        setIsImportingEpub(false);
      }
    },
    [
      activeChapterKey,
      apiBase,
      backendCapabilitiesError,
      backendSupportsEpubImport,
      clearPendingEpubImportIds,
      epubImportAsDraft,
      epubImportTargetVolume,
      isImportingEpub,
      logEpubParityIssue,
      navigate,
      persistProjectSnapshot,
      projectSnapshot,
      registerPendingEpubImportIds,
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
  ]);

  if (!projectId) {
    return <NotFound />;
  }

  if (isLoading || !hasLoadedCurrentUser) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={!hasLoadedCurrentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer maxWidth="7xl">
          <AsyncState kind="loading" title="Carregando editor de capítulo" />
        </DashboardPageContainer>
      </DashboardShell>
    );
  }

  if (hasLoadError) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={!hasLoadedCurrentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer maxWidth="6xl">
          <AsyncState
            kind="error"
            title="Não foi possível carregar o capítulo"
            description="Tente novamente em alguns instantes."
            action={
              <Button variant="outline" onClick={() => void loadProject()}>
                Tentar novamente
              </Button>
            }
          />
        </DashboardPageContainer>
      </DashboardShell>
    );
  }

  if (!canManageProjects) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={!hasLoadedCurrentUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <DashboardPageContainer maxWidth="6xl">
          <AsyncState
            kind="error"
            title="Acesso negado"
            description="Você não tem permissão para editar capítulos."
          />
        </DashboardPageContainer>
      </DashboardShell>
    );
  }

  if (!project || !isLightNovel) {
    return <NotFound />;
  }

  if (!activeChapter && chapterNumber) {
    if (activeChapterLookup.code === "volume_required") {
      return (
        <DashboardShell
          currentUser={currentUser}
          isLoadingUser={!hasLoadedCurrentUser}
          onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
        >
          <DashboardPageContainer maxWidth="6xl">
            <AsyncState
              kind="error"
              title="Volume obrigatório"
              description="Esse número de capítulo existe em mais de um volume. Abra o editor pela leitura pública ou informe o volume na URL."
              action={
                <Button asChild variant="outline">
                  <Link to={buildDashboardProjectEditorHref(projectId)}>Voltar ao projeto</Link>
                </Button>
              }
            />
          </DashboardPageContainer>
        </DashboardShell>
      );
    }
    return <NotFound />;
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={!hasLoadedCurrentUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <DashboardPageContainer maxWidth="editor" reveal={false}>
        <ChapterEditorPane
          key={activeChapterKey || "neutral"}
          ref={editorPaneRef}
          project={project}
          activeChapter={activeChapter}
          activeDraft={activeDraft}
          onDraftChange={setActiveDraft}
          activeChapterKey={activeChapterKey}
          chapterCount={chapters.length}
          chapterIndex={Math.max(activeChapterIndex, 0)}
          groupedFilteredChapters={groupedFilteredChapters}
          chapterSearchQuery={chapterSearchQuery}
          onChapterSearchQueryChange={setChapterSearchQuery}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          previousChapterHref={previousChapterHref}
          nextChapterHref={nextChapterHref}
          neutralHref={neutralHref}
          onNavigateToHref={requestNavigateToHref}
          onChapterSaved={handleChapterSaved}
          backendSupportsEpubImport={backendSupportsEpubImport}
          backendSupportsEpubExport={backendSupportsEpubExport}
          backendBuildLabel={backendBuildLabel}
          frontendBuildLabel={frontendBuildLabel}
          epubCapabilityState={epubCapabilityState}
          epubImportInputRef={epubImportInputRef}
          epubImportFile={epubImportFile}
          epubImportTargetVolume={epubImportTargetVolume}
          onEpubImportTargetVolumeChange={setEpubImportTargetVolume}
          epubImportAsDraft={epubImportAsDraft}
          onEpubImportAsDraftChange={setEpubImportAsDraft}
          isImportingEpub={isImportingEpub}
          onOpenEpubPicker={openEpubImportPicker}
          onEpubImportFileChange={handleEpubImportFileChange}
          onEpubImportFileCancel={() => {
            pendingEpubAutoImportRef.current = false;
          }}
          onImportEpub={handleImportEpub}
          epubExportVolume={epubExportVolume}
          onEpubExportVolumeChange={setEpubExportVolume}
          epubExportIncludeDrafts={epubExportIncludeDrafts}
          onEpubExportIncludeDraftsChange={setEpubExportIncludeDrafts}
          isExportingEpub={isExportingEpub}
          onExportEpub={handleExportEpub}
        />
      </DashboardPageContainer>
    </DashboardShell>
  );
};

export default DashboardProjectChapterEditor;
