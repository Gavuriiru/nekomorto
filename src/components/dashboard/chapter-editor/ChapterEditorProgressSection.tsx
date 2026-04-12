import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import ProjectEditorSectionCard from "@/components/project-reader/ProjectEditorSectionCard";
import { getProjectProgressState } from "@/lib/project-progress";
import { cn } from "@/lib/utils";

type ChapterEditorProgressSectionProps = {
  chapterProgressState: ReturnType<typeof getProjectProgressState>;
  onToggleStage: (stageId: string) => void;
};

const ChapterEditorProgressSection = ({
  chapterProgressState,
  onToggleStage,
}: ChapterEditorProgressSectionProps) => (
  <ProjectEditorSectionCard
    title="Em progresso"
    subtitle="Acompanhe o pipeline editorial do capítulo atual."
    eyebrow="Fluxo editorial"
    testId="chapter-progress-section"
    bodyClassName="space-y-3 py-4"
    actions={
      <Badge variant="outline" className="text-[10px] uppercase tracking-[0.12em]">
        <span data-testid="chapter-progress-percent">{chapterProgressState.progress}%</span>
      </Badge>
    }
  >
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-1.5"
        data-testid="chapter-progress-stage-track"
        role="list"
        aria-label="Resumo visual das etapas editoriais"
      >
        {chapterProgressState.stages.map((stage) => {
          const isCompleted = chapterProgressState.completedStages.includes(stage.id);
          const isCurrentStage = stage.id === chapterProgressState.currentStageId;

          return (
            <span
              key={stage.id}
              role="listitem"
              title={stage.label}
              aria-label={`${stage.label}: ${isCompleted ? "concluída" : isCurrentStage ? "atual" : "pendente"}`}
              data-testid={`chapter-progress-stage-chip-${stage.id}`}
              className={cn(
                "block h-2.5 rounded-full transition-colors",
                isCompleted
                  ? "w-6 bg-primary"
                  : isCurrentStage
                    ? cn("w-10 border border-border/60 bg-background/80", stage.indicatorClassName)
                    : "w-2.5 bg-muted/55",
              )}
            />
          );
        })}
      </div>

      <div
        className="space-y-2"
        data-testid="chapter-progress-stage-list"
        id="chapter-progress-stage-list"
        role="group"
        aria-label="Etapas concluídas"
      >
        {chapterProgressState.stages.map((stage) => {
          const isCompleted = chapterProgressState.completedStages.includes(stage.id);
          const isCurrentStage = stage.id === chapterProgressState.currentStageId;

          return (
            <label
              key={stage.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/35 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={() => onToggleStage(stage.id)}
                  data-testid={`chapter-progress-toggle-${stage.id}`}
                  aria-label={stage.label}
                />
                <span className="truncate text-sm font-medium text-foreground">{stage.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isCurrentStage ? (
                  <Badge variant="accentSoft" className="shrink-0">
                    Atual
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {isCompleted ? "Concluida" : "Pendente"}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  </ProjectEditorSectionCard>
);

export default ChapterEditorProgressSection;
