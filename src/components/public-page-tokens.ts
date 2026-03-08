export const publicPageLayoutTokens = {
  main: "pb-20",
  sectionBase: "mx-auto w-full px-6 md:px-10",
  sectionSpacing: "space-y-8 md:space-y-10",
  surfaceDefault: "rounded-2xl border border-border/60 bg-card/60",
  surfaceMuted: "rounded-2xl border border-dashed border-border/60 bg-card/60",
  sectionLabelBase:
    "flex items-center gap-3 font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-foreground",
  sectionLabelXs: "text-xs",
  sectionLabelSm: "text-sm",
  sectionLabelIcon:
    "h-4 w-4 text-primary/80 transition-colors duration-300 group-hover:text-primary",
} as const;
