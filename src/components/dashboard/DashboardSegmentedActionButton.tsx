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
      "inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-foreground/70 hover:bg-background/70 hover:text-foreground",
      className,
    )}
    {...props}
  />
));

DashboardSegmentedActionButton.displayName = "DashboardSegmentedActionButton";

export default DashboardSegmentedActionButton;
