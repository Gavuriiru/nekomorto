import { memo } from "react";

import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import { Input } from "@/components/dashboard/dashboard-form-controls";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";

import ProjectEditorAccordionHeader from "./ProjectEditorAccordionHeader";

type ProjectEditorImportSectionProps = {
  anilistIdInput: string;
  contentClassName: string;
  onAnilistIdInputChange: (nextValue: string) => void;
  onImportAniList: () => void | Promise<void>;
  sectionClassName: string;
  triggerClassName: string;
};

const ProjectEditorImportSectionComponent = ({
  anilistIdInput,
  contentClassName,
  onAnilistIdInputChange,
  onImportAniList,
  sectionClassName,
  triggerClassName,
}: ProjectEditorImportSectionProps) => (
  <AccordionItem value="importacao" className={sectionClassName}>
    <AccordionTrigger className={triggerClassName}>
      <ProjectEditorAccordionHeader title="Importação" subtitle="Preenchimento automático" />
    </AccordionTrigger>
    <AccordionContent className={contentClassName}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <DashboardFieldStack>
            <Label htmlFor="anilist-id-input">ID ou URL do AniList</Label>
            <Input
              id="anilist-id-input"
              value={anilistIdInput}
              onChange={(event) => onAnilistIdInputChange(event.target.value)}
              placeholder="Ex.: 21366 ou https://anilist.co/manga/97894/..."
            />
          </DashboardFieldStack>
          <DashboardActionButton
            type="button"
            size="toolbar"
            className="self-end"
            onClick={() => void onImportAniList()}
          >
            Importar do AniList
          </DashboardActionButton>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
);

export const ProjectEditorImportSection = memo(ProjectEditorImportSectionComponent);

ProjectEditorImportSection.displayName = "ProjectEditorImportSection";

export default ProjectEditorImportSection;
