import * as React from "react";

import { cn } from "@/lib/utils";

export interface DashboardSegmentedActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
}

const DashboardSegmentedActionButton = React.forwardRef<
  HTMLButtonElement,
  DashboardSegmentedActionButtonProps
>(({ active, className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={active}
    className={cn(
      "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent px-3.5 text-sm font-semibold shadow-none transition-[background-color,border-color,color,box-shadow] duration-200 hover:shadow-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      active
        ? "border-border/70 bg-background text-foreground"
        : "text-foreground/70 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
      className,
    )}
    {...props}
  />
));

DashboardSegmentedActionButton.displayName = "DashboardSegmentedActionButton";

export default DashboardSegmentedActionButton;
