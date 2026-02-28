import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";

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
    <header className={cn(dashboardPageLayoutTokens.header, className)}>
      <div>
        <div className={dashboardPageLayoutTokens.headerBadge}>{badge}</div>
        <h1 className={dashboardPageLayoutTokens.headerTitle}>{title}</h1>
        {description ? (
          <p
            className={dashboardPageLayoutTokens.headerDescription}
            style={{ animationDelay: `${descriptionDelayMs}ms` } as CSSProperties}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div
          className={dashboardPageLayoutTokens.headerActions}
          style={{ animationDelay: `${actionsDelayMs}ms` } as CSSProperties}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
};

export default DashboardPageHeader;
