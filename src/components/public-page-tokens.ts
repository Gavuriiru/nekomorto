export const publicStrongFocusFieldClassName =
  "focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/45 focus-visible:ring-inset";
export const publicStrongSurfaceHoverClassName = "hover:border-primary/60";
export const publicStrongGroupSurfaceHoverClassName = "group-hover:border-primary/60";
export const publicStrongFocusScopeClassName = "public-strong-focus-scope";
export const publicStackedSurfaceClassName = "stacked-surface stacked-surface--public";
export const publicInteractiveStackedSurfaceClassName = `${publicStackedSurfaceClassName} stacked-surface--interactive`;

export const publicPageLayoutTokens = {
  main: "pb-20",
  sectionBase: "mx-auto w-full px-6 md:px-10",
  sectionSpacing: "space-y-8 md:space-y-10",
  surfaceDefault: "rounded-2xl border border-border/60 bg-card/60",
  surfaceMuted: "rounded-2xl border border-dashed border-border/60 bg-card/60",
  sectionLabelBase:
    "flex items-center gap-3 font-semibold uppercase tracking-widest text-muted-foreground",
  sectionLabelXs: "text-xs",
  sectionLabelSm: "text-sm",
  sectionLabelIcon: "h-4 w-4 text-primary/80",
} as const;
