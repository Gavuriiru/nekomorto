import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type PillButtonTone = "primary" | "secondary" | "outline";

const pillButtonNeutralToneClassName =
  "border-border/70 bg-background text-foreground/70 hover:border-accent/60 hover:bg-accent/15 hover:text-foreground focus-visible:border-accent/60 focus-visible:bg-accent/15 focus-visible:text-foreground";

const pillButtonToneClassName: Record<PillButtonTone, string> = {
  primary:
    "border-primary/20 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/15 hover:text-primary focus-visible:border-primary/60 focus-visible:bg-primary/15 focus-visible:text-primary",
  secondary: pillButtonNeutralToneClassName,
  outline: pillButtonNeutralToneClassName,
};

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  tone?: PillButtonTone;
}

const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, tone = "outline", asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant: "ghost", size: "pill" }),
          pillButtonToneClassName[tone],
          className,
        )}
        ref={ref}
        type={asChild ? undefined : type}
        {...props}
      />
    );
  },
);

PillButton.displayName = "PillButton";

export { PillButton };
