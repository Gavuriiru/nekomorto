import "@theme-toggles/react/css/Classic.css";
import { Classic } from "@theme-toggles/react/dist/index.js";
import { buttonVariants } from "@/components/ui/button-variants";
import { THEME_MODE_PRESERVE_MOTION_ATTRIBUTE } from "@/hooks/theme-mode-context";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";

type ThemeModeSwitcherProps = {
  className?: string;
  buttonClassName?: string;
};

const ThemeModeSwitcher = ({ className, buttonClassName }: ThemeModeSwitcherProps) => {
  const { globalMode, effectiveMode, setPreference } = useThemeMode();

  const nextMode = effectiveMode === "dark" ? "light" : "dark";
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
    <Classic
      type="button"
      duration={200}
      toggled={effectiveMode === "dark"}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "rounded-full text-foreground/80 hover:bg-accent hover:text-foreground",
        className,
        buttonClassName,
      )}
      aria-label={`Alternar para tema ${nextModeLabel}`}
      title={`Alternar para tema ${nextModeLabel}`}
      onToggle={handleToggle}
      {...{ [THEME_MODE_PRESERVE_MOTION_ATTRIBUTE]: "true" }}
    />
  );
};

export default ThemeModeSwitcher;
