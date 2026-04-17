import { useMemo } from "react";
import { Link } from "react-router-dom";
import { dashboardStrongSurfaceHoverClassName } from "@/components/dashboard/dashboard-page-tokens";
import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { floatingSurfaceShadowClassName } from "@/components/ui/floating-surface";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { PROJECT_COVER_ASPECT_RATIO } from "@/lib/project-card-layout";
import { uiCopy } from "@/lib/ui-copy";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import { cn } from "@/lib/utils";
import type { SearchSuggestion } from "@/types/search-suggestion";

type DashboardSearchPopoverProps = {
  hasMinimumSearchQueryLength: boolean;
  isSearchLoading: boolean;
  hasSearchRequestFailed: boolean;
  remoteSuggestions: SearchSuggestion[];
  remoteMediaVariants: UploadMediaVariantsMap;
};

const DashboardSearchPopover = ({
  hasMinimumSearchQueryLength,
  isSearchLoading,
  hasSearchRequestFailed,
  remoteSuggestions,
  remoteMediaVariants,
}: DashboardSearchPopoverProps) => {
  const remoteProjects = useMemo(
    () =>
      remoteSuggestions
        .filter((suggestion) => suggestion.kind === "project")
        .map((item) => ({
          label: item.label,
          href: item.href,
          image: item.image || "/placeholder.svg",
          synopsis: item.description || item.meta || "",
          tags: Array.isArray(item.tags) ? item.tags.filter(Boolean).slice(0, 4) : [],
        })),
    [remoteSuggestions],
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
  const hasResults = remoteProjects.length > 0 || remotePosts.length > 0;
  const synopsisKeys = useMemo(() => remoteProjects.map((item) => item.href), [remoteProjects]);
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
      data-testid="dashboard-header-results"
      className={cn(
        "search-popover-enter absolute top-12 left-0 right-0 mx-auto max-h-[78vh] w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border/60 bg-background/95 p-4 backdrop-blur-sm xl:left-auto xl:right-0 xl:mx-0 xl:w-80",
        floatingSurfaceShadowClassName,
      )}
    >
      {!hasMinimumSearchQueryLength ? (
        <p className="text-sm text-muted-foreground">{uiCopy.search.minimumPrompt}</p>
      ) : isSearchLoading && !hasResults ? (
        <p className="text-sm text-muted-foreground">{uiCopy.search.loadingSuggestions}</p>
      ) : null}

      {hasMinimumSearchQueryLength && remoteProjects.length > 0 ? (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Projetos
          </p>
          <ul className="no-scrollbar mt-3 max-h-[44vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {remoteProjects.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`group flex h-36 items-start gap-4 overflow-hidden rounded-xl border border-border/60 bg-gradient-card p-4 transition ${dashboardStrongSurfaceHoverClassName} hover:bg-primary/5`}
                >
                  <div
                    className="h-28 shrink-0 self-start overflow-hidden rounded-lg bg-secondary"
                    style={{ aspectRatio: PROJECT_COVER_ASPECT_RATIO }}
                  >
                    <UploadPicture
                      src={item.image}
                      alt={item.label}
                      preset="posterThumb"
                      mediaVariants={remoteMediaVariants}
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
                    {item.tags.length > 0 ? (
                      <div
                        data-synopsis-role="badges"
                        className="flex min-w-0 shrink-0 flex-nowrap gap-1.5 overflow-hidden pb-1 pt-2"
                      >
                        {item.tags.map((tag) => (
                          <Badge
                            key={`${item.href}-${tag}`}
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

      {hasMinimumSearchQueryLength && remotePosts.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Posts
          </p>
          <ul className="no-scrollbar mt-2 max-h-[26vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {remotePosts.map((item) => (
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
        <p className="text-sm text-muted-foreground">
          {hasSearchRequestFailed
            ? "Não foi possível carregar sugestões agora."
            : uiCopy.search.noResults}
        </p>
      ) : null}
    </div>
  );
};

export default DashboardSearchPopover;
