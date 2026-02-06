import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import LatestEpisodeCard from "./LatestEpisodeCard";
import WorkStatusCard from "./WorkStatusCard";
import DiscordInviteCard from "./DiscordInviteCard";
import { CalendarDays, User } from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import type { Project } from "@/data/projects";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";

const ReleasesSection = () => {
  const apiBase = getApiBase();
  const pageSize = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const [posts, setPosts] = useState<
    Array<{
      id: string;
      slug: string;
      title: string;
      excerpt: string;
      author: string;
      publishedAt: string;
      coverImageUrl?: string | null;
      projectId?: string;
      tags?: string[];
    }>
  >([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/posts");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setPosts(Array.isArray(data.posts) ? data.posts : []);
        }
      } catch {
        if (isActive) {
          setPosts([]);
        }
      } finally {
        if (isActive) {
          setIsLoadingPosts(false);
        }
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadProjects = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/projects");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProjects(Array.isArray(data.projects) ? data.projects : []);
        }
      } catch {
        if (isActive) {
          setProjects([]);
        }
      }
    };
    loadProjects();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadTranslations = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive) {
          setTagTranslations(data.tags || {});
        }
      } catch {
        if (isActive) {
          setTagTranslations({});
        }
      }
    };
    loadTranslations();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  const totalPages = Math.ceil(posts.length / pageSize) || 1;
  const pagedReleases = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return posts.slice(startIndex, startIndex + pageSize);
  }, [currentPage, posts]);
  const showPagination = totalPages > 1;

  return (
    <section className="py-16 px-6 md:px-12 bg-background reveal" data-reveal>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left side - Release cards (blog posts) */}
          <div className="lg:col-span-2">
            {isLoadingPosts ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`release-skeleton-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <Skeleton className="aspect-[3/2] w-full rounded-lg" />
                    <Skeleton className="mt-4 h-4 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-5/6" />
                  </div>
                ))}
              </div>
            ) : pagedReleases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
                Nenhuma postagem publicada ainda.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {pagedReleases.map((release, index) => {
                  const isOrphan = pagedReleases.length % 2 === 1 && index === pagedReleases.length - 1;
                  const projectTag = release.projectId
                    ? projects.find((project) => project.id === release.projectId)?.tags?.[0] || ""
                    : "";
                  const mainTag = Array.isArray(release.tags) && release.tags.length > 0 ? release.tags[0] : projectTag;
                  const displayTag = mainTag ? tagTranslations[mainTag] || mainTag : "";
                  return (
                    <Link
                      key={release.id}
                      to={`/postagem/${release.slug}`}
                      className={cn(
                        "group reveal",
                        isOrphan && "sm:col-span-2 sm:justify-self-center sm:w-full sm:max-w-[calc((100%-2rem)/2)]"
                      )}
                      data-reveal
                      style={{ transitionDelay: `${index * 80}ms` }}
                    >
                      <Card className="bg-card border-border hover:border-primary/50 transition-all h-full overflow-hidden">
                        <CardContent className="p-0 flex flex-col h-full">
                          <div className="relative w-full aspect-[3/2] overflow-hidden bg-secondary">
                            <img
                              src={normalizeAssetUrl(release.coverImageUrl) || "/placeholder.svg"}
                              alt={release.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            {displayTag ? (
                              <div className="absolute right-3 top-3 flex flex-wrap gap-2">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] uppercase tracking-wide bg-background/85 text-foreground shadow-sm"
                                >
                                  {displayTag}
                                </Badge>
                              </div>
                            ) : null}
                          </div>
                          <div className="p-5 space-y-2">
                            <h3 className="text-xl md:text-2xl font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                              {release.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {release.excerpt || "Sem prévia cadastrada."}
                            </p>
                          </div>
                          <div className="mt-auto px-5 pb-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <User className="h-4 w-4 text-primary/70" aria-hidden="true" />
                              {release.author || "Equipe"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="h-4 w-4 text-primary/70" aria-hidden="true" />
                              {formatDate(release.publishedAt)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
            {showPagination ? (
              <Pagination className="justify-start pt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      className="text-xs"
                      aria-disabled={currentPage === 1}
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage > 1) {
                          setCurrentPage((page) => page - 1);
                        }
                      }}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, index) => {
                    const page = index + 1;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          size="default"
                          isActive={page === currentPage}
                          className="text-xs"
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(page);
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      className="text-xs"
                      aria-disabled={currentPage === totalPages}
                      onClick={(event) => {
                        event.preventDefault();
                        if (currentPage < totalPages) {
                          setCurrentPage((page) => page + 1);
                        }
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>

          {/* Right side - Sidebar */}
          <div className="flex h-full flex-col gap-6">
            <LatestEpisodeCard />
            <WorkStatusCard />
            <DiscordInviteCard />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReleasesSection;




