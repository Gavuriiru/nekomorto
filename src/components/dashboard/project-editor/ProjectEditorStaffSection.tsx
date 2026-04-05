import { memo, type Dispatch, type SetStateAction } from "react";

import ReorderControls from "@/components/ReorderControls";
import ProjectMemberCombobox from "@/components/dashboard/ProjectMemberCombobox";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/dashboard/dashboard-form-controls";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { translateAnilistRole } from "@/lib/project-taxonomy";

import type { ProjectForm, ProjectStaff } from "./dashboard-projects-editor-types";
import ProjectEditorAccordionHeader from "./ProjectEditorAccordionHeader";

type StaffFieldKey = "staff" | "animeStaff";

type ProjectEditorStaffSectionProps = {
  cardClassName: string;
  contentClassName: string;
  dragOverIndex: number | null;
  memberDirectory: string[];
  memberInput: Record<number, string>;
  onCommitMember: (index: number, member?: string) => void;
  onDragEnd: () => void;
  onDragOver: (index: number) => void;
  onDragStart: (index: number) => void;
  onDrop: (index: number) => void;
  onMove: (from: number, to: number) => void;
  roleOptions?: string[];
  roleTranslationMap?: Map<string, string>;
  sectionClassName: string;
  sectionValue: string;
  setFormState: Dispatch<SetStateAction<ProjectForm>>;
  setMemberInput: Dispatch<SetStateAction<Record<number, string>>>;
  shiftDraftAfterRemoval: (
    draft: Record<number, string>,
    removedIndex: number,
  ) => Record<number, string>;
  staffEntries: ProjectStaff[];
  staffKey: StaffFieldKey;
  title: string;
  triggerClassName: string;
  variant: "anime" | "fansub";
};

const ProjectEditorStaffSectionComponent = ({
  cardClassName,
  contentClassName,
  dragOverIndex,
  memberDirectory,
  memberInput,
  onCommitMember,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onMove,
  roleOptions = [],
  roleTranslationMap,
  sectionClassName,
  sectionValue,
  setFormState,
  setMemberInput,
  shiftDraftAfterRemoval,
  staffEntries,
  staffKey,
  title,
  triggerClassName,
  variant,
}: ProjectEditorStaffSectionProps) => {
  const updateStaffEntries = (updater: (current: ProjectStaff[]) => ProjectStaff[]) => {
    setFormState((prev) => {
      const nextEntries = updater(prev[staffKey]);
      return staffKey === "staff"
        ? { ...prev, staff: nextEntries }
        : { ...prev, animeStaff: nextEntries };
    });
  };

  return (
    <AccordionItem value={sectionValue} className={sectionClassName}>
      <AccordionTrigger className={triggerClassName}>
        <ProjectEditorAccordionHeader title={title} subtitle={`${staffEntries.length} funções`} />
      </AccordionTrigger>
      <AccordionContent className={contentClassName}>
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                updateStaffEntries((current) => [...current, { role: "", members: [] }])
              }
            >
              Adicionar função
            </Button>
          </div>
          <div className="grid gap-3">
            {staffEntries.map((role, index) => (
              <div
                key={`${role.role}-${index}`}
                className={`rounded-2xl p-3 ${cardClassName} ${
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
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  {variant === "fansub" ? (
                    <Select
                      value={role.role || ""}
                      onValueChange={(value) =>
                        updateStaffEntries((current) => {
                          const next = [...current];
                          next[index] = { ...next[index], role: value };
                          return next;
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Função" />
                      </SelectTrigger>
                      <SelectContent>
                        {(role.role && !roleOptions.includes(role.role)
                          ? [role.role, ...roleOptions]
                          : roleOptions
                        ).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        value={role.role || ""}
                        onChange={(event) =>
                          updateStaffEntries((current) => {
                            const next = [...current];
                            next[index] = { ...next[index], role: event.target.value };
                            return next;
                          })
                        }
                        placeholder="Função"
                      />
                      {String(role.role || "").trim() ? (
                        <p className="text-[11px] text-muted-foreground">
                          {translateAnilistRole(role.role, roleTranslationMap ?? new Map())}
                        </p>
                      ) : null}
                    </div>
                  )}
                  <ReorderControls
                    label={`${variant === "anime" ? "funcao do anime" : "funcao da fansub"} ${
                      index + 1
                    }`}
                    index={index}
                    total={staffEntries.length}
                    onMove={(targetIndex) => onMove(index, targetIndex)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      updateStaffEntries((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      );
                      setMemberInput((prev) => shiftDraftAfterRemoval(prev, index));
                    }}
                  >
                    Remover
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ProjectMemberCombobox
                    value={memberInput[index] || ""}
                    options={memberDirectory}
                    onValueChange={(nextValue) =>
                      setMemberInput((prev) => ({
                        ...prev,
                        [index]: nextValue,
                      }))
                    }
                    onCommit={(member) => onCommitMember(index, member)}
                    placeholder="Adicionar membro"
                  />
                  <Button type="button" variant="outline" onClick={() => onCommitMember(index)}>
                    Adicionar
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(role.members || []).map((member) =>
                    variant === "anime" ? (
                      <Badge key={member} variant="secondary" className="flex items-center gap-1">
                        <span>{member}</span>
                        <button
                          type="button"
                          className="rounded-sm p-0.5 text-muted-foreground transition hover:text-foreground"
                          onClick={() =>
                            updateStaffEntries((current) => {
                              const next = [...current];
                              next[index] = {
                                ...next[index],
                                members: (next[index].members || []).filter(
                                  (item) => item !== member,
                                ),
                              };
                              return next;
                            })
                          }
                          aria-label={`Remover ${member}`}
                        >
                          x
                        </button>
                      </Badge>
                    ) : (
                      <Badge key={member} variant="secondary">
                        {member}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

const ProjectEditorStaffSection = memo(ProjectEditorStaffSectionComponent);

ProjectEditorStaffSection.displayName = "ProjectEditorStaffSection";

export default ProjectEditorStaffSection;
