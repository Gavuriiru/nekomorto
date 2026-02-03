import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getApiBase } from "@/lib/api-base";
import type { Project } from "@/data/projects";

type ProjectEmbedCardProps = {
  projectId?: string | null;
};

const ProjectEmbedCard = ({ projectId }: ProjectEmbedCardProps) => {
  const apiBase = getApiBase();
  const [project, setProject] = useState<Project | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!projectId) {
      return;
    }
    let isActive = true;
    const load = async () => {
      try {
        const response = await fetch(`${apiBase}/api/public/projects/${projectId}`);
        if (!response.ok) {
          if (isActive) {
            setProject(null);
          }
          return;
        }
        const data = await response.json();
        if (isActive) {
          setProject(data.project || null);
        }
      } catch {
        if (isActive) {
          setProject(null);
        }
      } finally {
        if (isActive) {
          setHasLoaded(true);
        }
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, projectId]);

  useEffect(() => {
    let isActive = true;
    const loadTranslations = async () => {
      try {
        const response = await fetch(`${apiBase}/api/public/tag-translations`, { cache: "no-store" });
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

  if (!projectId) {
    return null;
  }
  if (!project && hasLoaded) {
    return null;
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="group flex flex-col gap-4 sm:flex-row sm:items-start">
          <a
            href={`/projeto/${project?.id ?? projectId}`}
            className="w-full overflow-hidden rounded-xl border border-border transition sm:w-32 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ aspectRatio: "23 / 32" }}
          >
            <img
              src={project?.cover || "/placeholder.svg"}
              alt={project?.title || "Projeto"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              style={{ aspectRatio: "23 / 32" }}
            />
          </a>
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary/80">
                {project?.type || ""}
              </p>
              <a
                href={`/projeto/${project?.id ?? projectId}`}
                className="text-lg font-semibold text-foreground transition group-hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {project?.title || "Projeto"}
              </a>
              <p className="text-sm text-muted-foreground line-clamp-2">{project?.synopsis || ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {project?.status ? <Badge variant="outline">{project.status}</Badge> : null}
              {project?.studio ? <Badge variant="outline">{project.studio}</Badge> : null}
              {project?.episodes ? <Badge variant="outline">{project.episodes}</Badge> : null}
            </div>
            {project?.tags?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {project.tags.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[9px] uppercase">
                    {tagTranslations[tag] || tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectEmbedCard;
