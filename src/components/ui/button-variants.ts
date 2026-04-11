import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-center text-sm font-semibold shadow-none transition-[background-color,border-color,color] duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary/70 bg-primary/10 text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:border-primary focus-visible:bg-primary focus-visible:text-primary-foreground",
        destructive:
          "border border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive/55 hover:bg-destructive/16 hover:text-destructive focus-visible:border-destructive/55 focus-visible:bg-destructive/16 focus-visible:text-destructive",
        outline:
          "border border-border/70 bg-background text-foreground/70 hover:border-primary/60 hover:bg-primary/5 hover:text-foreground focus-visible:border-primary/60 focus-visible:bg-primary/5 focus-visible:text-foreground",
        secondary:
          "border border-border/70 bg-background text-foreground/70 hover:border-primary/60 hover:bg-primary/5 hover:text-foreground focus-visible:border-primary/60 focus-visible:bg-primary/5 focus-visible:text-foreground",
        ghost:
          "border border-border/70 bg-background text-foreground/70 hover:border-primary/60 hover:bg-primary/5 hover:text-foreground focus-visible:border-primary/60 focus-visible:bg-primary/5 focus-visible:text-foreground",
        link: "rounded-none border border-transparent bg-transparent p-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-3 text-sm",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-8 text-sm",
        toolbar: "h-10 px-4 text-sm",
        compact: "h-8 px-2.5 text-sm",
        pill: "min-h-6 min-w-6 rounded-full px-2.5 py-0.5 text-sm",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    compoundVariants: [
      {
        variant: "link",
        class: "h-auto px-0 py-0",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
