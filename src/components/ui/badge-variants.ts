import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring/45",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success:
          "border-[hsl(var(--badge-success-border))] bg-[hsl(var(--badge-success-bg))] text-[hsl(var(--badge-success-fg))]",
        warning:
          "border-[hsl(var(--badge-warning-border))] bg-[hsl(var(--badge-warning-bg))] text-[hsl(var(--badge-warning-fg))]",
        danger:
          "border-[hsl(var(--badge-danger-border))] bg-[hsl(var(--badge-danger-bg))] text-[hsl(var(--badge-danger-fg))]",
        info: "border-[hsl(var(--badge-info-border))] bg-[hsl(var(--badge-info-bg))] text-[hsl(var(--badge-info-fg))]",
        neutral:
          "border-[hsl(var(--badge-neutral-border))] bg-[hsl(var(--badge-neutral-bg))] text-[hsl(var(--badge-neutral-fg))]",
        accent: "border-accent/60 bg-accent text-accent-foreground",
        accentSoft: "border-accent/60 bg-accent/10 text-accent",
        static: "border-border/70 bg-background text-foreground/70",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);
