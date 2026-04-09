import {
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";

import { Input } from "@/components/public-form-controls";
import {
  publicPageLayoutTokens,
  publicStrongSurfaceHoverClassName,
} from "@/components/public-page-tokens";
import UploadPicture from "@/components/UploadPicture";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CompactPagination from "@/components/ui/compact-pagination";
import {
  dropdownChevronClassName,
  dropdownItemClassName,
  dropdownItemIndicatorClassName,
  dropdownPopoverClassName,
  dropdownTriggerClassName,
} from "@/components/ui/dropdown-contract";
import type { Project } from "@/data/projects";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  prepareProjectBadges,
  PROJECT_COVER_ASPECT_RATIO,
  type ProjectBadgeItem,
} from "@/lib/project-card-layout";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import { comparePtBr, normalizeSearchText } from "@/lib/search-ranking";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import { cn } from "@/lib/utils";
import "@/styles/projects-public.css";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
} from "../../shared/institutional-og-seo.js";

const alphabetOptions = ["Todas", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
const PROJECTS_LIST_STATE_STORAGE_KEY = "public.projects.list-state.v1";
const MAX_QUERY_LENGTH = 80;
const SEARCH_QUERY_DEBOUNCE_MS = 60;
const PROJECTS_LIST_IMAGE_SIZES = "(max-width: 767px) 129px, 154px";
const PRIORITY_PROJECT_IMAGE_COUNT = 1;
const MOBILE_FILTERS_PANEL_ID = "projects-mobile-filters-panel";
const FILTER_COMBOBOX_INITIAL_LIMIT = 24;
const FILTER_COMBOBOX_STEP = 24;
const PROJECT_CARD_SYNOPSIS_CLASS = "projects-public-synopsis";

const parseLetterParam = (value: string | null) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return /^[A-Z]$/.test(normalized) ? normalized : "Todas";
};

const parseTypeParam = (value: string | null) => {
  const normalized = String(value || "").trim();
  return normalized || "Todos";
};

const parseProjectsPageParam = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
};

type FilterOption = {
  value: string;
  label: string;
  searchText: string;
};

type IndexedPublicProject = {
  project: Project;
  firstLetter: string;
  normalizedHaystack: string;
  tagSet: Set<string>;
  genreSet: Set<string>;
  type: string;
};

type IndexedPublicProjectsPayload = {
  items: IndexedPublicProject[];
  tagOptions: FilterOption[];
  genreOptions: FilterOption[];
  typeOptions: string[];
};

type ProjectCardProps = {
  project: Project;
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  navigate: ReturnType<typeof useNavigate>;
  mediaVariants: UploadMediaVariantsMap;
  isPriorityImage: boolean;
  isMobile: boolean;
  synopsisClampClass: string;
};

type ProjectPrimaryBadgeProps = {
  item: ProjectBadgeItem;
  navigate?: ReturnType<typeof useNavigate>;
};

type ProjectsFilterFieldProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

type ProjectsResultsSummaryProps = {
  filteredProjectsCount: number;
  onResetFilters: () => void;
  className?: string;
};

type ProjectsSearchableFilterProps = {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  options: FilterOption[];
  placeholder: string;
  searchEnabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  initialVisibleCount?: number;
  visibleCountStep?: number;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onValueChange: (nextValue: string) => void;
};

type ProjectsFiltersPanelProps = {
  isMobile: boolean;
  isMobileFiltersOpen: boolean;
  onToggleMobileFilters: () => void;
  searchInputValue: string;
  onSearchInputChange: (nextValue: string) => void;
  letterOptions: FilterOption[];
  selectedLetter: string;
  selectedTag: string;
  selectedGenre: string;
  selectedType: string;
  tagOptions: FilterOption[];
  genreOptions: FilterOption[];
  typeOptions: FilterOption[];
  filteredProjectsCount: number;
  activeFiltersSummary: string;
  openFilterId: string | null;
  onOpenFilterChange: (nextValue: string | null) => void;
  onLetterChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onGenreChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onResetFilters: () => void;
};

type ProjectsGridProps = {
  projects: Project[];
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  navigate: ReturnType<typeof useNavigate>;
  mediaVariants: UploadMediaVariantsMap;
  isMobile: boolean;
  rootRef: RefObject<HTMLDivElement | null>;
  getSynopsisClampClass: (projectId: string) => string;
};

const EMPTY_FILTER_OPTIONS: FilterOption[] = [];

const buildFilterOption = (value: string, label: string): FilterOption => ({
  value,
  label,
  searchText: normalizeSearchText(`${label} ${value}`),
});

const ALPHABET_FILTER_OPTIONS = alphabetOptions.map((letter) =>
  buildFilterOption(letter, letter === "Todas" ? "Todas as letras" : letter),
);

const buildIndexedPublicProjects = ({
  projects,
  tagTranslations,
  genreTranslations,
}: {
  projects: Project[];
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
}): IndexedPublicProjectsPayload => {
  const tagEntries = new Map<string, string>();
  const genreEntries = new Map<string, string>();
  const typeEntries = new Set<string>();

  const items = [...projects]
    .map((project) => {
      const tags = Array.isArray(project.tags)
        ? project.tags.filter(Boolean)
        : [];
      const genres = Array.isArray(project.genres)
        ? project.genres.filter(Boolean)
        : [];
      const translatedTags = tags.map((tag) => {
        const translated = String(tagTranslations[tag] || tag).trim();
        tagEntries.set(tag, translated || tag);
        return translated || tag;
      });
      const translatedGenres = genres.map((genre) => {
        const translated = String(genreTranslations[genre] || genre).trim();
        genreEntries.set(genre, translated || genre);
        return translated || genre;
      });
      const type = String(project.type || "").trim();
      if (type) {
        typeEntries.add(type);
      }
      return {
        project,
        firstLetter: String(project.title || "")
          .trim()
          .charAt(0)
          .toUpperCase(),
        normalizedHaystack: normalizeSearchText(
          [
            project.title,
            project.titleOriginal,
            project.titleEnglish,
            project.synopsis,
            project.description,
            project.type,
            project.status,
            project.studio,
            ...(Array.isArray(project.animationStudios)
              ? project.animationStudios
              : []),
            ...(Array.isArray(project.producers) ? project.producers : []),
            ...tags,
            ...genres,
            ...translatedTags,
            ...translatedGenres,
          ]
            .filter(Boolean)
            .join(" "),
        ),
        tagSet: new Set(tags),
        genreSet: new Set(genres),
        type,
      } satisfies IndexedPublicProject;
    })
    .sort((left, right) =>
      comparePtBr(left.project.title, right.project.title),
    );

  return {
    items,
    tagOptions: [
      buildFilterOption("Todas", "Todas as tags"),
      ...Array.from(tagEntries.entries())
        .sort((left, right) => comparePtBr(left[1], right[1]))
        .map(([value, label]) => buildFilterOption(value, label)),
    ],
    genreOptions: [
      buildFilterOption("Todos", "Todos os gêneros"),
      ...Array.from(genreEntries.entries())
        .sort((left, right) => comparePtBr(left[1], right[1]))
        .map(([value, label]) => buildFilterOption(value, label)),
    ],
    typeOptions: ["Todos", ...Array.from(typeEntries).sort(comparePtBr)],
  };
};

const getProjectBadgeAriaLabel = (item: ProjectBadgeItem) => {
  if (item.key.startsWith("tag-")) {
    return `Filtrar por tag ${item.label}`;
  }
  if (item.key.startsWith("genre-")) {
    return `Filtrar por gênero ${item.label}`;
  }
  return item.label;
};

const ProjectPrimaryBadge = ({ item, navigate }: ProjectPrimaryBadgeProps) => {
  const badge = (
    <Badge
      variant={item.variant}
      className="inline-flex h-6 shrink-0 whitespace-nowrap px-2 text-[9px] uppercase leading-none"
      title={item.label}
    >
      {item.label}
    </Badge>
  );

  if (!item.href) {
    return badge;
  }

  return (
    <button
      type="button"
      className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-md p-0.5"
      title={item.label}
      aria-label={getProjectBadgeAriaLabel(item)}
      onClick={
        navigate
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              navigate(item.href!);
            }
          : undefined
      }
    >
      {badge}
    </button>
  );
};

const ProjectsFilterField = ({
  label,
  className,
  children,
}: ProjectsFilterFieldProps) => (
  <div className={cn("flex flex-col gap-2", className)}>
    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    {children}
  </div>
);

const ProjectsResultsSummary = ({
  filteredProjectsCount,
  onResetFilters,
  className,
}: ProjectsResultsSummaryProps) => (
  <div
    className={cn(
      "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/40 px-4 py-3 text-sm text-muted-foreground",
      className,
    )}
  >
    <div className="flex flex-wrap gap-2">
      <span className="font-semibold text-foreground">
        {filteredProjectsCount}
      </span>
      <span>projetos encontrados</span>
      <span className="text-muted-foreground">&bull;</span>
      <span>Atualizado semanalmente</span>
    </div>
    <Button
      variant="ghost"
      onClick={onResetFilters}
      className="w-full text-xs uppercase sm:w-auto"
    >
      Limpar filtros
    </Button>
  </div>
);

const ProjectsSearchableFilter = memo(
  ({
    id,
    label,
    ariaLabel,
    value,
    options,
    placeholder,
    searchEnabled = true,
    searchPlaceholder,
    emptyMessage,
    initialVisibleCount = FILTER_COMBOBOX_INITIAL_LIMIT,
    visibleCountStep = FILTER_COMBOBOX_STEP,
    isOpen,
    onOpenChange,
    onValueChange,
  }: ProjectsSearchableFilterProps) => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [query, setQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
    const selectedOption = useMemo(
      () => options.find((option) => option.value === value) || null,
      [options, value],
    );
    const filteredOptions = useMemo(() => {
      if (!searchEnabled) {
        return options;
      }
      const normalizedQuery = normalizeSearchText(query);
      if (!normalizedQuery) {
        return options;
      }
      return options.filter((option) =>
        option.searchText.includes(normalizedQuery),
      );
    }, [options, query, searchEnabled]);
    const visibleOptions = searchEnabled
      ? filteredOptions.slice(0, visibleCount)
      : filteredOptions;

    useEffect(() => {
      if (!isOpen) {
        setQuery("");
        setVisibleCount(initialVisibleCount);
        return;
      }

      const handlePointerDown = (event: MouseEvent) => {
        if (rootRef.current?.contains(event.target as Node)) {
          return;
        }
        onOpenChange(false);
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onOpenChange(false);
        }
      };

      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
      if (searchEnabled && typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [initialVisibleCount, isOpen, onOpenChange, searchEnabled]);

    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-controls={`${id}-listbox`}
          aria-haspopup="listbox"
          data-placeholder={selectedOption ? undefined : ""}
          data-state={isOpen ? "open" : "closed"}
          className={dropdownTriggerClassName}
          onClick={() => onOpenChange(!isOpen)}
          onKeyDown={(event) => {
            if (
              event.key === "ArrowDown" ||
              event.key === "Enter" ||
              event.key === " " ||
              event.key === "Spacebar"
            ) {
              event.preventDefault();
              onOpenChange(true);
            }
            if (event.key === "Escape") {
              onOpenChange(false);
            }
          }}
        >
          <span className="truncate">
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={dropdownChevronClassName}
            aria-hidden="true"
          />
        </button>
        {isOpen ? (
          <div
            data-state="open"
            className={cn(
              dropdownPopoverClassName,
              "absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 p-3",
            )}
          >
            {searchEnabled ? (
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`Buscar em ${label.toLowerCase()}`}
                className="bg-background/80"
              />
            ) : null}
            <div
              id={`${id}-listbox`}
              role="listbox"
              aria-label={label}
              className={cn(
                "no-scrollbar max-h-64 overflow-y-auto overscroll-contain p-1",
                searchEnabled ? "mt-3" : "mt-0",
              )}
            >
              {visibleOptions.length > 0 ? (
                visibleOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-state={isSelected ? "checked" : "unchecked"}
                      className={dropdownItemClassName}
                      onClick={() => {
                        onValueChange(option.value);
                        onOpenChange(false);
                      }}
                    >
                      <span className={dropdownItemIndicatorClassName}>
                        {isSelected ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-xl bg-background/50 px-3 py-4 text-sm text-muted-foreground">
                  {emptyMessage}
                </p>
              )}
            </div>
            {searchEnabled && visibleCount < filteredOptions.length ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-3 w-full text-xs uppercase"
                onClick={() =>
                  setVisibleCount((current) => current + visibleCountStep)
                }
              >
                Mostrar mais
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);

ProjectsSearchableFilter.displayName = "ProjectsSearchableFilter";

const ProjectCard = memo(
  ({
    project,
    tagTranslations,
    genreTranslations,
    navigate,
    mediaVariants,
    isPriorityImage,
    isMobile,
    synopsisClampClass,
  }: ProjectCardProps) => {
    const { visibleItems, extraCount, showOverflowBadge } = useMemo(
      () =>
        isMobile
          ? {
              visibleItems: [] as ProjectBadgeItem[],
              extraCount: 0,
              showOverflowBadge: false,
            }
          : prepareProjectBadges({
              tags: project.tags,
              genres: project.genres || [],
              producers: project.producers || [],
              tagTranslations,
              genreTranslations,
              maxVisible: 2,
              maxChars: 18,
            }),
      [
        genreTranslations,
        isMobile,
        project.genres,
        project.producers,
        project.tags,
        tagTranslations,
      ],
    );

    return (
      <div className="projects-public-card-shell group relative h-50 w-full overflow-visible rounded-2xl md:h-60">
        <div
          aria-hidden="true"
          className="projects-public-card-shadow projects-public-card-shadow--base rounded-[inherit]"
        />
        <div
          aria-hidden="true"
          className="projects-public-card-shadow projects-public-card-shadow--hover rounded-[inherit]"
        />
        <Link
          to={`/projeto/${project.id}`}
          className={`projects-public-card relative z-10 flex h-full w-full items-stretch overflow-hidden rounded-2xl border border-border/60 bg-gradient-card transition-[border-color,background-color,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${publicStrongSurfaceHoverClassName} focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/45`}
        >
          <div
            className="h-full shrink-0 overflow-hidden bg-secondary"
            style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }}
          >
            <UploadPicture
              src={project.cover}
              alt={project.title}
              preset="posterThumb"
              mediaVariants={mediaVariants}
              className="block h-full w-full"
              imgClassName="interactive-media-transition h-full w-full object-cover object-center group-hover:scale-105 group-focus-within:scale-105"
              sizes={PROJECTS_LIST_IMAGE_SIZES}
              loading={isPriorityImage ? "eager" : "lazy"}
              fetchPriority={isPriorityImage ? "high" : undefined}
            />
          </div>
          <div
            data-synopsis-role="column"
            data-synopsis-key={project.id}
            className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5"
          >
            <div data-synopsis-role="title" className="shrink-0">
              <p className="interactive-content-transition text-xs uppercase tracking-[0.2em] text-primary/80 group-hover:text-primary group-focus-within:text-primary">
                {project.type}
              </p>
              <h2 className="interactive-content-transition line-clamp-2 text-xl font-semibold leading-snug text-foreground group-hover:text-primary group-focus-within:text-primary md:text-2xl">
                {project.title}
              </h2>
            </div>

            <p
              data-synopsis-role="synopsis"
              className={cn(
                "interactive-content-transition mt-2 overflow-hidden text-sm leading-snug text-muted-foreground break-normal hyphens-none group-hover:text-foreground/80 group-focus-within:text-foreground/80",
                PROJECT_CARD_SYNOPSIS_CLASS,
                synopsisClampClass,
              )}
            >
              {project.synopsis}
            </p>

            <div
              data-synopsis-role="badges"
              className="mt-auto flex shrink-0 flex-col gap-2 pt-3"
            >
              {!isMobile && (visibleItems.length > 0 || extraCount > 0) ? (
                <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
                  {visibleItems.map((item) => (
                    <ProjectPrimaryBadge
                      key={item.key}
                      item={item}
                      navigate={navigate}
                    />
                  ))}
                  {showOverflowBadge ? (
                    <Badge
                      variant="secondary"
                      className="inline-flex h-6 w-9 shrink-0 justify-center whitespace-nowrap px-2 text-[9px] uppercase leading-none"
                      title={`+${extraCount} tags`}
                    >
                      +{extraCount}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {project.status ? (
                  <span className="shrink-0 rounded-full bg-background/50 px-3 py-1 truncate">
                    {project.status}
                  </span>
                ) : null}
                {project.studio ? (
                  <span
                    className="hidden shrink-0 max-w-36 rounded-full bg-background/50 px-3 py-1 truncate lg:inline-flex lg:max-w-48"
                    title={project.studio}
                  >
                    {project.studio}
                  </span>
                ) : null}
                {project.episodes ? (
                  <span className="hidden shrink-0 rounded-full bg-background/50 px-3 py-1 truncate xl:inline-flex">
                    {project.episodes}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  },
);

ProjectCard.displayName = "ProjectCard";

const ProjectsFiltersPanel = memo(
  ({
    isMobile,
    isMobileFiltersOpen,
    onToggleMobileFilters,
    searchInputValue,
    onSearchInputChange,
    letterOptions,
    selectedLetter,
    selectedTag,
    selectedGenre,
    selectedType,
    tagOptions,
    genreOptions,
    typeOptions,
    filteredProjectsCount,
    activeFiltersSummary,
    openFilterId,
    onOpenFilterChange,
    onLetterChange,
    onTagChange,
    onGenreChange,
    onTypeChange,
    onResetFilters,
  }: ProjectsFiltersPanelProps) => {
    const filterControls = (
      <>
        <ProjectsFilterField label="A-Z">
          <ProjectsSearchableFilter
            id={isMobile ? "projects-letter-mobile" : "projects-letter-desktop"}
            label="A-Z"
            ariaLabel="Filtrar por letra"
            value={selectedLetter}
            options={letterOptions}
            placeholder="Todas as letras"
            searchEnabled={false}
            isOpen={openFilterId === "letter"}
            onOpenChange={(nextOpen) =>
              onOpenFilterChange(nextOpen ? "letter" : null)
            }
            onValueChange={onLetterChange}
          />
        </ProjectsFilterField>

        <ProjectsFilterField label="Tags">
          <ProjectsSearchableFilter
            id={isMobile ? "projects-tag-mobile" : "projects-tag-desktop"}
            label="Tags"
            ariaLabel="Filtrar por tag"
            value={selectedTag}
            options={tagOptions}
            placeholder="Todas as tags"
            searchPlaceholder="Buscar tag"
            emptyMessage="Nenhuma tag encontrada."
            isOpen={openFilterId === "tag"}
            onOpenChange={(nextOpen) =>
              onOpenFilterChange(nextOpen ? "tag" : null)
            }
            onValueChange={onTagChange}
          />
        </ProjectsFilterField>

        <ProjectsFilterField label="Gêneros">
          <ProjectsSearchableFilter
            id={isMobile ? "projects-genre-mobile" : "projects-genre-desktop"}
            label="Gêneros"
            ariaLabel="Filtrar por gênero"
            value={selectedGenre}
            options={genreOptions}
            placeholder="Todos os gêneros"
            searchPlaceholder="Buscar gênero"
            emptyMessage="Nenhum gênero encontrado."
            isOpen={openFilterId === "genre"}
            onOpenChange={(nextOpen) =>
              onOpenFilterChange(nextOpen ? "genre" : null)
            }
            onValueChange={onGenreChange}
          />
        </ProjectsFilterField>

        <ProjectsFilterField label="Formato">
          <ProjectsSearchableFilter
            id={isMobile ? "projects-type-mobile" : "projects-type-desktop"}
            label="Formato"
            ariaLabel="Filtrar por formato"
            value={selectedType}
            options={typeOptions}
            placeholder="Todos os formatos"
            searchEnabled={false}
            isOpen={openFilterId === "type"}
            onOpenChange={(nextOpen) =>
              onOpenFilterChange(nextOpen ? "type" : null)
            }
            onValueChange={onTypeChange}
          />
        </ProjectsFilterField>
      </>
    );

    return (
      <div className="grid gap-3 rounded-2xl bg-card/70 p-4 shadow-lg md:grid-cols-4 md:gap-4 md:p-6">
        <div className="md:col-span-4 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Busca
          </span>
          <Input
            value={searchInputValue}
            onChange={(event) =>
              onSearchInputChange(event.target.value.slice(0, MAX_QUERY_LENGTH))
            }
            placeholder="Buscar por título, sinopse, tag ou gênero"
            className="bg-background/60"
            aria-label="Buscar projetos"
          />
        </div>

        {isMobile ? (
          <div className="md:col-span-4">
            <div className="rounded-xl bg-background/40 px-4 py-3 shadow-sm">
              <button
                type="button"
                aria-expanded={isMobileFiltersOpen}
                aria-controls={MOBILE_FILTERS_PANEL_ID}
                className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
                onClick={onToggleMobileFilters}
              >
                <div className="min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Filtros
                  </span>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {filteredProjectsCount}
                    </span>
                    <span>projetos encontrados</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {activeFiltersSummary}
                </span>
              </button>
              {isMobileFiltersOpen ? (
                <div id={MOBILE_FILTERS_PANEL_ID} className="space-y-4 pt-4">
                  <div className="grid gap-3">{filterControls}</div>
                  <ProjectsResultsSummary
                    filteredProjectsCount={filteredProjectsCount}
                    onResetFilters={onResetFilters}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {filterControls}
            <ProjectsResultsSummary
              filteredProjectsCount={filteredProjectsCount}
              onResetFilters={onResetFilters}
              className="md:col-span-4"
            />
          </>
        )}
      </div>
    );
  },
);

ProjectsFiltersPanel.displayName = "ProjectsFiltersPanel";

const ProjectsGrid = memo(
  ({
    projects,
    tagTranslations,
    genreTranslations,
    navigate,
    mediaVariants,
    isMobile,
    rootRef,
    getSynopsisClampClass,
  }: ProjectsGridProps) => (
    <div
      ref={rootRef}
      className="mt-10 grid gap-6 md:grid-cols-2 md:auto-rows-fr"
    >
      {projects.map((project, index) => {
        const isLastSingle =
          projects.length % 2 === 1 && index === projects.length - 1;
        return (
          <div
            key={project.id}
            className={
              isLastSingle ? "md:col-span-2 flex justify-center" : undefined
            }
          >
            {isLastSingle ? (
              <div className="w-full md:w-[calc(50%-0.75rem)]">
                <ProjectCard
                  project={project}
                  tagTranslations={tagTranslations}
                  genreTranslations={genreTranslations}
                  navigate={navigate}
                  mediaVariants={mediaVariants}
                  isPriorityImage={index < PRIORITY_PROJECT_IMAGE_COUNT}
                  isMobile={isMobile}
                  synopsisClampClass={getSynopsisClampClass(project.id)}
                />
              </div>
            ) : (
              <ProjectCard
                project={project}
                tagTranslations={tagTranslations}
                genreTranslations={genreTranslations}
                navigate={navigate}
                mediaVariants={mediaVariants}
                isPriorityImage={index < PRIORITY_PROJECT_IMAGE_COUNT}
                isMobile={isMobile}
                synopsisClampClass={getSynopsisClampClass(project.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  ),
);

ProjectsGrid.displayName = "ProjectsGrid";

const Projects = () => {
  const apiBase = getApiBase();
  const isMobile = useIsMobile();
  const bootstrap = readWindowPublicBootstrap();
  const hasFullBootstrap = Boolean(
    bootstrap && bootstrap.payloadMode !== "critical-home",
  );
  const bootstrapProjects = hasFullBootstrap
    ? ((bootstrap?.projects || []) as Project[])
    : [];
  const bootstrapTagTranslations = hasFullBootstrap
    ? bootstrap?.tagTranslations
    : null;
  const bootstrapMediaVariants = hasFullBootstrap
    ? bootstrap?.mediaVariants || {}
    : {};
  const [projects, setProjects] = useState<Project[]>(() => bootstrapProjects);
  const [isLoadingProjects, setIsLoadingProjects] = useState(
    () => !hasFullBootstrap,
  );
  const [hasProjectsLoadError, setHasProjectsLoadError] = useState(false);
  const [projectsLoadVersion, setProjectsLoadVersion] = useState(0);
  const [projectsMediaVariants, setProjectsMediaVariants] =
    useState<UploadMediaVariantsMap>(() => bootstrapMediaVariants);
  const [tagTranslations, setTagTranslations] = useState<
    Record<string, string>
  >(() => bootstrapTagTranslations?.tags || {});
  const [genreTranslations, setGenreTranslations] = useState<
    Record<string, string>
  >(() => bootstrapTagTranslations?.genres || {});
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsRef = useRef(searchParams);
  const [searchInputValue, setSearchInputValue] = useState(
    () => searchParams.get("q") || "",
  );
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);
  const navigate = useNavigate();
  const pageMediaVariants = bootstrap?.mediaVariants || {};
  const projectsPerPage = 16;

  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  const selectedLetter = parseLetterParam(searchParams.get("letter"));
  const selectedType = parseTypeParam(searchParams.get("type"));
  const selectedTag = searchParams.get("tag") || "Todas";
  const selectedGenre =
    searchParams.get("genero") || searchParams.get("genre") || "Todos";
  const selectedQuery = searchParams.get("q") || "";
  const currentPage = parseProjectsPageParam(searchParams.get("page"));

  usePageMeta({
    title: "Projetos",
    image: buildVersionedInstitutionalOgImagePath({
      pageKey: "projects",
      revision: buildInstitutionalOgRevision({
        pageKey: "projects",
        pages: bootstrap?.pages,
        settings: bootstrap?.settings,
      }),
    }),
    imageAlt: buildInstitutionalOgImageAlt("projects"),
    mediaVariants: pageMediaVariants,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.removeItem(PROJECTS_LIST_STATE_STORAGE_KEY);
    } catch {
      // Ignore localStorage cleanup failures.
    }
  }, []);

  useEffect(() => {
    if (hasFullBootstrap && projectsLoadVersion === 0) {
      return;
    }
    let isActive = true;

    const load = async () => {
      if (isActive) {
        setIsLoadingProjects(true);
        setHasProjectsLoadError(false);
      }
      try {
        const response = await apiFetch(apiBase, "/api/public/projects");
        if (!response.ok) {
          if (isActive) {
            setProjects([]);
            setProjectsMediaVariants({});
            setHasProjectsLoadError(true);
          }
          return;
        }
        const data = await response.json();
        if (!isActive) {
          return;
        }
        setProjects(Array.isArray(data.projects) ? data.projects : []);
        setProjectsMediaVariants(
          data?.mediaVariants && typeof data.mediaVariants === "object"
            ? data.mediaVariants
            : {},
        );
        setHasProjectsLoadError(false);
      } catch {
        if (isActive) {
          setProjects([]);
          setProjectsMediaVariants({});
          setHasProjectsLoadError(true);
        }
      } finally {
        if (isActive) {
          setIsLoadingProjects(false);
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, hasFullBootstrap, projectsLoadVersion]);

  useEffect(() => {
    if (hasFullBootstrap && projectsLoadVersion === 0) {
      return;
    }
    let isActive = true;

    const loadTranslations = async () => {
      try {
        const response = await apiFetch(
          apiBase,
          "/api/public/tag-translations",
          {
            cache: "no-store",
          },
        );
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!isActive) {
          return;
        }
        setTagTranslations(data.tags || {});
        setGenreTranslations(data.genres || {});
      } catch {
        if (isActive) {
          setTagTranslations({});
          setGenreTranslations({});
        }
      }
    };

    void loadTranslations();
    return () => {
      isActive = false;
    };
  }, [apiBase, hasFullBootstrap, projectsLoadVersion]);

  useEffect(() => {
    const legacyGenre = searchParams.get("genre");
    if (!legacyGenre) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    if (!searchParams.get("genero")) {
      nextParams.set("genero", legacyGenre);
    }
    nextParams.delete("genre");
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSearchInputValue(selectedQuery);
  }, [selectedQuery]);

  useEffect(() => {
    if (!isMobileFiltersOpen) {
      setOpenFilterId(null);
    }
  }, [isMobileFiltersOpen]);

  const commitSearchParams = useCallback(
    (
      mutate: (params: URLSearchParams) => void,
      options?: { replace?: boolean },
    ) => {
      const current = new URLSearchParams(searchParamsRef.current);
      const next = new URLSearchParams(current);
      mutate(next);
      if (next.toString() === current.toString()) {
        return;
      }
      setSearchParams(next, { replace: options?.replace });
    },
    [setSearchParams],
  );

  const indexedProjects = useMemo(
    () =>
      buildIndexedPublicProjects({
        projects,
        tagTranslations,
        genreTranslations,
      }),
    [genreTranslations, projects, tagTranslations],
  );
  const letterOptions = ALPHABET_FILTER_OPTIONS;
  const tagOptions = indexedProjects.tagOptions;
  const genreOptions = indexedProjects.genreOptions;
  const typeOptionValues = indexedProjects.typeOptions;
  const typeOptions = useMemo(
    () =>
      typeOptionValues.map((type) =>
        buildFilterOption(type, type === "Todos" ? "Todos os formatos" : type),
      ),
    [typeOptionValues],
  );
  const normalizedQueryTokens = useMemo(
    () => normalizeSearchText(selectedQuery).split(/\s+/).filter(Boolean),
    [selectedQuery],
  );

  const filteredProjects = useMemo(
    () =>
      indexedProjects.items
        .filter((item) => {
          const matchesTag =
            selectedTag === "Todas" || item.tagSet.has(selectedTag);
          const matchesGenre =
            selectedGenre === "Todos" || item.genreSet.has(selectedGenre);
          const matchesType =
            selectedType === "Todos" || item.type === selectedType;
          const matchesLetter =
            selectedLetter === "Todas" || item.firstLetter === selectedLetter;
          const matchesQuery =
            normalizedQueryTokens.length === 0 ||
            normalizedQueryTokens.every((token) =>
              item.normalizedHaystack.includes(token),
            );
          return (
            matchesTag &&
            matchesGenre &&
            matchesType &&
            matchesLetter &&
            matchesQuery
          );
        })
        .map((item) => item.project),
    [
      indexedProjects.items,
      normalizedQueryTokens,
      selectedGenre,
      selectedLetter,
      selectedTag,
      selectedType,
    ],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProjects.length / projectsPerPage),
  );
  const pageStart = (currentPage - 1) * projectsPerPage;
  const paginatedProjects = filteredProjects.slice(
    pageStart,
    pageStart + projectsPerPage,
  );
  const synopsisKeys = useMemo(
    () => paginatedProjects.map((project) => project.id),
    [paginatedProjects],
  );
  const synopsisMaxLines = isMobile ? 2 : 4;
  const { rootRef: synopsisRootRef, lineByKey } = useDynamicSynopsisClamp({
    enabled: paginatedProjects.length > 0,
    keys: synopsisKeys,
    maxLines: synopsisMaxLines,
  });
  const getSynopsisClampClass = useCallback(
    (projectId: string) => {
      const lines = lineByKey[projectId] ?? synopsisMaxLines;
      if (lines <= 0) {
        return "projects-public-synopsis-clamp-0";
      }
      if (lines === 1) {
        return "projects-public-synopsis-clamp-1";
      }
      if (lines === 2) {
        return "projects-public-synopsis-clamp-2";
      }
      if (lines === 3) {
        return "projects-public-synopsis-clamp-3";
      }
      return "projects-public-synopsis-clamp-4";
    },
    [lineByKey, synopsisMaxLines],
  );

  useEffect(() => {
    if (searchInputValue === selectedQuery) {
      return;
    }
    const timeout = window.setTimeout(() => {
      commitSearchParams((params) => {
        const nextQuery = searchInputValue.trim();
        if (nextQuery) {
          params.set("q", nextQuery);
        } else {
          params.delete("q");
        }
        params.delete("page");
      });
    }, SEARCH_QUERY_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [commitSearchParams, searchInputValue, selectedQuery]);

  useEffect(() => {
    if (isLoadingProjects || hasProjectsLoadError) {
      return;
    }
    if (selectedType === "Todos" || typeOptionValues.includes(selectedType)) {
      return;
    }
    commitSearchParams(
      (params) => {
        params.delete("type");
      },
      { replace: true },
    );
  }, [
    commitSearchParams,
    hasProjectsLoadError,
    isLoadingProjects,
    selectedType,
    typeOptionValues,
  ]);

  useEffect(() => {
    if (isLoadingProjects || hasProjectsLoadError) {
      return;
    }
    if (
      selectedTag === "Todas" ||
      tagOptions.some((option) => option.value === selectedTag)
    ) {
      return;
    }
    commitSearchParams(
      (params) => {
        params.delete("tag");
      },
      { replace: true },
    );
  }, [
    commitSearchParams,
    hasProjectsLoadError,
    isLoadingProjects,
    selectedTag,
    tagOptions,
  ]);

  useEffect(() => {
    if (isLoadingProjects || hasProjectsLoadError) {
      return;
    }
    if (
      selectedGenre === "Todos" ||
      genreOptions.some((option) => option.value === selectedGenre)
    ) {
      return;
    }
    commitSearchParams(
      (params) => {
        params.delete("genero");
        params.delete("genre");
      },
      { replace: true },
    );
  }, [
    commitSearchParams,
    genreOptions,
    hasProjectsLoadError,
    isLoadingProjects,
    selectedGenre,
  ]);

  useEffect(() => {
    if (isLoadingProjects || hasProjectsLoadError) {
      return;
    }
    if (currentPage <= totalPages) {
      return;
    }
    commitSearchParams(
      (params) => {
        if (totalPages <= 1) {
          params.delete("page");
        } else {
          params.set("page", String(totalPages));
        }
      },
      { replace: true },
    );
  }, [
    commitSearchParams,
    currentPage,
    hasProjectsLoadError,
    isLoadingProjects,
    totalPages,
  ]);

  const handleFilterChange = useCallback(
    (
      key: "letter" | "tag" | "genero" | "type",
      value: string,
      emptyValue: "Todas" | "Todos",
    ) => {
      commitSearchParams((params) => {
        if (value === emptyValue) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
        if (key === "genero") {
          params.delete("genre");
        }
        params.delete("page");
      });
    },
    [commitSearchParams],
  );

  const handleLetterChange = useCallback(
    (value: string) =>
      handleFilterChange("letter", parseLetterParam(value), "Todas"),
    [handleFilterChange],
  );
  const handleTagChange = useCallback(
    (value: string) => handleFilterChange("tag", value || "Todas", "Todas"),
    [handleFilterChange],
  );
  const handleGenreChange = useCallback(
    (value: string) => handleFilterChange("genero", value || "Todos", "Todos"),
    [handleFilterChange],
  );
  const handleTypeChange = useCallback(
    (value: string) => handleFilterChange("type", value || "Todos", "Todos"),
    [handleFilterChange],
  );
  const handlePageChange = useCallback(
    (nextPage: number) => {
      commitSearchParams((params) => {
        if (nextPage <= 1) {
          params.delete("page");
        } else {
          params.set("page", String(nextPage));
        }
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [commitSearchParams],
  );
  const resetFilters = useCallback(() => {
    commitSearchParams(
      (params) => {
        params.delete("tag");
        params.delete("genero");
        params.delete("genre");
        params.delete("letter");
        params.delete("type");
        params.delete("page");
        params.delete("q");
      },
      { replace: true },
    );
  }, [commitSearchParams]);

  const activeFilterCount = [
    selectedLetter !== "Todas",
    selectedTag !== "Todas",
    selectedGenre !== "Todos",
    selectedType !== "Todos",
  ].filter(Boolean).length;
  const activeFiltersSummary =
    activeFilterCount === 0
      ? "Nenhum filtro ativo"
      : activeFilterCount === 1
        ? "1 filtro ativo"
        : `${activeFilterCount} filtros ativos`;

  return (
    <div className="min-h-screen text-foreground">
      <main className="pt-20 md:pt-28">
        <section
          className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-20 reveal`}
          data-reveal
        >
          <ProjectsFiltersPanel
            isMobile={isMobile}
            isMobileFiltersOpen={isMobileFiltersOpen}
            onToggleMobileFilters={() =>
              setIsMobileFiltersOpen((current) => !current)
            }
            searchInputValue={searchInputValue}
            onSearchInputChange={setSearchInputValue}
            letterOptions={letterOptions}
            selectedLetter={selectedLetter}
            selectedTag={selectedTag}
            selectedGenre={selectedGenre}
            selectedType={selectedType}
            tagOptions={
              tagOptions.length > 0 ? tagOptions : EMPTY_FILTER_OPTIONS
            }
            genreOptions={
              genreOptions.length > 0 ? genreOptions : EMPTY_FILTER_OPTIONS
            }
            typeOptions={typeOptions}
            filteredProjectsCount={filteredProjects.length}
            activeFiltersSummary={activeFiltersSummary}
            openFilterId={openFilterId}
            onOpenFilterChange={setOpenFilterId}
            onLetterChange={handleLetterChange}
            onTagChange={handleTagChange}
            onGenreChange={handleGenreChange}
            onTypeChange={handleTypeChange}
            onResetFilters={resetFilters}
          />

          {isLoadingProjects ? (
            <AsyncState
              kind="loading"
              title="Carregando projetos"
              description="Estamos buscando os projetos publicados."
              className="mt-10"
            />
          ) : hasProjectsLoadError ? (
            <AsyncState
              kind="error"
              title="Não foi possível carregar os projetos"
              description="Verifique sua conexão e tente novamente."
              className="mt-10"
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    setProjectsLoadVersion((current) => current + 1)
                  }
                >
                  Tentar novamente
                </Button>
              }
            />
          ) : paginatedProjects.length === 0 ? (
            <AsyncState
              kind="empty"
              title="Nenhum projeto encontrado."
              description="Ajuste os filtros para ampliar os resultados."
              className="mt-10"
              action={
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  className="text-xs uppercase"
                >
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <ProjectsGrid
              projects={paginatedProjects}
              tagTranslations={tagTranslations}
              genreTranslations={genreTranslations}
              navigate={navigate}
              mediaVariants={projectsMediaVariants}
              isMobile={isMobile}
              rootRef={synopsisRootRef}
              getSynopsisClampClass={getSynopsisClampClass}
            />
          )}

          {!isLoadingProjects &&
            !hasProjectsLoadError &&
            filteredProjects.length > projectsPerPage && (
              <div className="mt-12 flex justify-center">
                <CompactPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
        </section>
      </main>
    </div>
  );
};

export default Projects;
