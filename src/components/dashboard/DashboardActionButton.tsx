import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import {
  dashboardPageLayoutTokens,
  dashboardStrongSurfaceHoverClassName,
} from "@/components/dashboard/dashboard-page-tokens";
import { cn } from "@/lib/utils";

const dashboardActionButtonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap text-center font-semibold ${dashboardPageLayoutTokens.cardActionSurface} text-foreground/70 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/45 ${dashboardStrongSurfaceHoverClassName} hover:bg-primary/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0`,
  {
    variants: {
      size: {
        default: "px-4 py-3 text-sm",
        sm: "h-9 px-3 text-sm",
        toolbar: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface DashboardActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof dashboardActionButtonVariants> {
  asChild?: boolean;
}

const DashboardActionButton = React.forwardRef<HTMLButtonElement, DashboardActionButtonProps>(
  ({ className, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(dashboardActionButtonVariants({ size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);

DashboardActionButton.displayName = "DashboardActionButton";

export default DashboardActionButton;
