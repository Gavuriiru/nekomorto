import { useMemo } from "react";
import { Link } from "react-router-dom";

import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { floatingSurfaceShadowClassName } from "@/components/ui/floating-surface";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { buildPublicSearchIndex } from "@/lib/public-search-index";
import { PROJECT_COVER_ASPECT_RATIO } from "@/lib/project-card-layout";
import {
  rankPosts,
  rankProjects,
  selectVisibleTags,
  sortAlphabeticallyPtBr,
} from "@/lib/search-ranking";
import { buildTranslationMap, translateTag } from "@/lib/project-taxonomy";
import { cn } from "@/lib/utils";
import { uiCopy } from "@/lib/ui-copy";
import type { SearchSuggestion } from "@/types/search-suggestion";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

type HeaderSearchPopoverProps = {
  queryTrimmed: string;
  hasMinimumSearchQueryLength: boolean;
  isSearchLoading: boolean;
  hasSearchRequestFailed: boolean;
  remoteSuggestions: SearchSuggestion[];
  remoteMediaVariants: UploadMediaVariantsMap;
};

const HeaderSearchPopover = ({
  queryTrimmed,
  hasMinimumSearchQueryLength,
  isSearchLoading,
  hasSearchRequestFailed,
  remoteSuggestions,
  remoteMediaVariants,
}: HeaderSearchPopoverProps) => {
  const { data: bootstrapData } = usePublicBootstrap();
  const projects = bootstrapData?.projects || [];
  const posts = bootstrapData?.posts || [];
  const bootstrapMediaVariants = bootstrapData?.mediaVariants || {};
  const tagTranslations = bootstrapData?.tagTranslations?.tags || {};

  const { projectItems, postItems } = useMemo(
    () =>
      buildPublicSearchIndex({
        projects,
        posts,
        tagTranslations,
      }),
    [posts, projects, tagTranslations],
  );

  const fallbackProjects = useMemo(() => {
    if (!queryTrimmed) {
      return [];
    }
    return rankProjects(projectItems, queryTrimmed);
  }, [projectItems, queryTrimmed]);

  const fallbackPosts = useMemo(() => {
    if (!queryTrimmed) {
      return [];
    }
    return rankPosts(postItems, queryTrimmed);
  }, [postItems, queryTrimmed]);

  const remoteProjects = useMemo(() => {
    const tagTranslationMap = buildTranslationMap(tagTranslations);
    return remoteSuggestions
      .filter((suggestion) => suggestion.kind === "project")
      .map((item) => ({
        label: item.label,
        href: item.href,
        image: item.image || "/placeholder.svg",
        synopsis: item.description || item.meta || "",
        tags: selectVisibleTags(
          sortAlphabeticallyPtBr(
            (Array.isArray(item.tags) ? item.tags : [])
              .map((tag) => translateTag(String(tag || "").trim(), tagTranslationMap))
              .filter(Boolean),
          ),
          2,
          18,
        ),
      }));
  }, [remoteSuggestions, tagTranslations]);

  const remotePosts = useMemo(
    () =>
      remoteSuggestions
        .filter((suggestion) => suggestion.kind === "post")
        .map((item) => ({
          label: item.label,
          href: item.href,
        })),
    [remoteSuggestions],
  );

  const activeProjects = hasSearchRequestFailed ? fallbackProjects : remoteProjects;
  const activePosts = hasSearchRequestFailed ? fallbackPosts : remotePosts;
  const activeProjectMediaVariants = useMemo<UploadMediaVariantsMap>(
    () =>
      hasSearchRequestFailed
        ? bootstrapMediaVariants
        : {
            ...bootstrapMediaVariants,
            ...remoteMediaVariants,
          },
    [bootstrapMediaVariants, hasSearchRequestFailed, remoteMediaVariants],
  );
  const hasResults =
    hasMinimumSearchQueryLength && (activeProjects.length > 0 || activePosts.length > 0);

  return (
    <div
      data-testid="public-header-results"
      className={cn(
        "search-popover-enter absolute top-12 left-0 right-0 mx-auto max-h-[78vh] w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border/60 bg-background/95 p-4 backdrop-blur-sm md:left-auto md:right-0 md:mx-0 md:w-80",
        floatingSurfaceShadowClassName,
      )}
    >
      {!hasMinimumSearchQueryLength ? (
        <p className="text-sm text-muted-foreground">{uiCopy.search.minimumPrompt}</p>
      ) : isSearchLoading && !hasResults ? (
        <p className="text-sm text-muted-foreground">{uiCopy.search.loadingSuggestions}</p>
      ) : null}

      {hasMinimumSearchQueryLength && activeProjects.length > 0 ? (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Projetos
          </p>
          <ul className="no-scrollbar mt-3 max-h-[44vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {activeProjects.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className="group flex h-36 items-start gap-4 overflow-hidden rounded-xl border border-border/60 bg-gradient-card p-4 transition hover:border-primary/60 hover:bg-primary/5"
                >
                  <div
                    className="h-28 shrink-0 self-start overflow-hidden rounded-lg bg-secondary"
                    style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }}
                  >
                    <UploadPicture
                      src={item.image}
                      alt={item.label}
                      preset="posterThumb"
                      mediaVariants={activeProjectMediaVariants}
                      className="block h-full w-full"
                      imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div
                    data-synopsis-role="column"
                    className="min-h-0 min-w-0 flex flex-1 self-stretch flex-col"
                  >
                    <p
                      data-synopsis-role="title"
                      className="line-clamp-1 shrink-0 text-sm font-semibold text-foreground group-hover:text-primary"
                    >
                      {item.label}
                    </p>
                    <p
                      data-synopsis-role="synopsis"
                      className="mt-1 line-clamp-4 min-h-0 flex-1 overflow-hidden text-xs leading-snug text-muted-foreground"
                    >
                      {item.synopsis}
                    </p>
                    {item.tags.length > 0 ? (
                      <div
                        data-synopsis-role="badges"
                        className="flex min-w-0 shrink-0 flex-nowrap gap-1.5 overflow-hidden pb-1 pt-2"
                      >
                        {item.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="shrink-0 whitespace-nowrap text-[9px] uppercase"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasMinimumSearchQueryLength && activePosts.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Posts
          </p>
          <ul className="no-scrollbar mt-2 max-h-[26vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {activePosts.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className="text-sm text-foreground transition-colors hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasMinimumSearchQueryLength && !isSearchLoading && !hasResults ? (
        <p className="text-sm text-muted-foreground">{uiCopy.search.noResults}</p>
      ) : null}
    </div>
  );
};

export default HeaderSearchPopover;
