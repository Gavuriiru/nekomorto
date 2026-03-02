import type { CSSProperties, ReactNode } from "react";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import {
  dashboardAnimationDelay,
  dashboardMotionDelays,
} from "@/components/dashboard/dashboard-motion";
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
  descriptionDelayMs = dashboardMotionDelays.headerDescriptionMs,
  actionsDelayMs = dashboardMotionDelays.headerActionsMs,
}: DashboardPageHeaderProps) => {
  return (
    <header className={cn(dashboardPageLayoutTokens.header, className)}>
      <div>
        <DashboardPageBadge>{badge}</DashboardPageBadge>
        <h1 className={dashboardPageLayoutTokens.headerTitle}>{title}</h1>
        {description ? (
          <p
            className={dashboardPageLayoutTokens.headerDescription}
            style={dashboardAnimationDelay(descriptionDelayMs) as CSSProperties}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div
          className={dashboardPageLayoutTokens.headerActions}
          style={dashboardAnimationDelay(actionsDelayMs) as CSSProperties}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
};

export default DashboardPageHeader;
