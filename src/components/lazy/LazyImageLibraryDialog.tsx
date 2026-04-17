import type { ImageLibraryDialogProps } from "@/components/ImageLibraryDialog";
import { ImageLibraryDialogLoadingFallback } from "@/components/ImageLibraryDialogLoading";
import { lazy, type ReactNode, Suspense } from "react";

const ImageLibraryDialog = lazy(() => import("@/components/ImageLibraryDialog"));

type LazyImageLibraryDialogProps = ImageLibraryDialogProps & {
  loadingFallback?: ReactNode;
};

const LazyImageLibraryDialog = ({
  loadingFallback,
  open,
  onOpenChange,
  title,
  description,
  ...props
}: LazyImageLibraryDialogProps) => (
  <Suspense
    fallback={
      open
        ? (loadingFallback ?? (
            <ImageLibraryDialogLoadingFallback
              open={open}
              onOpenChange={onOpenChange}
              title={title}
              description={description}
            />
          ))
        : null
    }
  >
    <ImageLibraryDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      {...props}
    />
  </Suspense>
);

export default LazyImageLibraryDialog;
