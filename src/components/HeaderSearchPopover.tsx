import { useMemo } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import UploadPicture from "@/components/UploadPicture";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { PROJECT_COVER_ASPECT_RATIO } from "@/lib/project-card-layout";
import { buildTranslationMap, translateTag } from "@/lib/project-taxonomy";
import {
  rankPosts,
  rankProjects,
  selectVisibleTags,
  sortAlphabeticallyPtBr,
} from "@/lib/search-ranking";
import { cn } from "@/lib/utils";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import type { PublicBootstrapPost, PublicBootstrapProject } from "@/types/public-bootstrap";
import type { SearchSuggestion } from "@/types/search-suggestion";
import { uiCopy } from "@/lib/ui-copy";

type HeaderSearchPopoverProps = {
  queryTrimmed: string;
  hasMinimumSearchQueryLength: boolean;
  isSearchLoading: boolean;
  hasSearchRequestFailed: boolean;
  projects: PublicBootstrapProject[];
  posts: PublicBootstrapPost[];
  tagTranslations: Record<string, string>;
  remoteSuggestions: SearchSuggestion[];
  bootstrapMediaVariants: UploadMediaVariantsMap;
  remoteMediaVariants: UploadMediaVariantsMap;
};

const HeaderSearchPopover = ({
  queryTrimmed,
  hasMinimumSearchQueryLength,
  isSearchLoading,
  hasSearchRequestFailed,
  projects,
  posts,
  tagTranslations,
  remoteSuggestions,
  bootstrapMediaVariants,
  remoteMediaVariants,
}: HeaderSearchPopoverProps) => {
  const tagTranslationMap = useMemo(() => buildTranslationMap(tagTranslations), [tagTranslations]);

  const projectItems = useMemo(
    () =>
      projects.map((project) => ({
        label: project.title,
        href: `/projeto/${project.id}`,
        image: project.cover,
        synopsis: project.synopsis,
        tags: selectVisibleTags(
          sortAlphabeticallyPtBr(project.tags.map((tag) => translateTag(tag, tagTranslationMap))),
          2,
          18,
        ),
      })),
    [projects, tagTranslationMap],
  );

  const postItems = useMemo(
    () =>
      posts.map((post) => ({
        label: post.title,
        href: `/postagem/${post.slug}`,
        excerpt: post.excerpt || "",
      })),
    [posts],
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

  const remoteProjects = useMemo(
    () =>
      remoteSuggestions
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
        })),
    [remoteSuggestions, tagTranslationMap],
  );

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
  const synopsisKeys = useMemo(() => activeProjects.map((item) => item.href), [activeProjects]);
  const { rootRef: synopsisRootRef, lineByKey: synopsisLineByKey } = useDynamicSynopsisClamp({
    enabled: true,
    keys: synopsisKeys,
    maxLines: 4,
  });
  const getSynopsisClampClass = (key: string) => {
    const lines = synopsisLineByKey[key] ?? 2;
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

  return (
    <div
      ref={synopsisRootRef}
      data-testid="public-header-results"
      className="search-popover-enter absolute top-12 left-0 right-0 mx-auto max-h-[78vh] w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur-sm md:left-auto md:right-0 md:mx-0 md:w-80"
    >
      {!hasMinimumSearchQueryLength ? (
        <p className="text-sm text-muted-foreground">{uiCopy.search.minimumPrompt}</p>
      ) : isSearchLoading && !hasResults ? (
        <p className="text-sm text-muted-foreground">{uiCopy.search.loadingSuggestions}</p>
      ) : null}

      {hasMinimumSearchQueryLength && activeProjects.length > 0 && (
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
                    data-synopsis-key={item.href}
                    className="min-h-0 min-w-0 flex flex-1 self-stretch flex-col"
                  >
                    <p
                      data-synopsis-role="title"
                      className="line-clamp-1 shrink-0 text-sm font-semibold text-foreground group-hover:text-primary"
                    >
                      {item.label}
                    </p>
                    <p
                      className={cn(
                        "mt-1 min-h-0 flex-1 overflow-hidden text-xs leading-snug text-muted-foreground",
                        getSynopsisClampClass(item.href),
                      )}
                      data-synopsis-role="synopsis"
                    >
                      {item.synopsis}
                    </p>
                    {item.tags.length > 0 && (
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
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasMinimumSearchQueryLength && activePosts.length > 0 && (
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
      )}

      {hasMinimumSearchQueryLength && !isSearchLoading && !hasResults && (
        <p className="text-sm text-muted-foreground">{uiCopy.search.noResults}</p>
      )}
    </div>
  );
};

export default HeaderSearchPopover;
