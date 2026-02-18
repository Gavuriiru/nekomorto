import { Toaster as Sonner } from "sonner";
import { useThemeMode } from "@/hooks/use-theme-mode";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { effectiveMode } = useThemeMode();

  return (
    <Sonner
      theme={effectiveMode}
      closeButton
      richColors
      duration={4200}
      visibleToasts={4}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-xl border border-border/80 bg-background/95 text-foreground shadow-xl backdrop-blur-sm group-[.toaster]:border-border/80 group-[.toaster]:bg-background/95 group-[.toaster]:text-foreground data-[type=success]:border-emerald-500/35 data-[type=success]:bg-emerald-500/8 data-[type=error]:border-destructive/45 data-[type=error]:bg-destructive/10 data-[type=warning]:border-amber-500/40 data-[type=warning]:bg-amber-500/10 data-[type=info]:border-sky-500/35 data-[type=info]:bg-sky-500/10",
          title: "font-semibold tracking-tight",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:shadow-sm",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:shadow-sm",
          closeButton:
            "group-[.toast]:border-border/70 group-[.toast]:bg-background/80 group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
