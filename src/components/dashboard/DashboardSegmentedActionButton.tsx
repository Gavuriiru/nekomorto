import * as React from "react";

import { buttonVariants } from "@/components/ui/button-variants";
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
      buttonVariants({ variant: "outline", size: "sm" }),
      "px-3.5",
      active
        ? "border-border/70 bg-background text-foreground"
        : "border-transparent text-foreground/70 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
      className,
    )}
    {...props}
  />
));

DashboardSegmentedActionButton.displayName = "DashboardSegmentedActionButton";

export default DashboardSegmentedActionButton;
