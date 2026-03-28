import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/dashboard/dashboard-form-controls";
import { buildDashboardProjectChapterEditorHref, buildProjectPublicReadingHref } from "@/lib/project-editor-routes";
import { buildEpisodeKey } from "@/lib/project-episode-key";
import {
  buildChapterVolumeLabel,
  chapterHasContent,
  normalizeStructureGroupKeys,
  type ChapterFilterMode,
  type ChapterStructureGroup,
} from "@/lib/dashboard-project-chapter";
import { buildStageChapterLabel } from "@/components/project-reader/MangaWorkflowPanel";
import {
  normalizeProjectEpisodeContentFormat,
  normalizeProjectEpisodePages,
} from "../../../shared/project-reader.js";
import { ChevronRight, FileArchive, Loader2, Plus, Search } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

import ChapterEditorAccordionHeader from "./ChapterEditorAccordionHeader";

type StructureReorderState = {
  key: string;
  direction: "up" | "down";
} | null;

type ChapterEditorStructureSectionProps = {
  projectId: string;
  activeChapterKey: string | null;
  selectedStageChapterId: string | null;
  selectedStructureGroupKey: string;
  activeStructureGroupKey: string;
  structureGroups: ChapterStructureGroup[];
  initialOpenStructureGroupKeys?: string[];
  onStructureGroupKeysChange: (nextKeys: string[]) => void;
  chapterSearchQuery: string;
  onChapterSearchQueryChange: (nextValue: string) => void;
  filterMode: ChapterFilterMode;
  onFilterModeChange: (nextValue: ChapterFilterMode) => void;
  onAddVolume: () => void;
  onAddChapter: (targetVolume: number | null) => void | Promise<void>;
  onSelectPendingStageChapter: (chapterId: string) => void | Promise<void>;
  onStructureVolumeInteraction: (groupKey: string, volume: number) => void | Promise<void>;
  onStructureVolumeExport: (volume: number, groupKey: string) => void | Promise<void>;
  onNavigateToHref: (href: string) => void;
  onReorderStructureChapter: (chapterKey: string, direction: "up" | "down") => void | Promise<void>;
  supportsStructureReordering: boolean;
  structureChapterReorderState: StructureReorderState;
  structureVolumeExportKey: string | null;
};

const groupCardClassName =
  "overflow-hidden rounded-[20px] border bg-background/40 shadow-[0_14px_42px_-34px_rgba(0,0,0,0.74)]";

const buildHasExportablePublishedVolumeChapter = (group: ChapterStructureGroup) =>
  group.volume !== null &&
  group.allItems.some((episode) => {
    const episodePages = normalizeProjectEpisodePages(episode.pages || []);
    const isImageEpisode =
      normalizeProjectEpisodeContentFormat(
        episode.contentFormat,
        episodePages.length > 0 ? "images" : "lexical",
      ) === "images";
    return (
      episode.publicationStatus === "published" &&
      isImageEpisode &&
      (episodePages.length > 0 || episode.hasPages === true)
    );
  });

const ChapterEditorStructureGroupCard = ({
  group,
  isSelected,
  isOpen,
  selectedStageChapterId,
  supportsStructureReordering,
  structureChapterReorderState,
  onStructureVolumeInteraction,
  onToggleGroup,
  onAddChapter,
  onStructureVolumeExport,
  onSelectPendingStageChapter,
  onNavigateToHref,
  onReorderStructureChapter,
  structureVolumeExportKey,
  projectId,
  activeChapterKey,
}: {
  group: ChapterStructureGroup;
  isSelected: boolean;
  isOpen: boolean;
  selectedStageChapterId: string | null;
  supportsStructureReordering: boolean;
  structureChapterReorderState: StructureReorderState;
  onStructureVolumeInteraction: (groupKey: string, volume: number) => void | Promise<void>;
  onToggleGroup: (groupKey: string) => void;
  onAddChapter: (targetVolume: number | null) => void | Promise<void>;
  onStructureVolumeExport: (volume: number, groupKey: string) => void | Promise<void>;
  onSelectPendingStageChapter: (chapterId: string) => void | Promise<void>;
  onNavigateToHref: (href: string) => void;
  onReorderStructureChapter: (chapterKey: string, direction: "up" | "down") => void | Promise<void>;
  structureVolumeExportKey: string | null;
  projectId: string;
  activeChapterKey: string | null;
}) => {
  const pendingCount = group.pendingItems.length;
  const hasVisibleItems = group.visiblePendingItems.length > 0 || group.visibleItems.length > 0;
  const hasExportablePublishedVolumeChapter = buildHasExportablePublishedVolumeChapter(group);
  const isExportingVolume = structureVolumeExportKey === group.key;
  const emptyMessage =
    group.chapterCount > 0 || pendingCount > 0
      ? "Nenhum capitulo corresponde ao filtro atual neste grupo."
      : group.volume !== null
        ? "Nenhum capitulo vinculado a este volume ainda."
        : "Nenhum capitulo sem volume ainda.";

  return (
    <section
      className={`${groupCardClassName} ${isSelected ? "border-primary/45 bg-primary/[0.06]" : "border-border/50"}`}
      data-testid={`chapter-structure-group-${group.key}`}
    >
      <div
        className={`space-y-3 border-b border-border/50 px-4 py-4 ${isSelected ? "bg-primary/[0.04]" : ""}`}
        data-testid={`chapter-structure-group-header-${group.key}`}
      >
        <div className="flex items-start gap-3">
          {group.volume !== null ? (
            <button
              type="button"
              data-testid={`chapter-structure-select-${group.key}`}
              onClick={() => void onStructureVolumeInteraction(group.key, group.volume as number)}
              className="min-w-0 flex-1 self-stretch text-left"
            >
              <div className="min-w-0 space-y-2" data-testid={`chapter-structure-group-main-${group.key}`}>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold tracking-tight text-foreground">{group.label}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {group.chapterCount > 0 || pendingCount > 0
                      ? `${group.chapterCount} salvo(s)${pendingCount > 0 ? ` + ${pendingCount} em importacao` : ""}`
                      : "Nenhum capitulo vinculado"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={group.hasMetadata ? "secondary" : "outline"}>
                    {group.hasMetadata ? "Metadados" : "Sem metadados"}
                  </Badge>
                  {pendingCount > 0 ? <Badge variant="outline">Importacao {pendingCount}</Badge> : null}
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleGroup(group.key)}
              className="min-w-0 flex-1 self-stretch text-left"
              data-testid={`chapter-structure-group-main-${group.key}`}
            >
              <p className="text-sm font-semibold text-foreground">{group.label}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                {group.chapterCount > 0 || pendingCount > 0
                  ? `${group.chapterCount} salvo(s)${pendingCount > 0 ? ` + ${pendingCount} em importacao` : ""}`
                  : "Agrupe aqui capitulos fora de volume"}
              </p>
            </button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            data-testid={`chapter-structure-group-toggle-${group.key}`}
            aria-label={`Alternar ${group.label}`}
            aria-expanded={isOpen}
            onClick={() => onToggleGroup(group.key)}
            className="mt-0.5 shrink-0 self-start"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          </Button>
        </div>
        <div className="flex gap-2" data-testid={`chapter-structure-group-actions-${group.key}`}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid={`chapter-structure-add-chapter-${group.key}`}
            onClick={() => {
              void onAddChapter(group.volume);
            }}
            className="flex-1 justify-center rounded-xl"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar capitulo</span>
          </Button>
          {hasExportablePublishedVolumeChapter && group.volume !== null ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid={`chapter-structure-export-volume-${group.key}`}
              onClick={() => {
                void onStructureVolumeExport(group.volume as number, group.key);
              }}
              disabled={isExportingVolume}
              className="shrink-0 justify-center rounded-xl px-3"
            >
              {isExportingVolume ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
              <span>ZIP</span>
            </Button>
          ) : null}
        </div>
      </div>
      {isOpen ? (
        <div className="space-y-2.5 p-3.5">
          {hasVisibleItems ? (
            <>
              {group.visiblePendingItems.map((chapter) => {
                const isActivePending = chapter.id === selectedStageChapterId;
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    data-testid={`chapter-structure-stage-select-${chapter.id}`}
                    onClick={() => {
                      void onSelectPendingStageChapter(chapter.id);
                    }}
                    className={`w-full rounded-[18px] border px-3.5 py-3 text-left transition ${
                      isActivePending
                        ? "border-primary/50 bg-primary/[0.07] shadow-sm"
                        : "border-border/50 bg-background/55 hover:bg-background/78"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          {chapter.operation === "update" ? "Atualizar" : "Importar"}
                        </p>
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">
                          {buildStageChapterLabel(chapter)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Importacao</Badge>
                        <Badge
                          variant={chapter.publicationStatus === "draft" ? "outline" : "secondary"}
                        >
                          {chapter.publicationStatus === "draft" ? "Rascunho" : "Publicado"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {chapter.pages.length > 0 ? `${chapter.pages.length} pagina(s)` : "Sem paginas"}
                      </span>
                      {chapter.warnings.length > 0 ? <span>- {chapter.warnings.length} aviso(s)</span> : null}
                    </div>
                  </button>
                );
              })}
              {group.visibleItems.map((episode) => {
                const episodeKey = buildEpisodeKey(episode.number, episode.volume);
                const href = buildDashboardProjectChapterEditorHref(
                  projectId,
                  episode.number,
                  episode.volume,
                );
                const readingHref = buildProjectPublicReadingHref(
                  projectId,
                  episode.number,
                  episode.volume,
                );
                const isActive = episodeKey === activeChapterKey;
                const episodePages = normalizeProjectEpisodePages(episode.pages || []);
                const isImageEpisode =
                  normalizeProjectEpisodeContentFormat(
                    episode.contentFormat,
                    episodePages.length > 0 ? "images" : "lexical",
                  ) === "images";
                const groupEpisodeKeys = group.allItems.map((item) => buildEpisodeKey(item.number, item.volume));
                const structurePosition = groupEpisodeKeys.indexOf(episodeKey);
                const canMoveUp = supportsStructureReordering && structurePosition > 0;
                const canMoveDown =
                  supportsStructureReordering &&
                  structurePosition >= 0 &&
                  structurePosition < groupEpisodeKeys.length - 1;
                const hasReadableChapter =
                  chapterHasContent(episode) ||
                  (isImageEpisode && (episodePages.length > 0 || episode.hasPages === true));
                const canOpenReadingPage =
                  episode.publicationStatus === "published" && hasReadableChapter;
                const isReorderingEpisodeUp =
                  structureChapterReorderState?.key === episodeKey &&
                  structureChapterReorderState.direction === "up";
                const isReorderingEpisodeDown =
                  structureChapterReorderState?.key === episodeKey &&
                  structureChapterReorderState.direction === "down";
                const showStructureActions = supportsStructureReordering || canOpenReadingPage;
                const handleOpenEpisode = () => void onNavigateToHref(href);
                const handleOpenReadingPage = () => {
                  if (typeof window === "undefined" || !canOpenReadingPage) {
                    return;
                  }
                  window.open(readingHref, "_blank", "noopener,noreferrer");
                };
                const handleEpisodeCardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
                  if (event.target !== event.currentTarget) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenEpisode();
                  }
                };
                return (
                  <div
                    key={episodeKey}
                    data-testid={`chapter-structure-episode-open-${episodeKey}`}
                    data-state={isActive ? "active" : "idle"}
                    role="button"
                    tabIndex={0}
                    aria-label={`Abrir capitulo ${episode.number}`}
                    onClick={handleOpenEpisode}
                    onKeyDown={handleEpisodeCardKeyDown}
                    className={`w-full cursor-pointer rounded-[18px] border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${
                      isActive
                        ? "border-primary/50 bg-primary/[0.07] shadow-sm"
                        : "border-border/50 bg-background/55 hover:bg-background/78"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="space-y-3" data-testid={`chapter-structure-episode-content-${episodeKey}`}>
                        <div
                          className="flex items-start justify-between gap-3"
                          data-testid={`chapter-structure-episode-header-${episodeKey}`}
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              Capitulo {episode.number}
                            </p>
                            <p className="line-clamp-2 text-sm font-semibold text-foreground">
                              {String(episode.title || "").trim() || "Sem titulo"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={episode.publicationStatus === "draft" ? "outline" : "secondary"}>
                              {episode.publicationStatus === "draft" ? "Rascunho" : "Publicado"}
                            </Badge>
                            {episode.entryKind === "extra" ? <Badge variant="outline">Extra</Badge> : null}
                          </div>
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                          data-testid={`chapter-structure-episode-meta-${episodeKey}`}
                        >
                          <span>{buildChapterVolumeLabel(episode.volume)}</span>
                          {episodePages.length > 0 ? <span>{episodePages.length} pagina(s)</span> : null}
                          {String(episode.synopsis || "").trim() ? <span>Resumo disponivel</span> : null}
                        </div>
                      </div>
                      {showStructureActions ? (
                        <div
                          className="flex flex-wrap items-center gap-2"
                          data-testid={`chapter-structure-episode-actions-${episodeKey}`}
                        >
                          {supportsStructureReordering ? (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label="Mover para cima"
                                data-testid={`chapter-structure-episode-move-up-${episodeKey}`}
                                disabled={!canMoveUp || Boolean(structureChapterReorderState)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onReorderStructureChapter(episodeKey, "up");
                                }}
                                className="h-8 w-8 rounded-full"
                              >
                                {isReorderingEpisodeUp ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <span className="text-base leading-none">↑</span>
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label="Mover para baixo"
                                data-testid={`chapter-structure-episode-move-down-${episodeKey}`}
                                disabled={!canMoveDown || Boolean(structureChapterReorderState)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onReorderStructureChapter(episodeKey, "down");
                                }}
                                className="h-8 w-8 rounded-full"
                              >
                                {isReorderingEpisodeDown ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <span className="text-base leading-none">↓</span>
                                )}
                              </Button>
                            </div>
                          ) : null}
                          {canOpenReadingPage ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              data-testid={`chapter-structure-episode-read-${episodeKey}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenReadingPage();
                              }}
                              className="rounded-full"
                            >
                              Ler
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="rounded-[18px] border border-dashed border-border/60 bg-background/55 px-4 py-4 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};

export const ChapterEditorStructureSection = ({
  projectId,
  activeChapterKey,
  selectedStageChapterId,
  selectedStructureGroupKey,
  activeStructureGroupKey,
  structureGroups,
  initialOpenStructureGroupKeys,
  onStructureGroupKeysChange,
  chapterSearchQuery,
  onChapterSearchQueryChange,
  filterMode,
  onFilterModeChange,
  onAddVolume,
  onAddChapter,
  onSelectPendingStageChapter,
  onStructureVolumeInteraction,
  onStructureVolumeExport,
  onNavigateToHref,
  onReorderStructureChapter,
  supportsStructureReordering,
  structureChapterReorderState,
  structureVolumeExportKey,
}: ChapterEditorStructureSectionProps) => {
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
        activeStructureGroupKey && structureGroups.some((group) => group.key === activeStructureGroupKey)
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

  const toggleStructureGroup = (groupKey: string) => {
    setOpenStructureGroupKeys((currentKeys) => {
      const normalizedCurrentKeys = normalizeStructureGroupKeys(currentKeys, structureGroups);
      return normalizedCurrentKeys.includes(groupKey)
        ? normalizedCurrentKeys.filter((key) => key !== groupKey)
        : [...normalizedCurrentKeys, groupKey];
    });
  };

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="structure"
      className="project-editor-accordion space-y-2.5"
    >
      <AccordionItem
        value="structure"
        className="rounded-[22px] border border-border/50 bg-card/70 shadow-[0_14px_42px_-34px_rgba(0,0,0,0.74)]"
        data-testid="chapter-structure-section"
      >
        <AccordionTrigger className="flex items-center justify-between gap-3 px-4 py-4 text-left">
          <ChapterEditorAccordionHeader
            title="Estrutura"
            subtitle="Volumes, filtros, navegacao e criacao de capitulos"
          />
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            <div className="space-y-3 rounded-[20px] border border-border/50 bg-background/45 p-3.5">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px] 2xl:grid-cols-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={chapterSearchQuery}
                    onChange={(event) => onChapterSearchQueryChange(event.target.value)}
                    placeholder="Buscar capitulo..."
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
                    <SelectItem value="with-content">Com conteudo</SelectItem>
                    <SelectItem value="without-content">Sem conteudo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3" data-testid="chapter-structure-intro-row">
                <p className="text-xs leading-5 text-muted-foreground" data-testid="chapter-structure-intro-copy">
                  Selecione volumes, navegue por capitulos e organize a estrutura editorial do projeto.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onAddVolume}
                  className="w-full justify-center"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar volume</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2.5">
              {structureGroups.map((group) => {
                const isSelected = group.key === selectedStructureGroupKey;
                const isOpen = openStructureGroupKeys.includes(group.key);
                return (
                  <ChapterEditorStructureGroupCard
                    key={group.key}
                    group={group}
                    isSelected={isSelected}
                    isOpen={isOpen}
                    selectedStageChapterId={selectedStageChapterId}
                    supportsStructureReordering={supportsStructureReordering}
                    structureChapterReorderState={structureChapterReorderState}
                    onStructureVolumeInteraction={onStructureVolumeInteraction}
                    onToggleGroup={toggleStructureGroup}
                    onAddChapter={onAddChapter}
                    onStructureVolumeExport={onStructureVolumeExport}
                    onSelectPendingStageChapter={onSelectPendingStageChapter}
                    onNavigateToHref={onNavigateToHref}
                    onReorderStructureChapter={onReorderStructureChapter}
                    structureVolumeExportKey={structureVolumeExportKey}
                    projectId={projectId}
                    activeChapterKey={activeChapterKey}
                  />
                );
              })}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ChapterEditorStructureSection;
