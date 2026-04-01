import type { Dispatch, SetStateAction } from "react";

import ReorderControls from "@/components/ReorderControls";
import { Input } from "@/components/dashboard/dashboard-form-controls";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

import type {
  ProjectForm,
  ProjectRelation,
} from "./dashboard-projects-editor-types";
import ProjectEditorAccordionHeader from "./ProjectEditorAccordionHeader";

type ProjectEditorRelationsSectionProps = {
  contentClassName: string;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
  onMove: (from: number, to: number) => void;
  relations: ProjectRelation[];
  sectionClassName: string;
  setFormState: Dispatch<SetStateAction<ProjectForm>>;
  triggerClassName: string;
};

const ProjectEditorRelationsSection = ({
  contentClassName,
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
      <ProjectEditorAccordionHeader
        title="Relações"
        subtitle={`${relations.length} itens`}
      />
    </AccordionTrigger>
    <AccordionContent className={contentClassName}>
      <div className="space-y-3">
        <div className="flex items-center justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
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
          </Button>
        </div>
        <div className="grid gap-3">
          {relations.map((relation, index) => (
            <div
              key={`${relation.title}-${index}`}
              className="grid gap-2 rounded-2xl border border-border/60 bg-card/60 p-3 md:grid-cols-[1.35fr_1fr_1fr_auto_auto]"
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(event) => event.preventDefault()}
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

export default ProjectEditorRelationsSection;
