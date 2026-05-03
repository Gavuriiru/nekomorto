import "@/styles/image-library.css";
import "react-advanced-cropper/dist/style.css";

import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import ImageLibraryBrowserPane from "@/components/image-library/ImageLibraryBrowserPane";
import ImageLibraryDialogs from "@/components/image-library/ImageLibraryDialogs";
import ImageLibraryUploadPanel from "@/components/image-library/ImageLibraryUploadPanel";
import type { ImageLibraryDialogProps } from "@/components/image-library/types";
import useImageLibraryDialogController from "@/components/image-library/useImageLibraryDialogController";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type {
  ImageLibraryDialogProps,
  ImageLibraryOptions,
  ImageLibrarySavePayload,
  LibraryImageItem,
} from "@/components/image-library/types";

const ImageLibraryDialog = ({
  title = "Biblioteca de imagens",
  description = "Selecione imagens do servidor ou dos projetos, depois confirme em Salvar.",
  ...props
}: ImageLibraryDialogProps) => {
  const { uploadPanelProps, browserProps, dialogsProps, footerProps } =
    useImageLibraryDialogController(props);

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent
          className="flex h-[92vh] w-[96vw] max-w-5xl flex-col overflow-hidden p-3 data-[state=open]:animate-none data-[state=closed]:animate-none sm:h-[90vh] sm:w-[92vw] sm:p-6 [&>button]:hidden"
          containerClassName="z-200"
          overlayClassName="z-190 data-[state=open]:animate-none data-[state=closed]:animate-none"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader className="min-w-0 space-y-1 text-left">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-xs leading-snug sm:text-sm">
              {description}
            </DialogDescription>
          </DialogHeader>

          <ImageLibraryUploadPanel {...uploadPanelProps} />
          <ImageLibraryBrowserPane {...browserProps} />

          <div className="sticky bottom-0 z-10 -mx-3 mt-3 flex flex-col gap-3 border-t border-border/60 bg-background/95 px-3 pb-1 pt-3 backdrop-blur sm:static sm:mx-0 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:p-0 sm:pt-4 sm:backdrop-blur-none">
            <div className="flex flex-col gap-2 sm:flex-row">
              {footerProps.allowDeselect ? (
                <DashboardActionButton
                  type="button"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={footerProps.onClearSelection}
                >
                  Limpar seleção
                </DashboardActionButton>
              ) : null}
              {footerProps.onNavigateToUploads ? (
                <DashboardActionButton
                  type="button"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={footerProps.isUploading || footerProps.isNavigatingToUploads}
                  onClick={() => void footerProps.onNavigateToUploads?.()}
                >
                  {footerProps.isNavigatingToUploads ? "Abrindo uploads..." : "Ir para uploads"}
                </DashboardActionButton>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DashboardActionButton
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                onClick={footerProps.onClose}
              >
                Cancelar
              </DashboardActionButton>
              <DashboardActionButton
                type="button"
                size="sm"
                tone="primary"
                className="w-full sm:w-auto"
                onClick={footerProps.onSave}
              >
                Salvar
              </DashboardActionButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImageLibraryDialogs {...dialogsProps} />
    </>
  );
};

export default ImageLibraryDialog;
