export const transitionTiming = {
  fast: "var(--interactive-duration-fast, 180ms)",
  medium: "var(--interactive-duration-medium, 220ms)",
} as const;

export const transitionEasing = {
  standard: "var(--interactive-ease-standard, cubic-bezier(0.16, 1, 0.3, 1))",
} as const;

export const transitionProperty = {
  borderColor: "border-color",
  surface:
    "background-color, border-color, color",
  interactiveControl:
    "transform, box-shadow, background-color, border-color, color, opacity, fill, stroke, text-decoration-color",
  interactiveSurface:
    "transform, box-shadow, background-color, border-color, color, opacity",
  content:
    "color, background-color, border-color, opacity, fill, stroke, text-decoration-color",
  media: "transform, opacity",
} as const;

export const shadowPresets = {
  floatingSoft: "shadow-floating-soft",
  floatingSoftLg: "shadow-floating-soft-lg",
  avatarSubtle: "shadow-avatar-subtle",
  surface: "shadow-dashboard-surface",
} as const;

export const stackedSurface = {
  dashboard: "stacked-surface stacked-surface--dashboard",
  dashboardInteractive:
    "stacked-surface stacked-surface--dashboard stacked-surface--interactive",
  public: "stacked-surface stacked-surface--public",
  publicInteractive:
    "stacked-surface stacked-surface--public stacked-surface--interactive",
} as const;

export const borderPresets = {
  subtle: "border-border/60",
  default: "border-border/70",
  strong: "border-border",
  primaryHover: "hover:border-primary/60",
  primaryHoverSubtle: "hover:border-primary/40",
  dashed: "border-dashed border-border/60",
} as const;

export const revealClassName = {
  container: "reveal",
  hidden: "reveal-hidden",
  visible: "reveal-visible",
} as const;