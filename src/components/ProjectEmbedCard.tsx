import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { projectData } from "@/data/projects";

type ProjectEmbedCardProps = {
  projectId?: string | null;
};

const ProjectEmbedCard = ({ projectId }: ProjectEmbedCardProps) => {
  if (!projectId) {
    return null;
  }
  const project = projectData.find((item) => item.id === projectId);
  if (!project) {
    return null;
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <a
            href={`/projeto/${project.id}`}
            className="w-full overflow-hidden rounded-xl border border-border transition sm:w-36 sm:self-stretch hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img
              src={project.cover}
              alt={project.title}
              className="h-full w-full object-cover"
            />
          </a>
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <a
                  href={`/projeto/${project.id}`}
                  className="text-lg font-semibold text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {project.title}
                </a>
                <p className="text-sm text-muted-foreground">{project.synopsis}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:flex-nowrap">
              <Badge variant="secondary">{project.type}</Badge>
              <Badge variant="outline">{project.status}</Badge>
              <Badge variant="outline">{project.studio}</Badge>
              <Badge variant="outline">{project.episodes}</Badge>
            </div>
            <Separator />
            <div className="grid gap-2.5 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  Formato
                </span>
                {project.type}
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  Status
                </span>
                {project.status}
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  EstÃºdio
                </span>
                {project.studio}
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-foreground">
                  EpisÃ³dios
                </span>
                {project.episodes}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectEmbedCard;
