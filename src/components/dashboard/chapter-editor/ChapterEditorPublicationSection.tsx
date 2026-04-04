import type { ProjectEpisode } from "@/data/projects";

import { Input } from "@/components/dashboard/dashboard-form-controls";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import ProjectEditorSectionCard from "@/components/project-reader/ProjectEditorSectionCard";
import { chapterStatusLabel } from "@/lib/dashboard-project-chapter";

type ChapterEditorPublicationSectionProps = {
  draft: ProjectEpisode;
  onReleaseDateChange: (nextValue: string) => void;
};

const ChapterEditorPublicationSection = ({
  draft,
  onReleaseDateChange,
}: ChapterEditorPublicationSectionProps) => (
  <ProjectEditorSectionCard
    title="Publicação"
    subtitle="Release, status atual e visibilidade do capítulo"
    eyebrow="Operação"
    testId="chapter-publication-section"
    actions={
      <Badge
        variant={draft.publicationStatus === "draft" ? "outline" : "default"}
        className="text-[10px] uppercase tracking-[0.12em]"
      >
        {chapterStatusLabel(draft)}
      </Badge>
    }
  >
    <div className="grid gap-4">
      <DashboardFieldStack>
        <Label htmlFor="chapter-release-date">Data de release</Label>
        <Input
          id="chapter-release-date"
          type="date"
          value={draft.releaseDate || ""}
          onChange={(event) => onReleaseDateChange(event.target.value)}
        />
      </DashboardFieldStack>

      <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label className="text-sm">Status atual</Label>
            <p className="text-xs text-muted-foreground">
              Use as ações do topo para publicar este capítulo ou voltar para
              rascunho.
            </p>
          </div>
          <Badge
            variant={
              draft.publicationStatus === "draft" ? "outline" : "default"
            }
            className="text-[10px] uppercase tracking-[0.12em]"
          >
            {chapterStatusLabel(draft)}
          </Badge>
        </div>
      </div>
    </div>
  </ProjectEditorSectionCard>
);

export default ChapterEditorPublicationSection;
