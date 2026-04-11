import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type DashboardActionTone = "neutral" | "primary" | "destructive";
type DashboardActionVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

export interface DashboardActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "variant"> {
  asChild?: boolean;
  tone?: DashboardActionTone;
  variant?: DashboardActionVariant;
}

const DashboardActionButton = React.forwardRef<HTMLButtonElement, DashboardActionButtonProps>(
  ({ className, size, tone, variant, asChild = false, ...props }, ref) => {
    const resolvedVariant =
      tone === "primary"
        ? "default"
        : tone === "destructive"
          ? "destructive"
          : tone === "neutral"
            ? "outline"
            : variant === "default" || variant === "destructive" || variant === "link"
              ? variant
              : "outline";
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant: resolvedVariant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);

DashboardActionButton.displayName = "DashboardActionButton";

export default DashboardActionButton;
