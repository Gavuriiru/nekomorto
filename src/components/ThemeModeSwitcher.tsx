import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThemeModePreference } from "@/hooks/theme-mode-context";
import { useThemeMode } from "@/hooks/use-theme-mode";
import { cn } from "@/lib/utils";

type ThemeModeSwitcherProps = {
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

const themeOptions: Array<{ value: ThemeModePreference; label: string }> = [
  { value: "global", label: "Seguir padrão do site" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

const ThemeModeSwitcher = ({ className, buttonClassName, menuClassName }: ThemeModeSwitcherProps) => {
  const { preference, globalMode, effectiveMode, setPreference } = useThemeMode();

  const ThemeIcon = preference === "global" ? Monitor : effectiveMode === "light" ? Sun : Moon;
  const effectiveLabel = effectiveMode === "light" ? "claro" : "escuro";
  const globalLabel = globalMode === "light" ? "claro" : "escuro";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-10 w-10 rounded-full border border-border/60 bg-card/50 text-foreground/85 hover:bg-accent hover:text-accent-foreground",
            buttonClassName,
          )}
          aria-label={`Alterar tema (atual: ${effectiveLabel})`}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn("w-56 border-border/70 bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-xs", menuClassName, className)}
      >
        <p className="px-2 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Padrão do site: {globalLabel}
        </p>
        {themeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={(event) => {
              event.preventDefault();
              setPreference(option.value);
            }}
            className="focus:bg-accent focus:text-accent-foreground"
          >
            <span className="flex flex-1 items-center gap-2">
              {option.label}
            </span>
            {preference === option.value ? <Check className="h-4 w-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeModeSwitcher;
