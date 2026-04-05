import { memo } from "react";

import ProjectEditorAccordionHeader from "@/components/dashboard/project-editor/ProjectEditorAccordionHeader";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ProjectEditorMediaTarget = "cover" | "banner" | "hero";

type ProjectEditorMediaSectionProps = {
  banner: string;
  cardClassName: string;
  cover: string;
  editorSectionClassName: string;
  editorSectionContentClassName: string;
  editorSectionTriggerClassName: string;
  heroImageUrl: string;
  onOpenLibrary: (target: ProjectEditorMediaTarget) => void;
};

type ProjectEditorMediaCardProps = {
  alt: string;
  cardClassName: string;
  label: string;
  onOpenLibrary: () => void;
  url: string;
};

const emptyPreviewClassName =
  "flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-[10px] text-muted-foreground leading-tight";

const ProjectEditorMediaCard = ({
  alt,
  cardClassName,
  label,
  onOpenLibrary,
  url,
}: ProjectEditorMediaCardProps) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className={`space-y-2 rounded-2xl px-3 py-2 ${cardClassName}`}>
      <div className="flex items-center gap-3">
        {url ? (
          <img src={url} alt={alt} className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className={emptyPreviewClassName}>Sem imagem</div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={onOpenLibrary}
        >
          Biblioteca
        </Button>
      </div>
    </div>
  </div>
);

const ProjectEditorMediaSectionComponent = ({
  banner,
  cardClassName,
  cover,
  editorSectionClassName,
  editorSectionContentClassName,
  editorSectionTriggerClassName,
  heroImageUrl,
  onOpenLibrary,
}: ProjectEditorMediaSectionProps) => {
  const selectedMediaCount = [heroImageUrl, cover, banner].filter(Boolean).length;

  return (
    <AccordionItem value="midias" className={editorSectionClassName}>
      <AccordionTrigger className={editorSectionTriggerClassName}>
        <ProjectEditorAccordionHeader
          title="Mídias"
          subtitle={`${selectedMediaCount}/3 selecionadas`}
        />
      </AccordionTrigger>
      <AccordionContent className={editorSectionContentClassName}>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <ProjectEditorMediaCard
              label="Imagem do carrossel"
              alt="Imagem do carrossel"
              cardClassName={cardClassName}
              url={heroImageUrl}
              onOpenLibrary={() => onOpenLibrary("hero")}
            />
            <ProjectEditorMediaCard
              label="Capa"
              alt="Capa"
              cardClassName={cardClassName}
              url={cover}
              onOpenLibrary={() => onOpenLibrary("cover")}
            />
            <ProjectEditorMediaCard
              label="Banner"
              alt="Banner"
              cardClassName={cardClassName}
              url={banner}
              onOpenLibrary={() => onOpenLibrary("banner")}
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

const ProjectEditorMediaSection = memo(ProjectEditorMediaSectionComponent);

ProjectEditorMediaSection.displayName = "ProjectEditorMediaSection";

export default ProjectEditorMediaSection;
