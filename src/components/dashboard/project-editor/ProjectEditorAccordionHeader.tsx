const projectEditorAccordionHeaderTextClassName = "min-w-0 flex-1 space-y-1 text-left";
const projectEditorAccordionTitleClassName =
  "block text-[15px] font-semibold leading-tight md:text-base";
const projectEditorAccordionSubtitleClassName = "block text-xs leading-5 text-muted-foreground";

type ProjectEditorAccordionHeaderProps = {
  title: string;
  subtitle: string;
};

const ProjectEditorAccordionHeader = ({
  title,
  subtitle,
}: ProjectEditorAccordionHeaderProps) => (
  <div className={projectEditorAccordionHeaderTextClassName}>
    <span className={projectEditorAccordionTitleClassName}>{title}</span>
    <span className={projectEditorAccordionSubtitleClassName}>{subtitle}</span>
  </div>
);

export default ProjectEditorAccordionHeader;
