import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

type DashboardPageTransitionProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
  className?: string;
  reveal?: boolean;
  delayMs?: number;
};

const DashboardPageTransition = ({
  children,
  className,
  reveal = true,
  delayMs,
  ...props
}: DashboardPageTransitionProps) => {
  return (
    <div
      className={cn("animate-slide-up", reveal && "reveal", className)}
      data-reveal={reveal ? true : undefined}
      data-dashboard-transition="true"
      style={delayMs ? { "--tw-enter-delay": `${delayMs}ms` } as CSSProperties : undefined}
      {...props}
    >
      {children}
    </div>
  );
};

export default DashboardPageTransition;
