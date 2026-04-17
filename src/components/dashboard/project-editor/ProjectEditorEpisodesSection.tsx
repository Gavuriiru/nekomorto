import ProjectEditorAccordionHeader from "@/components/dashboard/project-editor/ProjectEditorAccordionHeader";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ReactNode } from "react";

export type ProjectEditorEpisodesSectionProps = {
  sectionClassName: string;
  triggerClassName: string;
  contentClassName: string;
  contentPanelClassName?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const ProjectEditorEpisodesSection = ({
  sectionClassName,
  triggerClassName,
  contentClassName,
  contentPanelClassName,
  title,
  subtitle,
  children,
}: ProjectEditorEpisodesSectionProps) => {
  return (
    <AccordionItem value="episodios" className={sectionClassName}>
      <AccordionTrigger className={triggerClassName}>
        <ProjectEditorAccordionHeader title={title} subtitle={subtitle} />
      </AccordionTrigger>
      <AccordionContent className={contentClassName} contentClassName={contentPanelClassName}>
        {children}
      </AccordionContent>
    </AccordionItem>
  );
};

export default ProjectEditorEpisodesSection;
