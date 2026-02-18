import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const ThemeIcon = effectiveMode === "dark" ? Moon : Sun;

  const handleToggle = () => {
    if (nextMode === globalMode) {
      setPreference("global");
      return;
    }
    setPreference(nextMode);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-10 w-10 rounded-full border border-border/60 bg-card/50 text-foreground/85 hover:bg-accent hover:text-accent-foreground",
        className,
        buttonClassName,
      )}
      aria-label={`Alternar para tema ${nextModeLabel}`}
      title={`Alternar para tema ${nextModeLabel}`}
      onClick={handleToggle}
    >
      <ThemeIcon className="h-4 w-4" />
    </Button>
  );
};

export default ThemeModeSwitcher;
