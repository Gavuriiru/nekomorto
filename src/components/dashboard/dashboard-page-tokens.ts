export const dashboardStrongFocusFieldClassName =
  "focus-visible:border-primary";
export const dashboardStrongSurfaceHoverClassName = "hover:border-primary/60";
export const dashboardSubtleSurfaceHoverClassName =
  "transition-[border-color,background-color] duration-200 hover:border-primary/40";
export const dashboardStrongFocusScopeClassName = "dashboard-strong-focus-scope";
export const dashboardStrongFocusTriggerClassName = "dashboard-strong-focus-trigger";
export const dashboardEditorDialogWidthClassName = "max-w-[min(1760px,calc(100vw-1rem))]";

export const dashboardPageLayoutTokens = {
  main: "pt-24",
  sectionBase: "mx-auto w-full px-6 pb-20 md:px-10",
  sectionSpacing: "space-y-8 md:space-y-10",
  header: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
  headerActions: "flex flex-wrap items-center gap-3 animate-slide-up opacity-0",
  headerBadge:
    "inline-flex items-center gap-3 rounded-full border border-border/70 bg-background px-4 py-2 text-xs font-medium uppercase tracking-[0.3em] text-foreground/70",
  headerDescription: "mt-2 text-sm leading-6 text-foreground/70 animate-slide-up opacity-0",
  headerTitle: "mt-4 text-3xl font-semibold text-foreground lg:text-4xl animate-slide-up",
  surfaceDefault: "rounded-2xl border border-border/60 bg-card/60",
  surfaceMuted: "rounded-2xl border border-border/60 bg-card/40",
  listCard: "rounded-2xl border border-border/60 bg-card/80 shadow-lg",
  surfaceSolid:
    `rounded-2xl border border-border/70 bg-card shadow-[0_18px_38px_-30px_rgba(0,0,0,0.82)] transition-[border-color] duration-200 ${dashboardStrongSurfaceHoverClassName}`,
  surfaceInset: "rounded-2xl border border-border/70 bg-background",
  listCardSolid:
    "rounded-2xl border border-border/70 bg-card shadow-[0_20px_40px_-32px_rgba(0,0,0,0.8)]",
  cardMetaText: "text-foreground/70",
  cardActionSurface: "rounded-xl border border-border/70 bg-background",
  cardChip: "border border-border/70 bg-background text-foreground/70",
  controlSurface: "rounded-xl border border-border/70 bg-background",
  groupedFieldSurface: "rounded-2xl border border-border/70 bg-background",
  tableHeadSurface: "bg-background text-foreground/70",
} as const;
