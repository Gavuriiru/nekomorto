import { Combobox, Input } from "@/components/dashboard/dashboard-form-controls";
import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import ProjectMemberCombobox from "@/components/dashboard/ProjectMemberCombobox";
import ReorderControls from "@/components/ReorderControls";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { translateAnilistRole } from "@/lib/project-taxonomy";
import { type Dispatch, memo, type SetStateAction } from "react";

import type { ProjectForm, ProjectStaff } from "./dashboard-projects-editor-types";
import ProjectEditorAccordionHeader from "./ProjectEditorAccordionHeader";

const Button = DashboardActionButton;

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
            <DashboardActionButton
              type="button"
              size="sm"
              onClick={() =>
                updateStaffEntries((current) => [...current, { role: "", members: [] }])
              }
            >
              Adicionar função
            </DashboardActionButton>
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
                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                  {variant === "fansub" ? (
                    <Combobox
                      value={role.role || ""}
                      onValueChange={(value) =>
                        updateStaffEntries((current) => {
                          const next = [...current];
                          next[index] = { ...next[index], role: value };
                          return next;
                        })
                      }
                      ariaLabel="Selecionar função"
                      options={(role.role && !roleOptions.includes(role.role)
                        ? [role.role, ...roleOptions]
                        : roleOptions
                      ).map((option) => ({
                        value: option,
                        label: option,
                      }))}
                      placeholder="Função"
                      searchable={false}
                    />
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
                  <DashboardActionButton
                    type="button"
                    size="sm"
                    onClick={() => onCommitMember(index)}
                  >
                    Adicionar
                  </DashboardActionButton>
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
