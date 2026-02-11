import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dashboardPageLayoutTokens } from "@/components/dashboard/dashboard-page-tokens";

const maxWidthClassMap = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

type DashboardPageContainerProps = {
  children: ReactNode;
  maxWidth?: keyof typeof maxWidthClassMap;
  className?: string;
  mainClassName?: string;
};

const DashboardPageContainer = ({
  children,
  maxWidth = "6xl",
  className,
  mainClassName,
}: DashboardPageContainerProps) => {
  return (
    <main className={cn(dashboardPageLayoutTokens.main, mainClassName)}>
      <section
        className={cn(
          dashboardPageLayoutTokens.sectionBase,
          dashboardPageLayoutTokens.sectionSpacing,
          maxWidthClassMap[maxWidth],
          className,
        )}
      >
        {children}
      </section>
    </main>
  );
};

export default DashboardPageContainer;
