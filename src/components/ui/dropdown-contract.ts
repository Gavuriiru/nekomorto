import { floatingSurfaceShadowClassName } from "@/components/ui/floating-surface";
import { cn } from "@/lib/utils";

export const dropdownTriggerClassName =
  "group flex min-h-11 min-w-0 w-full flex-nowrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-left text-sm text-foreground shadow-sm transition-colors focus-visible:outline-hidden focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/45 focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground";

export const dropdownChevronClassName =
  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180";

export const dropdownTriggerValueClassName =
  "min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis";

export const dropdownSurfaceClassName = cn(
  "rounded-2xl border border-border/70 bg-popover/95 text-popover-foreground backdrop-blur-sm",
  floatingSurfaceShadowClassName,
);

export const dropdownPopoverClassName = cn(
  "relative z-50 max-h-96 min-w-32 overflow-hidden origin-[var(--radix-select-content-transform-origin)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  dropdownSurfaceClassName,
);

export const dropdownViewportClassName = "p-1";

export const dropdownItemClassName =
  "relative flex min-w-0 w-full flex-nowrap cursor-default select-none items-center rounded-xl py-2 pl-9 pr-3 text-left text-sm text-foreground outline-hidden transition-colors hover:bg-accent/60 hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent/60 data-[highlighted]:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:font-medium data-[state=checked]:text-accent-foreground";

export const dropdownItemTextClassName =
  "min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis";

export const dropdownItemIndicatorClassName =
  "absolute left-3 flex h-4 w-4 items-center justify-center text-current";

export const dropdownRichContentClassName =
  "flex min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-hidden";

export const dropdownRichLabelClassName = "min-w-0 truncate whitespace-nowrap";

export const dropdownRichIconClassName = "h-4 w-4 shrink-0";
