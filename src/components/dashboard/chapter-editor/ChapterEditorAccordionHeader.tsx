type ChapterEditorAccordionHeaderProps = {
  title: string;
  subtitle: string;
};

const headerTextClassName = "min-w-0 space-y-1";
const titleClassName = "block text-[13px] font-semibold tracking-tight text-foreground";
const subtitleClassName = "block text-xs leading-5 text-muted-foreground";

export const ChapterEditorAccordionHeader = ({ title, subtitle }: ChapterEditorAccordionHeaderProps) => (
  <div className={headerTextClassName}>
    <span className={titleClassName}>{title}</span>
    <span className={subtitleClassName}>{subtitle}</span>
  </div>
);

export default ChapterEditorAccordionHeader;
