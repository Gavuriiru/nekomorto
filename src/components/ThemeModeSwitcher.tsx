import { buttonVariants } from "@/components/ui/button-variants";
import { THEME_MODE_PRESERVE_MOTION_ATTRIBUTE } from "@/hooks/theme-mode-context";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";
import { type CSSProperties, useId } from "react";
import "./ThemeModeSwitcher.css";

type ThemeModeSwitcherProps = {
  className?: string;
  buttonClassName?: string;
};

const ThemeModeSwitcher = ({ className, buttonClassName }: ThemeModeSwitcherProps) => {
  const { globalMode, effectiveMode, setPreference } = useThemeMode();
  const isDark = effectiveMode === "dark";
  const clipPathId = `${useId().replace(/:/g, "")}theme-toggle__classic__cutout`;

  const nextMode = isDark ? "light" : "dark";
  const nextModeLabel = nextMode === "light" ? "claro" : "escuro";

  const handleToggle = (nextIsDark: boolean) => {
    const nextPreference = nextIsDark ? "dark" : "light";
    if (nextPreference === globalMode) {
      setPreference("global");
      return;
    }
    setPreference(nextPreference);
  };

  return (
    <button
      type="button"
      className={cn(
        "theme-toggle",
        buttonVariants({ variant: "ghost", size: "icon" }),
        "rounded-full text-foreground/80 hover:bg-accent hover:text-foreground",
        isDark && "theme-toggle--toggled",
        className,
        buttonClassName,
      )}
      style={
        {
          "--theme-toggle__classic--duration": "200ms",
        } as CSSProperties
      }
      aria-label={`Alternar para tema ${nextModeLabel}`}
      title={`Alternar para tema ${nextModeLabel}`}
      aria-pressed={isDark}
      onClick={() => handleToggle(!isDark)}
      {...{ [THEME_MODE_PRESERVE_MOTION_ATTRIBUTE]: "true" }}
    >
      <svg
        aria-hidden="true"
        className={cn("theme-toggle__classic h-4 w-4", isDark ? "scale-100" : "scale-95")}
        fill="currentColor"
        strokeLinecap="round"
        viewBox="0 0 32 32"
      >
        <clipPath id={clipPathId}>
          <path d="M0-5h30a1 1 0 0 0 9 13v24H0Z" />
        </clipPath>
        <g clipPath={`url(#${clipPathId})`}>
          <circle cx="16" cy="16" r="9.34" />
          <g stroke="currentColor" strokeWidth="1.5">
            <path d="M16 5.5v-4" />
            <path d="M16 30.5v-4" />
            <path d="M1.5 16h4" />
            <path d="M26.5 16h4" />
            <path d="m23.4 8.6 2.8-2.8" />
            <path d="m5.7 26.3 2.9-2.9" />
            <path d="m5.8 5.8 2.8 2.8" />
            <path d="m23.4 23.4 2.9 2.9" />
          </g>
        </g>
      </svg>
    </button>
  );
};

export default ThemeModeSwitcher;
