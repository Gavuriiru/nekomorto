import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardPageHeaderProps = {
  badge: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  descriptionDelayMs?: number;
  actionsDelayMs?: number;
};

const DashboardPageHeader = ({
  badge,
  title,
  description,
  actions,
  className,
  descriptionDelayMs = 140,
  actionsDelayMs = 160,
}: DashboardPageHeaderProps) => {
  return (
    <header
      className={cn("flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", className)}
    >
      <div>
        <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
          {badge}
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-foreground lg:text-4xl animate-slide-up">{title}</h1>
        {description ? (
          <p
            className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
            style={{ animationDelay: `${descriptionDelayMs}ms` } as CSSProperties}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div
          className="flex flex-wrap items-center gap-3 animate-slide-up opacity-0"
          style={{ animationDelay: `${actionsDelayMs}ms` } as CSSProperties}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
};

export default DashboardPageHeader;

