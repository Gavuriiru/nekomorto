export const dashboardPageLayoutTokens = {
  main: "pt-24",
  sectionBase: "mx-auto w-full px-6 pb-20 md:px-10",
  sectionSpacing: "space-y-8 md:space-y-10",
  header: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
  headerActions: "flex flex-wrap items-center gap-3 animate-slide-up opacity-0",
  headerBadge:
    "inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground",
  headerDescription: "mt-2 text-sm leading-6 text-muted-foreground animate-slide-up opacity-0",
  headerTitle: "mt-4 text-3xl font-semibold text-foreground lg:text-4xl animate-slide-up",
  surfaceDefault: "rounded-2xl border border-border/60 bg-card/60",
  surfaceMuted: "rounded-2xl border border-border/60 bg-card/40",
  listCard: "rounded-2xl border border-border/60 bg-card/80 shadow-lg",
} as const;
