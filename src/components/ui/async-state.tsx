import { cn } from "@/lib/utils";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import { type ReactNode, useEffect } from "react";

type AsyncStateKind = "loading" | "empty" | "error";

type AsyncStateProps = {
  kind?: AsyncStateKind;
  loading?: boolean;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

const iconByKind = {
  loading: Loader2,
  empty: Inbox,
  error: AlertCircle,
} as const;

export const AsyncState = ({
  kind,
  loading = false,
  title,
  description,
  action,
  className,
}: AsyncStateProps) => {
  const effectiveKind: AsyncStateKind = kind ?? (loading ? "loading" : "error");

  useEffect(() => {
    if (!import.meta.env.DEV || import.meta.env.VITEST || kind !== undefined) {
      return;
    }
    console.warn(
      'AsyncState agora exige `kind`. Use `kind="loading" | "empty" | "error"`; `loading` fica apenas como fallback legado.',
    );
  }, [kind]);

  const Icon = iconByKind[effectiveKind];
  const role = effectiveKind === "error" ? "alert" : "status";

  return (
    <div
      role={role}
      aria-live="polite"
      className={cn(
        "rounded-2xl border border-border/60 bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground",
        effectiveKind === "empty" ? "border-dashed bg-card/40" : "",
        effectiveKind === "error" ? "border-destructive/40 bg-destructive/5 text-destructive" : "",
        className,
      )}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
        <span
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground",
            effectiveKind === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "",
          )}
        >
          <Icon className={cn("h-5 w-5", effectiveKind === "loading" ? "animate-spin" : "")} />
        </span>
        <p className="font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-lg text-xs text-muted-foreground">{description}</p>
        ) : null}
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
};

export default AsyncState;
