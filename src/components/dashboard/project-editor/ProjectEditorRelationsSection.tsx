import { memo, type Dispatch, type SetStateAction } from "react";

import ReorderControls from "@/components/ReorderControls";
import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import { Input } from "@/components/dashboard/dashboard-form-controls";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import type { ProjectForm, ProjectRelation } from "./dashboard-projects-editor-types";
import ProjectEditorAccordionHeader from "./ProjectEditorAccordionHeader";

const Button = DashboardActionButton;

type ProjectEditorRelationsSectionProps = {
  cardClassName: string;
  contentClassName: string;
  dragOverIndex: number | null;
  onDragEnd: () => void;
  onDragOver: (index: number) => void;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
  onMove: (from: number, to: number) => void;
  relations: ProjectRelation[];
  sectionClassName: string;
  setFormState: Dispatch<SetStateAction<ProjectForm>>;
  triggerClassName: string;
};

const ProjectEditorRelationsSectionComponent = ({
  cardClassName,
  contentClassName,
  dragOverIndex,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onMove,
  relations,
  sectionClassName,
  setFormState,
  triggerClassName,
}: ProjectEditorRelationsSectionProps) => (
  <AccordionItem value="relacoes" className={sectionClassName}>
    <AccordionTrigger className={triggerClassName}>
      <ProjectEditorAccordionHeader title="Relações" subtitle={`${relations.length} itens`} />
    </AccordionTrigger>
    <AccordionContent className={contentClassName}>
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <DashboardActionButton
            type="button"
            size="sm"
            onClick={() =>
              setFormState((prev) => ({
                ...prev,
                relations: [
                  ...prev.relations,
                  { relation: "", title: "", format: "", status: "", image: "" },
                ],
              }))
            }
          >
            Adicionar relação
          </DashboardActionButton>
        </div>
        <div className="grid gap-3">
          {relations.map((relation, index) => (
            <div
              key={`${relation.title}-${index}`}
              className={`grid gap-2 rounded-2xl p-3 md:grid-cols-[1.35fr_1fr_1fr_auto_auto] ${cardClassName} ${
                dragOverIndex === index ? "border-primary/40 bg-primary/5" : ""
              }`}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragEnd={onDragEnd}
              onDragOver={(event) => {
                event.preventDefault();
                onDragOver(index);
              }}
              onDrop={() => onDrop(index)}
            >
              <Input
                value={relation.title}
                onChange={(event) =>
                  setFormState((prev) => {
                    const next = [...prev.relations];
                    next[index] = { ...next[index], title: event.target.value };
                    return { ...prev, relations: next };
                  })
                }
                placeholder="Título"
              />
              <Input
                value={relation.relation}
                onChange={(event) =>
                  setFormState((prev) => {
                    const next = [...prev.relations];
                    next[index] = { ...next[index], relation: event.target.value };
                    return { ...prev, relations: next };
                  })
                }
                placeholder="Relação"
              />
              <Input
                value={relation.projectId || relation.anilistId || ""}
                onChange={(event) =>
                  setFormState((prev) => {
                    const next = [...prev.relations];
                    next[index] = { ...next[index], projectId: event.target.value };
                    return { ...prev, relations: next };
                  })
                }
                placeholder="ID relacionado"
              />
              <ReorderControls
                label={`relação ${index + 1}`}
                index={index}
                total={relations.length}
                onMove={(targetIndex) => onMove(index, targetIndex)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setFormState((prev) => ({
                    ...prev,
                    relations: prev.relations.filter((_, itemIndex) => itemIndex !== index),
                  }))
                }
              >
                Remover
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
);

const ProjectEditorRelationsSection = memo(ProjectEditorRelationsSectionComponent);

ProjectEditorRelationsSection.displayName = "ProjectEditorRelationsSection";

export default ProjectEditorRelationsSection;
