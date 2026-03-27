import type {
  ImageLibraryOptions,
  ImageLibrarySavePayload,
} from "@/components/ImageLibraryDialog";
import { ImageLibraryDialogLoadingFallback } from "@/components/ImageLibraryDialogLoading";
import { Suspense, lazy } from "react";

const ImageLibraryDialog = lazy(() => import("@/components/ImageLibraryDialog"));

type ProjectEditorImageLibraryDialogProps = {
  activeLibraryOptions: ImageLibraryOptions;
  apiBase: string;
  currentLibrarySelection: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: ImageLibrarySavePayload) => void;
};

const dialogDescription =
  "Envie novas imagens ou selecione uma existente para usar no projeto.";

const ProjectEditorImageLibraryDialog = ({
  activeLibraryOptions,
  apiBase,
  currentLibrarySelection,
  isOpen,
  onOpenChange,
  onSave,
}: ProjectEditorImageLibraryDialogProps) => (
  <Suspense
    fallback={
      isOpen ? (
        <ImageLibraryDialogLoadingFallback
          open={isOpen}
          onOpenChange={onOpenChange}
          description={dialogDescription}
        />
      ) : null
    }
  >
    <ImageLibraryDialog
      open={isOpen}
      onOpenChange={onOpenChange}
      apiBase={apiBase}
      description={dialogDescription}
      uploadFolder={activeLibraryOptions.uploadFolder}
      listFolders={activeLibraryOptions.listFolders}
      listAll={activeLibraryOptions.listAll}
      includeProjectImages={activeLibraryOptions.includeProjectImages}
      projectImageProjectIds={activeLibraryOptions.projectImageProjectIds}
      projectImagesView={activeLibraryOptions.projectImagesView}
      allowDeselect
      mode="single"
      currentSelectionUrls={currentLibrarySelection ? [currentLibrarySelection] : []}
      onSave={onSave}
    />
  </Suspense>
);

export default ProjectEditorImageLibraryDialog;
