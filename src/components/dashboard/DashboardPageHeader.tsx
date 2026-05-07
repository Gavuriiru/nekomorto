import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import DashboardPageTransition from "@/components/dashboard/DashboardPageTransition";
import { dashboardMotionDelays } from "@/components/dashboard/dashboard-motion";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  badge: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  descriptionDelayMs?: number;
  actionsDelayMs?: number;
  badgeProps?: { reveal?: boolean; wrapperClassName?: string; className?: string };
};

const DashboardPageHeader = ({
  badge,
  title,
  description,
  actions,
  className,
  descriptionDelayMs = dashboardMotionDelays.headerDescriptionMs,
  actionsDelayMs = dashboardMotionDelays.headerActionsMs,
  badgeProps,
}: DashboardPageHeaderProps) => {
  return (
    <header className={cn(dashboardPageLayoutTokens.header, className)}>
      <div>
        <DashboardPageTransition delayMs={dashboardMotionDelays.headerMetaMs} {...badgeProps}>
          <DashboardPageBadge {...badgeProps}>{badge}</DashboardPageBadge>
        </DashboardPageTransition>
        <DashboardPageTransition>
          <h1 className={dashboardPageLayoutTokens.headerTitle}>{title}</h1>
        </DashboardPageTransition>
        {description ? (
          <DashboardPageTransition delayMs={descriptionDelayMs}>
            <p className={dashboardPageLayoutTokens.headerDescription}>{description}</p>
          </DashboardPageTransition>
        ) : null}
      </div>
      {actions ? (
        <DashboardPageTransition delayMs={actionsDelayMs}>
          <div className={dashboardPageLayoutTokens.headerActions}>{actions}</div>
        </DashboardPageTransition>
      ) : null}
    </header>
  );
};

export default DashboardPageHeader;
