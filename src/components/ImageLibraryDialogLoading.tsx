import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ImageLibraryDialogLoadingGridProps = {
  className?: string;
  showSidebar?: boolean;
  testId?: string;
};

type ImageLibraryDialogLoadingFallbackProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
};

const ImageLibraryDialogLoadingGrid = ({
  className,
  showSidebar = false,
  testId,
}: ImageLibraryDialogLoadingGridProps) => {
  if (!showSidebar) {
    return (
      <div
        className={cn("space-y-4", className)}
        data-testid={testId}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`image-library-loading-item-${index}`}
              className="overflow-hidden rounded-xl border border-border/60 bg-card/60"
            >
              <Skeleton className="h-28 w-full rounded-none" />
              <div className="space-y-2 p-2">
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Carregando biblioteca de imagens</span>
      </div>
    );
  }

  return (
    <div
      className={cn("mt-2 grid gap-2 sm:gap-3 lg:grid-cols-[1.25fr_0.95fr]", className)}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-3 sm:p-4">
        <div
          data-testid="image-library-loading-toolbar"
          className="rounded-xl border border-border/60 bg-background/60 px-3 py-3"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <ImageLibraryDialogLoadingGrid />
      </div>
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-3 sm:p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>
      <span className="sr-only">Carregando biblioteca de imagens</span>
    </div>
  );
};

const ImageLibraryDialogLoadingFallback = ({
  open,
  onOpenChange,
  title = "Biblioteca de imagens",
  description = "Carregando imagens e controles da biblioteca.",
}: ImageLibraryDialogLoadingFallbackProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      className="z-200 flex h-[92vh] w-[96vw] max-w-5xl flex-col overflow-hidden p-3 data-[state=open]:animate-none data-[state=closed]:animate-none sm:h-[90vh] sm:w-[92vw] sm:p-6 [&>button]:hidden"
      overlayClassName="z-190 data-[state=open]:animate-none data-[state=closed]:animate-none"
    >
      <div role="status" aria-live="polite" aria-busy="true" className="min-h-0 flex flex-1 flex-col">
        <DialogHeader className="space-y-1">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-xs leading-snug sm:text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>
        <ImageLibraryDialogLoadingGrid
          showSidebar
          className="min-h-0 flex-1"
          testId="image-library-loading-fallback-grid"
        />
      </div>
    </DialogContent>
  </Dialog>
);

export { ImageLibraryDialogLoadingFallback, ImageLibraryDialogLoadingGrid };
