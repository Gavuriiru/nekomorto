import type { HTMLAttributes, ReactNode } from "react";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";
import { cn } from "@/lib/utils";

type DashboardPageBadgeProps = HTMLAttributes<HTMLDivElement> & {
  [key: `data-${string}`]: string | number | boolean | undefined;
  children: ReactNode;
  reveal?: boolean;
  wrapperClassName?: string;
};

const DashboardPageBadge = ({
  children,
  className,
  reveal = true,
  wrapperClassName,
  ...props
}: DashboardPageBadgeProps) => {
  return (
    <div
      className={cn("inline-flex", reveal && "reveal reveal-delay-1", wrapperClassName)}
      data-reveal={reveal ? true : undefined}
    >
      <div className={cn(dashboardPageLayoutTokens.headerBadge, className)} {...props}>
        {children}
      </div>
    </div>
  );
};

export default DashboardPageBadge;
