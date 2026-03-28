import "react-advanced-cropper/dist/style.css";
import "@/styles/image-library.css";

import ImageLibraryBrowserPane from "@/components/image-library/ImageLibraryBrowserPane";
import ImageLibraryDialogs from "@/components/image-library/ImageLibraryDialogs";
import ImageLibraryUploadPanel from "@/components/image-library/ImageLibraryUploadPanel";
import useImageLibraryDialogController from "@/components/image-library/useImageLibraryDialogController";
import type { ImageLibraryDialogProps } from "@/components/image-library/types";
import { Button } from "@/components/ui/button";
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
          <DialogHeader className="space-y-1">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="text-xs leading-snug sm:text-sm">
              {description}
            </DialogDescription>
          </DialogHeader>

          <ImageLibraryUploadPanel {...uploadPanelProps} />
          <ImageLibraryBrowserPane {...browserProps} />

          <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            {footerProps.allowDeselect ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={footerProps.onClearSelection}
              >
                Limpar selecao
              </Button>
            ) : null}
            {footerProps.onNavigateToUploads ? (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={footerProps.isUploading || footerProps.isNavigatingToUploads}
                onClick={() => void footerProps.onNavigateToUploads?.()}
              >
                {footerProps.isNavigatingToUploads ? "Abrindo uploads..." : "Ir para uploads"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={footerProps.onClose}
            >
              Cancelar
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={footerProps.onSave}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImageLibraryDialogs {...dialogsProps} />
    </>
  );
};

export default ImageLibraryDialog;
