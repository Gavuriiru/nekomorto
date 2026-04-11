import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import {
  dashboardPageLayoutTokens,
  dashboardStrongSurfaceHoverClassName,
} from "@/components/dashboard/dashboard-page-tokens";
import { cn } from "@/lib/utils";

const dashboardActionButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-center text-sm font-semibold shadow-none transition-[background-color,border-color,color,box-shadow] duration-200 hover:shadow-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: `${dashboardPageLayoutTokens.cardActionSurface} text-foreground/70 ${dashboardStrongSurfaceHoverClassName} hover:bg-primary/5 hover:text-foreground`,
        primary:
          "border border-primary/55 bg-primary text-primary-foreground hover:border-primary/60 hover:bg-primary/92 hover:text-primary-foreground",
        destructive:
          "border border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive/55 hover:bg-destructive/16 hover:text-destructive",
      },
      size: {
        default: "px-4 py-3 text-sm",
        sm: "h-9 px-3 text-sm",
        toolbar: "h-10 px-4 text-sm",
        compact: "h-8 px-2.5 text-sm",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      tone: "neutral",
      size: "default",
    },
  },
);

export interface DashboardActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof dashboardActionButtonVariants> {
  asChild?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
}

const DashboardActionButton = React.forwardRef<HTMLButtonElement, DashboardActionButtonProps>(
  ({ className, size, tone, variant, asChild = false, ...props }, ref) => {
    const resolvedTone =
      tone ??
      (variant === "default"
        ? "primary"
        : variant === "destructive"
          ? "destructive"
          : "neutral");
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(dashboardActionButtonVariants({ size, tone: resolvedTone }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);

DashboardActionButton.displayName = "DashboardActionButton";

export default DashboardActionButton;
