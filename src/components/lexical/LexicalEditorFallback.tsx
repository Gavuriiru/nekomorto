import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LexicalEditorFallbackProps = {
  variant?: "compact" | "chapter" | "post";
  minHeightClassName?: string;
  className?: string;
  testId?: string;
};

const LexicalEditorFallback = ({
  variant = "compact",
  minHeightClassName,
  className,
  testId,
}: LexicalEditorFallbackProps) => {
  if (variant === "post") {
    return (
      <div
        className={cn(
          "w-full rounded-2xl border border-border/60 bg-card/60 p-6",
          minHeightClassName,
          className,
        )}
        data-testid={testId}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-52 w-full rounded-xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          </div>
        </div>
        <span className="sr-only">Carregando editor...</span>
      </div>
    );
  }

  if (variant === "chapter") {
    return (
      <div
        className={cn(
          "w-full rounded-2xl border border-border/60 bg-card/60 p-4",
          minHeightClassName,
          className,
        )}
        data-testid={testId}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-20 rounded-lg bg-muted/60" />
            <div className="h-8 w-24 rounded-lg bg-muted/60" />
            <div className="h-8 w-32 rounded-lg bg-muted/60" />
          </div>
          <div className="h-10 w-full rounded-xl bg-muted/60" />
          <div className="h-24 w-full rounded-xl bg-muted/60" />
          <div className="h-4 w-full rounded bg-muted/60" />
          <div className="h-4 w-10/12 rounded bg-muted/60" />
          <div className="h-40 w-full rounded-xl bg-muted/60" />
        </div>
        <span className="sr-only">Carregando editor...</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-border/60 bg-card/60 p-4",
        minHeightClassName,
        className,
      )}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-10/12" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <span className="sr-only">Carregando editor...</span>
    </div>
  );
};

export default LexicalEditorFallback;
