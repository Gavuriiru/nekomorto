import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ProjectEditorSectionCardProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  testId?: string;
  children: ReactNode;
};

const sectionClassName =
  "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_52px_-42px_rgba(0,0,0,0.7)]";
const headerClassName =
  "flex flex-col gap-3 border-b border-border/60 px-5 py-4 md:flex-row md:items-start md:justify-between";
const bodyClassName = "space-y-5 px-5 py-5";
const titleClassName = "text-base font-semibold tracking-tight text-foreground";
const subtitleClassName = "text-sm leading-6 text-muted-foreground";

const ProjectEditorSectionCard = ({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
  bodyClassName: customBodyClassName,
  testId,
  children,
}: ProjectEditorSectionCardProps) => (
  <section className={cn(sectionClassName, className)} data-testid={testId}>
    <div className={headerClassName}>
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h2 className={titleClassName}>{title}</h2>
        {subtitle ? <p className={subtitleClassName}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    <div className={cn(bodyClassName, customBodyClassName)}>{children}</div>
  </section>
);

export default ProjectEditorSectionCard;
