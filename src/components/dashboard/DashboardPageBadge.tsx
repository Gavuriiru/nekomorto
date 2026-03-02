import type { HTMLAttributes, ReactNode } from "react";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
import { cn } from "@/lib/utils";

type DashboardPageBadgeProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  wrapperClassName?: string;
};

const DashboardPageBadge = ({
  children,
  className,
  wrapperClassName,
  ...props
}: DashboardPageBadgeProps) => {
  return (
    <div className={cn("inline-flex reveal reveal-delay-1", wrapperClassName)} data-reveal>
      <div className={cn(dashboardPageLayoutTokens.headerBadge, className)} {...props}>
        {children}
      </div>
    </div>
  );
};

export default DashboardPageBadge;
