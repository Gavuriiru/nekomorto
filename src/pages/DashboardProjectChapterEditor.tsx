import DashboardAutosaveStatus from "@/components/DashboardAutosaveStatus";
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
import type { Project, ProjectEpisode } from "@/data/projects";
import { useAutosave } from "@/hooks/use-autosave";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  DEFAULT_PROJECT_COVER_ALT,
  getEpisodeCoverAltFallback,
  resolveAssetAltText,
} from "@/lib/image-alt";
import { filterImageLibraryFoldersByAccess } from "@/lib/image-library-scope";
import {
  buildDashboardProjectChapterEditorHref,
  buildDashboardProjectEditorHref,
  buildProjectPublicReadingHref,
} from "@/lib/project-editor-routes";
import { buildEpisodeKey, resolveEpisodeLookup } from "@/lib/project-episode-key";
import { buildChapterFolder, resolveProjectImageFolders } from "@/lib/project-image-folders";
import { isLightNovelType } from "@/lib/project-utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Plus,
  Search,
} from "lucide-react";
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

type ChapterEditorPaneProps = {
  project: ProjectRecord;
  chapter: ProjectEpisode;
  chapterCount: number;
  chapterIndex: number;
  activeChapterKey: string;
  groupedFilteredChapters: GroupedChapterEntry[];
  chapterSearchQuery: string;
  onChapterSearchQueryChange: (nextValue: string) => void;
  filterMode: ChapterFilterMode;
  onFilterModeChange: (nextValue: ChapterFilterMode) => void;
  previousChapterHref: string | null;
  nextChapterHref: string | null;
  onNavigateToHref: (href: string) => void;
  onProjectSaved: (project: ProjectRecord, chapter: ProjectEpisode) => void;
};

const editorSectionClassName =
  "project-editor-section rounded-2xl border border-border/60 bg-card/70 px-4";
const editorSectionHeaderClassName =
  "project-editor-section-trigger flex w-full items-center justify-between gap-4 py-2 text-left";
const editorSectionContentClassName = "project-editor-section-content px-1 pb-2.5";

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

const ChapterEditorPane = forwardRef<ChapterEditorPaneHandle, ChapterEditorPaneProps>(
  (
    {
      project,
      chapter,
      chapterCount,
      chapterIndex,
      activeChapterKey,
      groupedFilteredChapters,
      chapterSearchQuery,
      onChapterSearchQueryChange,
      filterMode,
      onFilterModeChange,
      previousChapterHref,
      nextChapterHref,
      onNavigateToHref,
      onProjectSaved,
    },
    ref,
  ) => {
    const apiBase = getApiBase();
    const [draft, setDraft] = useState<ProjectEpisode>(() => normalizeChapterForSave(chapter));
    const [identityError, setIdentityError] = useState<string | null>(null);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const editorRef = useRef<LexicalEditorHandle | null>(null);

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
          index: chapterIndex,
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
        setIdentityError(null);
        const response = await apiFetch(
          apiBase,
          `/api/projects/${project.id}/chapters/${chapter.number}${
            Number.isFinite(Number(chapter.volume)) ? `?volume=${Number(chapter.volume)}` : ""
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
        setDraft(normalizedSavedChapter);
        onProjectSaved(data.project, normalizedSavedChapter);
        return normalizedSavedChapter;
      },
      [apiBase, chapter.number, chapter.volume, onProjectSaved, project.id, project.revision],
    );

    const chapterAutosave = useAutosave<ProjectEpisode>({
      value: draft,
      isReady: true,
      onSave: saveChapter,
      debounceMs: 1500,
      retryMax: 1,
      onError: () => {
        toast({
          title: "Autosave com pendência",
          description: "As alterações continuam locais até um novo salvamento.",
          variant: "destructive",
        });
      },
    });

    const requestLeave = useCallback(async () => {
      if (!chapterAutosave.isDirty) {
        return true;
      }
      if (chapterAutosave.enabled) {
        const flushed = await chapterAutosave.flushNow();
        if (flushed) {
          return true;
        }
        toast({
          title: "Não foi possível salvar antes de sair",
          description: "Resolva o erro atual ou desative o autosave para confirmar a saída.",
          variant: "destructive",
        });
        return false;
      }
      return window.confirm(
        "Você tem alterações não salvas neste capítulo. Deseja sair mesmo assim?",
      );
    }, [chapterAutosave.enabled, chapterAutosave.flushNow, chapterAutosave.isDirty]);

    useImperativeHandle(
      ref,
      () => ({
        requestLeave,
      }),
      [requestLeave],
    );

    useEffect(() => {
      if (!chapterAutosave.isDirty) {
        return;
      }
      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [chapterAutosave.isDirty]);

    useEffect(() => {
      const handleHotkeys = (event: KeyboardEvent) => {
        const isSaveShortcut =
          (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "s";
        if (isSaveShortcut) {
          event.preventDefault();
          void chapterAutosave.flushNow();
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
    }, [chapterAutosave.flushNow, nextChapterHref, onNavigateToHref, previousChapterHref]);

    const publicReadingHref = useMemo(
      () => buildProjectPublicReadingHref(project.id, draft.number, draft.volume),
      [draft.number, draft.volume, project.id],
    );
    const chapterTitle = String(draft.title || "").trim() || `Capítulo ${draft.number}`;
    const chapterSummaryLabel =
      draft.entryKind === "extra" ? "Extra em edição" : "Capítulo em edição";
    const chapterPositionLabel = `${Math.max(chapterIndex + 1, 1)} de ${Math.max(chapterCount, 1)}`;
    const activeNavigationVolumeKey = useMemo(() => {
      const activeGroup = groupedFilteredChapters.find((group) =>
        group.items.some(
          (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
        ),
      );
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
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-xl font-semibold md:text-2xl">
                      Editor dedicado de capítulo
                    </h1>
                    <p className="max-w-3xl text-xs text-muted-foreground md:text-sm">
                      Fluxo otimizado para light novel com navegação contínua e um editor mais
                      amplo.
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
                      {chapterTitle} - {chapterPositionLabel}
                    </p>
                  </div>
                  <DashboardAutosaveStatus
                    title="Autosave do capítulo"
                    status={chapterAutosave.status}
                    enabled={chapterAutosave.enabled}
                    onEnabledChange={chapterAutosave.setEnabled}
                    lastSavedAt={chapterAutosave.lastSavedAt}
                    errorMessage={
                      chapterAutosave.status === "error"
                        ? "As alterações continuam pendentes até um novo salvamento."
                        : null
                    }
                    onManualSave={() => {
                      void chapterAutosave.flushNow();
                    }}
                    manualActionLabel={
                      chapterAutosave.status === "saving" ? "Salvando..." : "Salvar capítulo"
                    }
                    manualActionDisabled={chapterAutosave.status === "saving"}
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className="project-editor-status-bar flex flex-wrap items-center gap-2 px-4 py-1.5 md:px-6 lg:px-8"
            data-testid="chapter-editor-status-bar"
          >
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

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={buildDashboardProjectEditorHref(project.id)}>
                  <ArrowLeft className="h-4 w-4" />
                  <span>Voltar ao projeto</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={publicReadingHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  <span>Abrir leitura</span>
                </Link>
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
            </div>
          </div>
        </div>
        <div
          className="project-editor-layout mx-auto grid w-full gap-5 px-4 pb-8 pt-4 md:px-6 md:pb-10 lg:px-8 2xl:grid-cols-[minmax(0,72rem)_340px] 2xl:items-start 2xl:justify-center"
          data-testid="chapter-editor-upper-layout"
        >
          <div
            className="order-1 min-w-0 w-full 2xl:col-start-1 2xl:row-start-1 2xl:max-w-6xl"
            data-testid="chapter-editor-main-column"
          >
            <Accordion
              type="multiple"
              defaultValue={["identity"]}
              className="project-editor-accordion space-y-2.5"
            >
              <AccordionItem value="identity" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">Identidade do capítulo</span>
                    <span className="text-xs text-muted-foreground">
                      Título, numeração, tipo e resumo
                    </span>
                  </div>
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
                          setDraft((prev) => ({ ...prev, title: event.target.value }))
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
                            setDraft((prev) => ({
                              ...prev,
                              number: Number(event.target.value || prev.number),
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
                            setDraft((prev) => ({
                              ...prev,
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
                            setDraft((prev) => ({
                              ...prev,
                              entryKind: value === "extra" ? "extra" : "main",
                              displayLabel:
                                value === "extra" ? prev.displayLabel || "Extra" : undefined,
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
                            setDraft((prev) => ({
                              ...prev,
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
                              setDraft((prev) => ({ ...prev, displayLabel: event.target.value }))
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
                              setDraft((prev) => ({ ...prev, entrySubtype: event.target.value }))
                            }
                            placeholder="Ex.: capítulo, prólogo, epílogo"
                          />
                        </div>
                      )}

                      {draft.entryKind === "extra" ? (
                        <div className="space-y-2">
                          <Label htmlFor="chapter-entry-subtype">Subtipo</Label>
                          <Input
                            id="chapter-entry-subtype"
                            value={draft.entrySubtype || ""}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, entrySubtype: event.target.value }))
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
                          setDraft((prev) => ({ ...prev, synopsis: event.target.value }))
                        }
                        rows={5}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <aside
            className="order-2 min-w-0 space-y-4 2xl:col-start-2 2xl:w-[340px] 2xl:shrink-0"
            data-testid="chapter-editor-sidebar"
          >
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
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">Navegação</span>
                    <span className="text-xs text-muted-foreground">
                      Busca, filtros e troca rápida de capítulo
                    </span>
                  </div>
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
                                <span className="truncate text-sm font-semibold">
                                  {group.label}
                                </span>
                                <Badge variant="outline" className="shrink-0">
                                  {group.items.length}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-3">
                              <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                                {group.items.map((episode) => {
                                  const episodeKey = buildEpisodeKey(
                                    episode.number,
                                    episode.volume,
                                  );
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
                                          {chapterHasContent(episode)
                                            ? "Com leitura"
                                            : "Sem leitura"}
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

            <Accordion
              type="multiple"
              defaultValue={["publication", "cover", "sources"]}
              className="project-editor-accordion space-y-2.5"
              data-testid="chapter-metadata-accordion"
            >
              <AccordionItem value="publication" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">PublicaÃ§Ã£o</span>
                    <span className="text-xs text-muted-foreground">
                      Release e visibilidade do capÃ­tulo
                    </span>
                  </div>
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
                          setDraft((prev) => ({ ...prev, releaseDate: event.target.value }))
                        }
                      />
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <Label className="text-sm">Publicado</Label>
                          <p className="text-xs text-muted-foreground">
                            Controle se o capÃ­tulo fica visÃ­vel ao pÃºblico.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Publicado</span>
                          <Switch
                            checked={draft.publicationStatus !== "draft"}
                            onCheckedChange={(checked) =>
                              setDraft((prev) => ({
                                ...prev,
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
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">Capa do capÃ­tulo</span>
                    <span className="text-xs text-muted-foreground">
                      Biblioteca dedicada e texto alternativo
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                      <div>
                        <Label className="text-sm">Imagem de capa</Label>
                        <p className="text-xs text-muted-foreground">
                          Usa a pasta dedicada do capÃ­tulo na biblioteca.
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
                            setDraft((prev) => ({ ...prev, coverImageUrl: event.target.value }))
                          }
                          placeholder="URL da capa"
                        />
                        <Input
                          value={draft.coverImageAlt || ""}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, coverImageAlt: event.target.value }))
                          }
                          placeholder="Texto alternativo da capa"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="sources" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">Fontes de download</span>
                    <span className="text-xs text-muted-foreground">
                      Links opcionais para capÃ­tulos hÃ­bridos
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className={editorSectionContentClassName}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                      <div>
                        <Label className="text-sm">Fontes</Label>
                        <p className="text-xs text-muted-foreground">
                          Opcional para capÃ­tulos com leitura e download.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            sources: [...(prev.sources || []), { label: "", url: "" }],
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
                              setDraft((prev) => {
                                const nextSources = [...(prev.sources || [])];
                                nextSources[sourceIndex] = {
                                  ...nextSources[sourceIndex],
                                  label: event.target.value,
                                };
                                return { ...prev, sources: nextSources };
                              })
                            }
                            placeholder="Fonte"
                          />
                          <Input
                            value={source.url}
                            onChange={(event) =>
                              setDraft((prev) => {
                                const nextSources = [...(prev.sources || [])];
                                nextSources[sourceIndex] = {
                                  ...nextSources[sourceIndex],
                                  url: event.target.value,
                                };
                                return { ...prev, sources: nextSources };
                              })
                            }
                            placeholder="URL"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  sources: (prev.sources || []).filter(
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
          </aside>
          <section
            className={`${editorSectionClassName} order-3 mt-1 min-w-0 2xl:col-start-1 2xl:row-start-2 2xl:max-w-6xl 2xl:mt-0`}
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
                      setDraft((prev) => ({
                        ...prev,
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
          {false ? (
            <Accordion
              type="multiple"
              defaultValue={["publication", "cover", "sources"]}
              className="order-2 project-editor-accordion space-y-2.5 2xl:col-start-2 2xl:row-start-2 2xl:w-[340px] 2xl:shrink-0"
              data-testid="chapter-metadata-accordion"
            >
              <AccordionItem value="identity" className="hidden" aria-hidden="true">
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">Identidade do capítulo</span>
                    <span className="text-xs text-muted-foreground">
                      Título, numeração, tipo e resumo
                    </span>
                  </div>
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
                        id="chapter-title-legacy"
                        value={draft.title || ""}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, title: event.target.value }))
                        }
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="chapter-number">Número</Label>
                        <Input
                          id="chapter-number-legacy"
                          type="number"
                          value={draft.number}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              number: Number(event.target.value || prev.number),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chapter-volume">Volume</Label>
                        <Input
                          id="chapter-volume-legacy"
                          type="number"
                          value={draft.volume ?? ""}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
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
                            setDraft((prev) => ({
                              ...prev,
                              entryKind: value === "extra" ? "extra" : "main",
                              displayLabel:
                                value === "extra" ? prev.displayLabel || "Extra" : undefined,
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
                          id="chapter-reading-order-legacy"
                          type="number"
                          value={draft.readingOrder ?? ""}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
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
                            id="chapter-display-label-legacy"
                            value={draft.displayLabel || ""}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, displayLabel: event.target.value }))
                            }
                            placeholder="Ex.: Side Story"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="chapter-entry-subtype">Subtipo</Label>
                          <Input
                            id="chapter-entry-subtype-legacy"
                            value={draft.entrySubtype || ""}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, entrySubtype: event.target.value }))
                            }
                            placeholder="Ex.: capítulo, prólogo, epílogo"
                          />
                        </div>
                      )}

                      {draft.entryKind === "extra" ? (
                        <div className="space-y-2">
                          <Label htmlFor="chapter-entry-subtype">Subtipo</Label>
                          <Input
                            id="chapter-entry-subtype-legacy-extra"
                            value={draft.entrySubtype || ""}
                            onChange={(event) =>
                              setDraft((prev) => ({ ...prev, entrySubtype: event.target.value }))
                            }
                            placeholder="Ex.: capítulo, prólogo, epílogo"
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chapter-synopsis">Sinopse</Label>
                      <Textarea
                        id="chapter-synopsis-legacy"
                        value={draft.synopsis || ""}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, synopsis: event.target.value }))
                        }
                        rows={5}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="publication" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">Publicação</span>
                    <span className="text-xs text-muted-foreground">
                      Release e visibilidade do capítulo
                    </span>
                  </div>
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
                          setDraft((prev) => ({ ...prev, releaseDate: event.target.value }))
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
                              setDraft((prev) => ({
                                ...prev,
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
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">Capa do capítulo</span>
                    <span className="text-xs text-muted-foreground">
                      Biblioteca dedicada e texto alternativo
                    </span>
                  </div>
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
                            setDraft((prev) => ({ ...prev, coverImageUrl: event.target.value }))
                          }
                          placeholder="URL da capa"
                        />
                        <Input
                          value={draft.coverImageAlt || ""}
                          onChange={(event) =>
                            setDraft((prev) => ({ ...prev, coverImageAlt: event.target.value }))
                          }
                          placeholder="Texto alternativo da capa"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="sources" className={editorSectionClassName}>
                <AccordionTrigger className={editorSectionHeaderClassName}>
                  <div className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-sm font-semibold">Fontes de download</span>
                    <span className="text-xs text-muted-foreground">
                      Links opcionais para capítulos híbridos
                    </span>
                  </div>
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
                          setDraft((prev) => ({
                            ...prev,
                            sources: [...(prev.sources || []), { label: "", url: "" }],
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
                              setDraft((prev) => {
                                const nextSources = [...(prev.sources || [])];
                                nextSources[sourceIndex] = {
                                  ...nextSources[sourceIndex],
                                  label: event.target.value,
                                };
                                return { ...prev, sources: nextSources };
                              })
                            }
                            placeholder="Fonte"
                          />
                          <Input
                            value={source.url}
                            onChange={(event) =>
                              setDraft((prev) => {
                                const nextSources = [...(prev.sources || [])];
                                nextSources[sourceIndex] = {
                                  ...nextSources[sourceIndex],
                                  url: event.target.value,
                                };
                                return { ...prev, sources: nextSources };
                              })
                            }
                            placeholder="URL"
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDraft((prev) => ({
                                  ...prev,
                                  sources: (prev.sources || []).filter(
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
        </div>
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
              setDraft((prev) => ({
                ...prev,
                coverImageUrl: nextUrl,
                coverImageAlt: nextUrl
                  ? resolveAssetAltText(items[0]?.altText, getEpisodeCoverAltFallback(true))
                  : "",
              }));
              setIsLibraryOpen(false);
            }}
          />
        </Suspense>
      </>
    );

    /*
    return (
      <>
        <div className="space-y-4">
          <div
            className="project-editor-top sticky top-3 z-20 border-b border-border/60 bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80"
            data-testid="chapter-editor-sticky-top"
          >
            <div className="space-y-0 px-4 pb-2.5 pt-3.5 text-left md:px-6 lg:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Capítulo</Badge>
                    <Badge variant={draft.publicationStatus === "draft" ? "outline" : "default"}>
                      {chapterStatusLabel(draft)}
                    </Badge>
                    {Number.isFinite(Number(draft.volume)) ? (
                      <Badge variant="outline">{buildChapterVolumeLabel(draft.volume)}</Badge>
                    ) : null}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {String(draft.title || "").trim() || `Capítulo ${draft.number}`}
                    </h2>
                    <p className="text-sm text-muted-foreground">{project.title}</p>
                  </div>
                </div>
                <DashboardAutosaveStatus
                  title="Autosave do capítulo"
                  status={chapterAutosave.status}
                  enabled={chapterAutosave.enabled}
                  onEnabledChange={chapterAutosave.setEnabled}
                  lastSavedAt={chapterAutosave.lastSavedAt}
                  errorMessage={
                    chapterAutosave.status === "error"
                      ? "As alterações continuam pendentes até um novo salvamento."
                      : null
                  }
                  onManualSave={() => {
                    void chapterAutosave.flushNow();
                  }}
                  manualActionLabel={
                    chapterAutosave.status === "saving" ? "Salvando..." : "Salvar capítulo"
                  }
                  manualActionDisabled={chapterAutosave.status === "saving"}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link to={buildDashboardProjectEditorHref(project.id)}>
                    <ArrowLeft className="h-4 w-4" />
                    <span>Voltar ao projeto</span>
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to={publicReadingHref} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    <span>Abrir leitura</span>
                  </Link>
                </Button>
                <Button
                  variant="outline"
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
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="border-border/60 bg-card/80">
              <CardContent className="space-y-4 p-5">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Conteúdo
                  </Label>
                  <Suspense fallback={<LexicalEditorFallback />}>
                    <LexicalEditor
                      ref={editorRef}
                      value={draft.content || ""}
                      onChange={(nextValue) =>
                        setDraft((prev) => ({
                          ...prev,
                          content: nextValue,
                          contentFormat: "lexical",
                        }))
                      }
                      placeholder="Escreva o capítulo..."
                      className="lexical-playground--modal"
                      imageLibraryOptions={chapterImageLibraryOptions}
                      autoFocus={false}
                    />
                  </Suspense>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80">
              <CardContent className="space-y-5 p-5">
                <div className="space-y-2">
                  <Label htmlFor="chapter-title">Título</Label>
                  <Input
                    id="chapter-title"
                    value={draft.title || ""}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, title: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="chapter-number">Número</Label>
                    <Input
                      id="chapter-number"
                      type="number"
                      value={draft.number}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          number: Number(event.target.value || prev.number),
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
                        setDraft((prev) => ({
                          ...prev,
                          volume:
                            event.target.value.trim() === ""
                              ? undefined
                              : Number(event.target.value),
                        }))
                      }
                      placeholder="Sem volume"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de entrada</Label>
                    <Select
                      value={draft.entryKind === "extra" ? "extra" : "main"}
                      onValueChange={(value) =>
                        setDraft((prev) => ({
                          ...prev,
                          entryKind: value === "extra" ? "extra" : "main",
                          displayLabel:
                            value === "extra" ? prev.displayLabel || "Extra" : undefined,
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
                        setDraft((prev) => ({
                          ...prev,
                          readingOrder:
                            event.target.value.trim() === ""
                              ? undefined
                              : Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                {draft.entryKind === "extra" ? (
                  <div className="space-y-2">
                    <Label htmlFor="chapter-display-label">Rótulo do extra</Label>
                    <Input
                      id="chapter-display-label"
                      value={draft.displayLabel || ""}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, displayLabel: event.target.value }))
                      }
                      placeholder="Ex.: Side Story"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="chapter-entry-subtype">Subtipo</Label>
                  <Input
                    id="chapter-entry-subtype"
                    value={draft.entrySubtype || ""}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, entrySubtype: event.target.value }))
                    }
                    placeholder="Ex.: capítulo, prólogo, epílogo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chapter-synopsis">Sinopse</Label>
                  <Textarea
                    id="chapter-synopsis"
                    value={draft.synopsis || ""}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, synopsis: event.target.value }))
                    }
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chapter-release-date">Data de release</Label>
                  <Input
                    id="chapter-release-date"
                    type="date"
                    value={draft.releaseDate || ""}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, releaseDate: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm">Capa do capítulo</Label>
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
                  {draft.coverImageUrl ? (
                    <img
                      src={draft.coverImageUrl}
                      alt={draft.coverImageAlt || DEFAULT_PROJECT_COVER_ALT}
                      className="h-32 w-24 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-24 items-center justify-center rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                      Sem capa
                    </div>
                  )}
                  <Input
                    value={draft.coverImageUrl || ""}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, coverImageUrl: event.target.value }))
                    }
                    placeholder="URL da capa"
                  />
                  <Input
                    value={draft.coverImageAlt || ""}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, coverImageAlt: event.target.value }))
                    }
                    placeholder="Texto alternativo da capa"
                  />
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm">Publicação</Label>
                      <p className="text-xs text-muted-foreground">
                        Controle se o capítulo fica visível ao público.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Publicado</span>
                      <Switch
                        checked={draft.publicationStatus !== "draft"}
                        onCheckedChange={(checked) =>
                          setDraft((prev) => ({
                            ...prev,
                            publicationStatus: checked ? "published" : "draft",
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm">Fontes de download</Label>
                      <p className="text-xs text-muted-foreground">
                        Opcional para capítulos híbridos com leitura e download.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          sources: [...(prev.sources || []), { label: "", url: "" }],
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
                            setDraft((prev) => {
                              const nextSources = [...(prev.sources || [])];
                              nextSources[sourceIndex] = {
                                ...nextSources[sourceIndex],
                                label: event.target.value,
                              };
                              return { ...prev, sources: nextSources };
                            })
                          }
                          placeholder="Fonte"
                        />
                        <Input
                          value={source.url}
                          onChange={(event) =>
                            setDraft((prev) => {
                              const nextSources = [...(prev.sources || [])];
                              nextSources[sourceIndex] = {
                                ...nextSources[sourceIndex],
                                url: event.target.value,
                              };
                              return { ...prev, sources: nextSources };
                            })
                          }
                          placeholder="URL"
                        />
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                sources: (prev.sources || []).filter(
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

                {identityError ? (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {identityError}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

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
              setDraft((prev) => ({
                ...prev,
                coverImageUrl: nextUrl,
                coverImageAlt: nextUrl
                  ? resolveAssetAltText(items[0]?.altText, getEpisodeCoverAltFallback(true))
                  : "",
              }));
              setIsLibraryOpen(false);
            }}
          />
        </Suspense>
      </>
    );
    */
  },
);

ChapterEditorPane.displayName = "ChapterEditorPane";

const DashboardProjectChapterEditor = () => {
  usePageMeta({ title: "Editor de capítulo", noIndex: true });
  const apiBase = getApiBase();
  const navigate = useNavigate();
  const { projectId, chapterNumber } = useParams<{ projectId: string; chapterNumber: string }>();
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [hasLoadedCurrentUser, setHasLoadedCurrentUser] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [chapterSearchQuery, setChapterSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<ChapterFilterMode>("all");
  const editorPaneRef = useRef<ChapterEditorPaneHandle | null>(null);
  const canManageProjects = useMemo(() => {
    const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
    return permissions.includes("*") || permissions.includes("projetos");
  }, [currentUser]);

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
  const activeChapterLookup = useMemo(
    () => resolveEpisodeLookup(chapters, chapterNumber, resolvedVolume),
    [chapterNumber, chapters, resolvedVolume],
  );
  const activeChapter = activeChapterLookup.ok ? activeChapterLookup.episode : null;
  const activeChapterIndex = activeChapterLookup.ok ? activeChapterLookup.index : -1;
  const activeChapterKey = activeChapter
    ? buildEpisodeKey(activeChapter.number, activeChapter.volume)
    : "";

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
      navigableChapters.findIndex(
        (episode) => buildEpisodeKey(episode.number, episode.volume) === activeChapterKey,
      ),
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
  const activeChapterHref = activeChapter
    ? buildDashboardProjectChapterEditorHref(
        project?.id || "",
        activeChapter.number,
        activeChapter.volume,
      )
    : "";

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

  const handleProjectSaved = useCallback(
    (nextProject: ProjectRecord, nextChapter: ProjectEpisode) => {
      setProject(nextProject);
      const nextHref = buildDashboardProjectChapterEditorHref(
        nextProject.id,
        nextChapter.number,
        nextChapter.volume,
      );
      if (nextHref !== activeChapterHref) {
        navigate(nextHref, { replace: true });
      }
    },
    [activeChapterHref, navigate],
  );

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

  if (!project || !isLightNovel || !activeChapter) {
    if (!project || !isLightNovel || activeChapterLookup.code === "not_found") {
      return <NotFound />;
    }
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
          key={activeChapterKey}
          ref={editorPaneRef}
          project={project}
          chapter={activeChapter}
          chapterCount={chapters.length}
          chapterIndex={Math.max(activeChapterIndex, 0)}
          activeChapterKey={activeChapterKey}
          groupedFilteredChapters={groupedFilteredChapters}
          chapterSearchQuery={chapterSearchQuery}
          onChapterSearchQueryChange={setChapterSearchQuery}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          previousChapterHref={previousChapterHref}
          nextChapterHref={nextChapterHref}
          onNavigateToHref={requestNavigateToHref}
          onProjectSaved={handleProjectSaved}
        />
      </DashboardPageContainer>
    </DashboardShell>
  );

  /*
  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={!hasLoadedCurrentUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <DashboardPageContainer maxWidth="7xl">
        <DashboardPageHeader
          badge="Capítulos"
          title="Editor dedicado de capítulo"
          description="Fluxo otimizado para light novel com navegação contínua entre capítulos."
          actions={
            <Button variant="outline" asChild>
              <Link to={buildDashboardProjectEditorHref(project.id)}>
                <ArrowLeft className="h-4 w-4" />
                <span>Projeto</span>
              </Link>
            </Button>
          }
        />

        <div className="mt-8 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="border-border/60 bg-card/80 xl:sticky xl:top-24 xl:h-[calc(100vh-8rem)]">
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{project.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {chapters.length} capítulo(s) carregados
                  </p>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={chapterSearchQuery}
                    onChange={(event) => setChapterSearchQuery(event.target.value)}
                    placeholder="Buscar capítulo..."
                    className="pl-9"
                  />
                </div>
                <Select
                  value={filterMode}
                  onValueChange={(value) => setFilterMode(value as ChapterFilterMode)}
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

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {groupedFilteredChapters.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{group.label}</Badge>
                      <span className="text-xs text-muted-foreground">{group.items.length}</span>
                    </div>
                    <div className="space-y-2">
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
                            onClick={() => void requestNavigateToHref(href)}
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
                                  episode.publicationStatus === "draft" ? "outline" : "secondary"
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
                                <span>• {episode.sources.length} fonte(s)</span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {groupedFilteredChapters.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                    Nenhum capítulo corresponde ao filtro atual.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <ChapterEditorPane
            key={activeChapterKey}
            ref={editorPaneRef}
            project={project}
            chapter={activeChapter}
            chapterIndex={Math.max(activeChapterIndex, 0)}
            previousChapterHref={previousChapterHref}
            nextChapterHref={nextChapterHref}
            onNavigateToHref={requestNavigateToHref}
            onProjectSaved={handleProjectSaved}
          />
        </div>
      </DashboardPageContainer>
    </DashboardShell>
  );
  */
};

export default DashboardProjectChapterEditor;
