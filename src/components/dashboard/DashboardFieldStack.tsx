import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type DashboardFieldStackProps = HTMLAttributes<HTMLDivElement> & {
  density?: "default" | "compact";
};

const densityClassName: Record<NonNullable<DashboardFieldStackProps["density"]>, string> = {
  default: "flex flex-col gap-2 [&>label]:block",
  compact: "flex flex-col gap-2 [&>label]:block",
};

const DashboardFieldStack = ({
  children,
  className,
  density = "default",
  ...props
}: DashboardFieldStackProps) => (
  <div className={cn(densityClassName[density], className)} {...props}>
    {children}
  </div>
);

export default DashboardFieldStack;
