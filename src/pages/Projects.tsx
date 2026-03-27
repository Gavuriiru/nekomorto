import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/public-form-controls";
import {
  publicPageLayoutTokens,
  publicStrongSurfaceHoverClassName,
} from "@/components/public-page-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AsyncState from "@/components/ui/async-state";
import UploadPicture from "@/components/UploadPicture";
import CompactPagination from "@/components/ui/compact-pagination";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import type { Project } from "@/data/projects";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import "@/styles/projects-public.css";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import {
  prepareProjectBadges,
  PROJECT_COVER_ASPECT_RATIO,
  type ProjectBadgeItem,
} from "@/lib/project-card-layout";
import { normalizeSearchText } from "@/lib/search-ranking";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import { cn } from "@/lib/utils";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
} from "../../shared/institutional-og-seo.js";

const alphabetOptions = ["Todas", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
const PROJECTS_LIST_STATE_STORAGE_KEY = "public.projects.list-state.v1";
const MAX_QUERY_LENGTH = 80;
const SEARCH_QUERY_DEBOUNCE_MS = 60;
const PROJECTS_LIST_IMAGE_SIZES = "(max-width: 767px) 100px, 142px";
const PRIORITY_PROJECT_IMAGE_COUNT = 1;
const MOBILE_FILTERS_PANEL_ID = "projects-mobile-filters-panel";

const parseLetterParam = (value: string | null) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (/^[A-Z]$/.test(normalized)) {
    return normalized;
  }
  return "Todas";
};

const parseTypeParam = (value: string | null) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "Todos";
  }
  return normalized;
};

const parseProjectsPageParam = (value: string | null) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
};

type ProjectCardProps = {
  project: Project;
  tagTranslations: Record<string, string>;
  genreTranslations: Record<string, string>;
  navigate: ReturnType<typeof useNavigate>;
  synopsisClampClass: string;
  mediaVariants: UploadMediaVariantsMap;
  isPriorityImage: boolean;
  isMobile: boolean;
};

const EMPTY_BADGE_LAYOUT = Object.freeze({
  allItems: Object.freeze([]) as ProjectBadgeItem[],
  visibleItems: Object.freeze([]) as ProjectBadgeItem[],
  extraCount: 0,
  showOverflowBadge: false,
});

const getProjectBadgeAriaLabel = (item: ProjectBadgeItem) => {
  if (item.key.startsWith("tag-")) {
    return `Filtrar por tag ${item.label}`;
  }
  if (item.key.startsWith("genre-")) {
    return `Filtrar por genero ${item.label}`;
  }
  return item.label;
};

const PROJECT_PRIMARY_BADGE_CLASS_NAME =
  "inline-flex h-6 shrink-0 whitespace-nowrap px-2 text-[9px] uppercase leading-none";
const PROJECT_PRIMARY_BADGE_BUTTON_CLASS_NAME =
  "inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-md p-0.5";

type ProjectPrimaryBadgeProps = {
  item: ProjectBadgeItem;
  navigate?: ReturnType<typeof useNavigate>;
  badgeKey?: string;
  measure?: boolean;
};

const ProjectPrimaryBadge = ({
  item,
  navigate,
  badgeKey,
  measure = false,
}: ProjectPrimaryBadgeProps) => {
  const badge = (
    <Badge
      data-badge-key={item.href ? undefined : badgeKey}
      variant={item.variant}
      className={PROJECT_PRIMARY_BADGE_CLASS_NAME}
      title={item.label}
      aria-hidden={measure ? true : undefined}
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
      data-badge-key={badgeKey}
      className={PROJECT_PRIMARY_BADGE_BUTTON_CLASS_NAME}
      title={item.label}
      aria-label={measure ? undefined : getProjectBadgeAriaLabel(item)}
      aria-hidden={measure ? true : undefined}
      tabIndex={measure ? -1 : undefined}
      onClick={
        measure || !navigate
          ? undefined
          : (event) => {
              event.preventDefault();
              event.stopPropagation();
              navigate(item.href!);
            }
      }
    >
      {badge}
    </button>
  );
};

type ProjectsFilterFieldProps = {
  label: string;
  className?: string;
  children: ReactNode;
};

const ProjectsFilterField = ({ label, className, children }: ProjectsFilterFieldProps) => (
  <div className={cn("flex flex-col gap-2", className)}>
    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    {children}
  </div>
);

type ProjectsResultsSummaryProps = {
  filteredProjectsCount: number;
  onResetFilters: () => void;
  className?: string;
};

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
      <span className="font-semibold text-foreground">{filteredProjectsCount}</span>
      <span>projetos encontrados</span>
      <span className="text-muted-foreground">&bull;</span>
      <span>Atualizado semanalmente</span>
    </div>
    <Button variant="ghost" onClick={onResetFilters} className="w-full text-xs uppercase sm:w-auto">
      Limpar filtros
    </Button>
  </div>
);

const ProjectCard = ({
  project,
  tagTranslations,
  genreTranslations,
  navigate,
  synopsisClampClass,
  mediaVariants,
  isPriorityImage,
  isMobile,
}: ProjectCardProps) => {
  const [badgesRowWidth, setBadgesRowWidth] = useState(0);
  const [badgeWidths, setBadgeWidths] = useState<Record<string, number>>({});
  const badgesRowRef = useRef<HTMLDivElement | null>(null);
  const badgeMeasureRef = useRef<HTMLDivElement | null>(null);
  const { allItems, visibleItems, extraCount, showOverflowBadge } = useMemo(
    () =>
      isMobile
        ? EMPTY_BADGE_LAYOUT
        : prepareProjectBadges({
            tags: project.tags,
            genres: project.genres || [],
            producers: project.producers || [],
            tagTranslations,
            genreTranslations,
            maxVisible: 3,
            maxChars: 18,
            maxRowWidth: badgesRowWidth,
            badgeWidths,
            overflowBadgeWidth: 36,
            gapPx: 4,
          }),
    [
      badgeWidths,
      badgesRowWidth,
      genreTranslations,
      isMobile,
      project.genres,
      project.producers,
      project.tags,
      tagTranslations,
    ],
  );

  useEffect(() => {
    if (isMobile) {
      setBadgesRowWidth(0);
      return;
    }
    const rowNode = badgesRowRef.current;
    if (!rowNode) {
      setBadgesRowWidth(0);
      return;
    }

    const updateWidth = () => setBadgesRowWidth(rowNode.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(rowNode);
    return () => observer.disconnect();
  }, [allItems.length, isMobile, project.id]);

  useEffect(() => {
    if (isMobile) {
      setBadgeWidths((current) => (Object.keys(current).length > 0 ? {} : current));
      return;
    }
    const measureNode = badgeMeasureRef.current;
    if (!measureNode || allItems.length === 0) {
      setBadgeWidths((current) => (Object.keys(current).length > 0 ? {} : current));
      return;
    }

    const nextWidths: Record<string, number> = {};
    const nodes = measureNode.querySelectorAll<HTMLElement>("[data-badge-key]");
    nodes.forEach((node) => {
      const key = node.dataset.badgeKey;
      if (key) {
        nextWidths[key] = node.offsetWidth;
      }
    });

    setBadgeWidths((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextWidths);
      if (currentKeys.length !== nextKeys.length) {
        return nextWidths;
      }
      for (const key of nextKeys) {
        if (current[key] !== nextWidths[key]) {
          return nextWidths;
        }
      }
      return current;
    });
  }, [allItems, isMobile]);

  return (
    <Link
      to={`/projeto/${project.id}`}
      className={`projects-public-card group flex h-50 w-full items-start gap-5 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-[0_28px_120px_-60px_rgba(0,0,0,0.55)] transition-[transform,border-color,box-shadow,color] duration-300 hover:-translate-y-1 ${publicStrongSurfaceHoverClassName} hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/45 md:h-60`}
    >
      <div
        className="h-39 shrink-0 overflow-hidden rounded-xl bg-secondary shadow-inner md:h-50"
        style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }}
      >
        <UploadPicture
          src={project.cover}
          alt={project.title}
          preset="posterThumb"
          mediaVariants={mediaVariants}
          className="block h-full w-full"
          imgClassName="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          sizes={PROJECTS_LIST_IMAGE_SIZES}
          loading={isPriorityImage ? "eager" : "lazy"}
          fetchPriority={isPriorityImage ? "high" : undefined}
        />
      </div>
      <div
        data-synopsis-role="column"
        data-synopsis-key={project.id}
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div data-synopsis-role="title" className="shrink-0">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80 transition-colors duration-300 group-hover:text-primary">
            {project.type}
          </p>
          <h2 className="line-clamp-2 text-xl font-semibold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary md:text-2xl">
            {project.title}
          </h2>
        </div>

        <p
          data-synopsis-role="synopsis"
          className={cn(
            "mt-2 overflow-hidden text-sm leading-snug text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80 break-normal hyphens-none",
            synopsisClampClass,
          )}
        >
          {project.synopsis}
        </p>

        <div
          data-synopsis-role="badges"
          className="relative mt-auto flex shrink-0 flex-col gap-2 pt-3"
        >
          {!isMobile && (visibleItems.length > 0 || extraCount > 0) ? (
            <div
              ref={badgesRowRef}
              className="hidden min-w-0 flex-nowrap items-center gap-1 overflow-hidden sm:flex"
            >
              {visibleItems.map((item) => (
                <ProjectPrimaryBadge key={item.key} item={item} navigate={navigate} />
              ))}
              {showOverflowBadge ? (
                <Badge
                  key={`extra-${project.id}`}
                  variant="secondary"
                  className="inline-flex h-6 w-9 shrink-0 justify-center whitespace-nowrap px-2 text-[9px] uppercase leading-none"
                  title={`+${extraCount} tags`}
                >
                  +{extraCount}
                </Badge>
              ) : null}
            </div>
          ) : null}
          {!isMobile && allItems.length > 0 ? (
            <div
              ref={badgeMeasureRef}
              aria-hidden
              className="pointer-events-none absolute -left-[9999px] top-0 flex items-center gap-1 opacity-0"
            >
              {allItems.map((item) => (
                <ProjectPrimaryBadge
                  key={`measure-${item.key}`}
                  item={item}
                  badgeKey={item.key}
                  measure
                />
              ))}
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
  );
};

const Projects = () => {
  const apiBase = getApiBase();
  const isMobile = useIsMobile();
  const hasMountedRef = useRef(false);
  const isApplyingUrlStateRef = useRef(false);
  const bootstrap = readWindowPublicBootstrap();
  const hasFullBootstrap = Boolean(bootstrap && bootstrap.payloadMode !== "critical-home");
  const bootstrapProjects = hasFullBootstrap ? ((bootstrap?.projects || []) as Project[]) : [];
  const bootstrapTagTranslations = hasFullBootstrap ? bootstrap?.tagTranslations : null;
  const bootstrapMediaVariants = hasFullBootstrap ? bootstrap?.mediaVariants || {} : {};
  const [projects, setProjects] = useState<Project[]>(() => bootstrapProjects);
  const [isLoadingProjects, setIsLoadingProjects] = useState(() => !hasFullBootstrap);
  const [hasProjectsLoadError, setHasProjectsLoadError] = useState(false);
  const [projectsLoadVersion, setProjectsLoadVersion] = useState(0);
  const [projectsMediaVariants, setProjectsMediaVariants] = useState<UploadMediaVariantsMap>(
    () => bootstrapMediaVariants,
  );
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLetter, setSelectedLetter] = useState(() =>
    parseLetterParam(searchParams.get("letter")),
  );
  const [selectedType, setSelectedType] = useState(() => parseTypeParam(searchParams.get("type")));
  const [currentPage, setCurrentPage] = useState(() =>
    parseProjectsPageParam(searchParams.get("page")),
  );
  const listUiStateRef = useRef({
    selectedLetter: parseLetterParam(searchParams.get("letter")),
    selectedType: parseTypeParam(searchParams.get("type")),
    currentPage: parseProjectsPageParam(searchParams.get("page")),
  });
  const navigate = useNavigate();
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>(
    () => bootstrapTagTranslations?.tags || {},
  );
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>(
    () => bootstrapTagTranslations?.genres || {},
  );
  const projectsPerPage = 16;
  const selectedTag = searchParams.get("tag") || "Todas";
  const selectedGenre = searchParams.get("genero") || searchParams.get("genre") || "Todos";
  const selectedQuery = searchParams.get("q") || "";
  const [searchInputValue, setSearchInputValue] = useState(() => selectedQuery);
  const pageMediaVariants = bootstrap?.mediaVariants || {};

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
        if (isActive) {
          setProjects(Array.isArray(data.projects) ? data.projects : []);
          setProjectsMediaVariants(
            data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {},
          );
          setHasProjectsLoadError(false);
        }
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

    load();
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
        const response = await apiFetch(apiBase, "/api/public/tag-translations", {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setTagTranslations(data.tags || {});
          setGenreTranslations(data.genres || {});
        }
      } catch {
        if (isActive) {
          setTagTranslations({});
          setGenreTranslations({});
        }
      }
    };
    loadTranslations();
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

  const updateFilterQuery = useCallback(
    (
      tag: string,
      genre: string,
      options?: {
        resetPage?: boolean;
        query?: string;
      },
    ) => {
      const nextParams = new URLSearchParams(searchParams);
      if (tag === "Todas") {
        nextParams.delete("tag");
      } else {
        nextParams.set("tag", tag);
      }

      if (genre === "Todos") {
        nextParams.delete("genero");
        nextParams.delete("genre");
      } else {
        nextParams.set("genero", genre);
        nextParams.delete("genre");
      }

      if (typeof options?.query === "string") {
        const normalizedQuery = options.query.trim().slice(0, MAX_QUERY_LENGTH);
        if (!normalizedQuery) {
          nextParams.delete("q");
        } else {
          nextParams.set("q", normalizedQuery);
        }
      }

      if (options?.resetPage !== false) {
        nextParams.delete("page");
      }

      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let shouldUpdate = false;

    const currentTag = String(nextParams.get("tag") || "").trim();
    if (currentTag === "Todas") {
      nextParams.delete("tag");
      shouldUpdate = true;
    }

    const currentGenero = String(nextParams.get("genero") || "").trim();
    if (currentGenero === "Todos") {
      nextParams.delete("genero");
      shouldUpdate = true;
    }

    const currentLegacyGenre = String(nextParams.get("genre") || "").trim();
    if (currentLegacyGenre === "Todos") {
      nextParams.delete("genre");
      shouldUpdate = true;
    }

    const currentQuery = nextParams.get("q");
    if (currentQuery !== null) {
      const normalizedQuery = currentQuery.trim().slice(0, MAX_QUERY_LENGTH);
      if (!normalizedQuery) {
        nextParams.delete("q");
        shouldUpdate = true;
      } else if (normalizedQuery !== currentQuery) {
        nextParams.set("q", normalizedQuery);
        shouldUpdate = true;
      }
    }

    if (shouldUpdate && nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const normalizedInput = searchInputValue.trim().slice(0, MAX_QUERY_LENGTH);
    const normalizedSelectedQuery = selectedQuery.trim().slice(0, MAX_QUERY_LENGTH);
    if (normalizedInput === normalizedSelectedQuery) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      updateFilterQuery(selectedTag, selectedGenre, {
        query: searchInputValue,
      });
    }, SEARCH_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInputValue, selectedGenre, selectedQuery, selectedTag, updateFilterQuery]);

  useEffect(() => {
    listUiStateRef.current = {
      selectedLetter,
      selectedType,
      currentPage,
    };
  }, [currentPage, selectedLetter, selectedType]);

  useEffect(() => {
    const nextLetter = parseLetterParam(searchParams.get("letter"));
    const nextType = parseTypeParam(searchParams.get("type"));
    const nextPage = parseProjectsPageParam(searchParams.get("page"));
    const previousState = listUiStateRef.current;
    const hasStateChange =
      previousState.selectedLetter !== nextLetter ||
      previousState.selectedType !== nextType ||
      previousState.currentPage !== nextPage;
    if (!hasStateChange) {
      return;
    }
    isApplyingUrlStateRef.current = true;
    setSelectedLetter(nextLetter);
    setSelectedType(nextType);
    setCurrentPage(nextPage);
  }, [searchParams]);

  useEffect(() => {
    if (isApplyingUrlStateRef.current) {
      isApplyingUrlStateRef.current = false;
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    if (selectedLetter === "Todas") {
      nextParams.delete("letter");
    } else {
      nextParams.set("letter", selectedLetter);
    }
    if (selectedType === "Todos") {
      nextParams.delete("type");
    } else {
      nextParams.set("type", selectedType);
    }
    if (currentPage <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(currentPage));
    }
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [currentPage, searchParams, selectedLetter, selectedType, setSearchParams]);

  const tagOptions = useMemo(() => {
    const tags = projects.flatMap((project) => project.tags);
    const unique = Array.from(new Set(tags)).filter(Boolean);
    const sorted = unique.sort((a, b) =>
      (tagTranslations[a] || a).localeCompare(tagTranslations[b] || b, "pt-BR"),
    );
    return ["Todas", ...sorted];
  }, [projects, tagTranslations]);

  const genreOptions = useMemo(() => {
    const genres = projects.flatMap((project) => project.genres || []);
    const unique = Array.from(new Set(genres)).filter(Boolean);
    const sorted = unique.sort((a, b) =>
      (genreTranslations[a] || a).localeCompare(genreTranslations[b] || b, "pt-BR"),
    );
    return ["Todos", ...sorted];
  }, [projects, genreTranslations]);

  const typeOptions = useMemo(() => {
    const types = projects.map((project) => project.type).filter(Boolean);
    const unique = Array.from(new Set(types));
    const sorted = unique.sort((a, b) => a.localeCompare(b, "pt-BR"));
    return ["Todos", ...sorted];
  }, [projects]);

  useEffect(() => {
    if (isLoadingProjects || hasProjectsLoadError) {
      return;
    }
    if (selectedType === "Todos") {
      return;
    }
    if (typeOptions.includes(selectedType)) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("type");
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
      return;
    }
    setSelectedType("Todos");
  }, [
    hasProjectsLoadError,
    isLoadingProjects,
    searchParams,
    selectedType,
    setSearchParams,
    typeOptions,
  ]);

  const normalizedQueryTokens = useMemo(
    () => normalizeSearchText(selectedQuery).split(/\s+/).filter(Boolean),
    [selectedQuery],
  );

  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const matchesTag = selectedTag === "Todas" || project.tags.includes(selectedTag);
        const matchesType = selectedType === "Todos" || project.type === selectedType;
        const matchesLetter =
          selectedLetter === "Todas" || project.title.toUpperCase().startsWith(selectedLetter);
        const matchesGenre =
          selectedGenre === "Todos" || (project.genres || []).includes(selectedGenre);
        const haystack =
          normalizedQueryTokens.length > 0
            ? normalizeSearchText(
                [
                  project.title,
                  project.titleOriginal,
                  project.titleEnglish,
                  project.synopsis,
                  project.description,
                  project.type,
                  project.status,
                  project.studio,
                  ...(Array.isArray(project.animationStudios) ? project.animationStudios : []),
                  ...(Array.isArray(project.producers) ? project.producers : []),
                  ...(Array.isArray(project.tags) ? project.tags : []),
                  ...(Array.isArray(project.genres) ? project.genres : []),
                ]
                  .filter(Boolean)
                  .join(" "),
              )
            : "";
        const matchesQuery =
          normalizedQueryTokens.length === 0 ||
          normalizedQueryTokens.every((token) => haystack.includes(token));
        return matchesTag && matchesType && matchesLetter && matchesGenre && matchesQuery;
      })
      .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  }, [normalizedQueryTokens, projects, selectedGenre, selectedLetter, selectedTag, selectedType]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / projectsPerPage));
  useEffect(() => {
    if (isLoadingProjects || hasProjectsLoadError) {
      return;
    }
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [hasProjectsLoadError, isLoadingProjects, totalPages]);

  const pageStart = (currentPage - 1) * projectsPerPage;
  const paginatedProjects = filteredProjects.slice(pageStart, pageStart + projectsPerPage);
  const isDesktopSynopsisClampEnabled = !isMobile && paginatedProjects.length > 0;
  const synopsisKeys = useMemo(
    () => paginatedProjects.map((project) => project.id),
    [paginatedProjects],
  );
  const { rootRef: listRootRef, lineByKey } = useDynamicSynopsisClamp({
    enabled: isDesktopSynopsisClampEnabled,
    keys: synopsisKeys,
    maxLines: 4,
  });
  const getSynopsisClampClass = (projectId: string) => {
    if (isMobile) {
      return "line-clamp-2";
    }
    const lines = lineByKey[projectId] ?? 2;
    if (lines <= 0) {
      return "hidden";
    }
    if (lines === 1) {
      return "line-clamp-1";
    }
    if (lines === 2) {
      return "line-clamp-2";
    }
    if (lines === 3) {
      return "line-clamp-3";
    }
    return "line-clamp-4";
  };

  const resetFilters = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("tag");
    nextParams.delete("genero");
    nextParams.delete("genre");
    nextParams.delete("letter");
    nextParams.delete("type");
    nextParams.delete("page");
    nextParams.delete("q");
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const filterControls = (
    <>
      <ProjectsFilterField label="A-Z">
        <Select
          value={selectedLetter}
          onValueChange={(value) => {
            setSelectedLetter(value);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="bg-background/60" aria-label="Filtrar por letra">
            <SelectValue placeholder="Todas as letras" />
          </SelectTrigger>
          <SelectContent>
            {alphabetOptions.map((letter) => (
              <SelectItem key={letter} value={letter}>
                {letter}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ProjectsFilterField>

      <ProjectsFilterField label="Tags">
        <Select
          value={selectedTag}
          onValueChange={(value) => updateFilterQuery(value, selectedGenre)}
        >
          <SelectTrigger className="bg-background/60" aria-label="Filtrar por tag">
            <SelectValue placeholder="Todas as tags" />
          </SelectTrigger>
          <SelectContent>
            {tagOptions.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tagTranslations[tag] || tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ProjectsFilterField>

      <ProjectsFilterField label="GÃªneros">
        <Select
          value={selectedGenre}
          onValueChange={(value) => updateFilterQuery(selectedTag, value)}
        >
          <SelectTrigger className="bg-background/60" aria-label="Filtrar por genero">
            <SelectValue placeholder="Todos os generos" />
          </SelectTrigger>
          <SelectContent>
            {genreOptions.map((genre) => (
              <SelectItem key={genre} value={genre}>
                {genreTranslations[genre] || genre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ProjectsFilterField>

      <ProjectsFilterField label="Formato">
        <Select
          value={selectedType}
          onValueChange={(value) => {
            setSelectedType(value);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="bg-background/60" aria-label="Filtrar por formato">
            <SelectValue placeholder="Todos os formatos" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ProjectsFilterField>
    </>
  );

  return (
    <div className="min-h-screen text-foreground">
      <main className="pt-20 md:pt-28">
        <section
          className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-20 reveal`}
          data-reveal
        >
          <div className="grid gap-3 rounded-2xl bg-card/70 p-4 shadow-lg md:grid-cols-4 md:gap-4 md:p-6">
            <div className="md:col-span-4 flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Busca
              </span>
              <Input
                value={searchInputValue}
                onChange={(event) =>
                  setSearchInputValue(event.target.value.slice(0, MAX_QUERY_LENGTH))
                }
                placeholder="Buscar por título, sinopse, tag ou gênero"
                className="bg-background/60"
                aria-label="Buscar projetos"
              />
            </div>
            {isMobile ? (
              <div>
                <div className="rounded-xl bg-background/40 px-4 py-3 shadow-sm">
                  <button
                    type="button"
                    aria-expanded={isMobileFiltersOpen}
                    aria-controls={MOBILE_FILTERS_PANEL_ID}
                    className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
                    onClick={() => setIsMobileFiltersOpen((current) => !current)}
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Filtros
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {filteredProjects.length}
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
                        filteredProjectsCount={filteredProjects.length}
                        onResetFilters={resetFilters}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {!isMobile ? (
              <>
                <div className="hidden md:flex md:flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    A-Z
                  </span>
                  <Select
                    value={selectedLetter}
                    onValueChange={(value) => {
                      setSelectedLetter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="bg-background/60" aria-label="Filtrar por letra">
                      <SelectValue placeholder="Todas as letras" />
                    </SelectTrigger>
                    <SelectContent>
                      {alphabetOptions.map((letter) => (
                        <SelectItem key={letter} value={letter}>
                          {letter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="hidden md:flex md:flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Tags
                  </span>
                  <Select
                    value={selectedTag}
                    onValueChange={(value) => updateFilterQuery(value, selectedGenre)}
                  >
                    <SelectTrigger className="bg-background/60" aria-label="Filtrar por tag">
                      <SelectValue placeholder="Todas as tags" />
                    </SelectTrigger>
                    <SelectContent>
                      {tagOptions.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tagTranslations[tag] || tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Gêneros
                  </span>
                  <Select
                    value={selectedGenre}
                    onValueChange={(value) => updateFilterQuery(selectedTag, value)}
                  >
                    <SelectTrigger className="bg-background/60" aria-label="Filtrar por genero">
                      <SelectValue placeholder="Todos os generos" />
                    </SelectTrigger>
                    <SelectContent>
                      {genreOptions.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genreTranslations[genre] || genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="hidden md:flex md:flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Formato
                  </span>
                  <Select
                    value={selectedType}
                    onValueChange={(value) => {
                      setSelectedType(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="bg-background/60" aria-label="Filtrar por formato">
                      <SelectValue placeholder="Todos os formatos" />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    <span className="font-semibold text-foreground">{filteredProjects.length}</span>
                    <span>projetos encontrados</span>
                    <span className="hidden text-muted-foreground md:inline">&bull;</span>
                    <span className="hidden md:inline">Atualizado semanalmente</span>
                  </div>
                  <Button variant="ghost" onClick={resetFilters} className="text-xs uppercase">
                    Limpar filtros
                  </Button>
                </div>
              </>
            ) : null}
          </div>
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
                  onClick={() => setProjectsLoadVersion((current) => current + 1)}
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
                <Button variant="ghost" onClick={resetFilters} className="text-xs uppercase">
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <div
              ref={isDesktopSynopsisClampEnabled ? listRootRef : undefined}
              className="mt-10 grid gap-6 md:grid-cols-2 md:auto-rows-fr"
            >
              {paginatedProjects.map((project, index) => {
                const isLastSingle =
                  paginatedProjects.length % 2 === 1 && index === paginatedProjects.length - 1;
                return (
                  <div
                    key={project.id}
                    className={isLastSingle ? "md:col-span-2 flex justify-center" : undefined}
                  >
                    {isLastSingle ? (
                      <div className="w-full md:w-[calc(50%-0.75rem)]">
                        <ProjectCard
                          project={project}
                          tagTranslations={tagTranslations}
                          genreTranslations={genreTranslations}
                          navigate={navigate}
                          synopsisClampClass={getSynopsisClampClass(project.id)}
                          mediaVariants={projectsMediaVariants}
                          isPriorityImage={index < PRIORITY_PROJECT_IMAGE_COUNT}
                          isMobile={isMobile}
                        />
                      </div>
                    ) : (
                      <ProjectCard
                        project={project}
                        tagTranslations={tagTranslations}
                        genreTranslations={genreTranslations}
                        navigate={navigate}
                        synopsisClampClass={getSynopsisClampClass(project.id)}
                        mediaVariants={projectsMediaVariants}
                        isPriorityImage={index < PRIORITY_PROJECT_IMAGE_COUNT}
                        isMobile={isMobile}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isLoadingProjects &&
            !hasProjectsLoadError &&
            filteredProjects.length > projectsPerPage && (
              <div className="mt-12 flex justify-center">
                <CompactPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
        </section>
      </main>
    </div>
  );
};

export default Projects;
