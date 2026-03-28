import type {
  ImageLibraryOptions,
  ImageLibrarySavePayload,
} from "@/components/ImageLibraryDialog";
import LazyImageLibraryDialog from "@/components/lazy/LazyImageLibraryDialog";

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
  <LazyImageLibraryDialog
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
);

export default ProjectEditorImageLibraryDialog;
