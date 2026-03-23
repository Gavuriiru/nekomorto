import {
  dashboardPageLayoutTokens,
  dashboardStrongFocusScopeClassName,
} from "@/components/dashboard/dashboard-page-tokens";
import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const maxWidthClassMap = {
  editor: "max-w-[min(1520px,calc(100vw-1rem))]",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

type DashboardPageContainerProps = {
  children: ReactNode;
  maxWidth?: keyof typeof maxWidthClassMap;
  className?: string;
  mainClassName?: string;
  mainProps?: ComponentPropsWithoutRef<"main">;
  sectionProps?: ComponentPropsWithoutRef<"section">;
  reveal?: boolean;
};

const DashboardPageContainer = ({
  children,
  maxWidth = "6xl",
  className,
  mainClassName,
  mainProps,
  sectionProps,
  reveal = true,
}: DashboardPageContainerProps) => {
  const { className: mainPropsClassName, ...resolvedMainProps } = mainProps || {};
  const { className: sectionPropsClassName, ...resolvedSectionProps } = sectionProps || {};

  return (
    <main
      className={cn(dashboardPageLayoutTokens.main, mainClassName, mainPropsClassName)}
      {...resolvedMainProps}
    >
      <section
        className={cn(
          dashboardStrongFocusScopeClassName,
          dashboardPageLayoutTokens.sectionBase,
          dashboardPageLayoutTokens.sectionSpacing,
          reveal ? "reveal" : null,
          maxWidthClassMap[maxWidth],
          className,
          sectionPropsClassName,
        )}
        data-reveal={reveal ? true : undefined}
        {...resolvedSectionProps}
      >
        {children}
      </section>
    </main>
  );
};

export default DashboardPageContainer;
