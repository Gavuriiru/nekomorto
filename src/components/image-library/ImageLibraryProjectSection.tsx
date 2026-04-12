import { ImageLibraryDialogLoadingGrid } from "@/components/ImageLibraryDialogLoading";
import type { Dispatch, SetStateAction } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { LibraryImageItem, ProjectImageGroup } from "@/components/image-library/types";
import ImageLibraryBrowserCardGrid from "@/components/image-library/ImageLibraryBrowserCardGrid";

type ImageLibraryProjectSectionProps = {
  allowUploadManagementActions: boolean;
  beginAltTextEdit: (item: LibraryImageItem) => void;
  beginFocalPointEdit: (item: LibraryImageItem) => void;
  cropAvatar: boolean;
  filteredProjectImages: LibraryImageItem[];
  isDeleting: boolean;
  isLoading: boolean;
  mode: "single" | "multiple";
  normalizedSearch: string;
  onRequestDelete: (item: LibraryImageItem) => void;
  onRequestRename: (item: LibraryImageItem) => void;
  openProjectFolderKeysByGroup: Record<string, string[]>;
  openProjectGroupKeys: string[];
  projectImageGroups: ProjectImageGroup[];
  projectImagesView: "flat" | "by-project";
  selectedResolvedUrlSet: Set<string>;
  setOpenProjectFolderKeysByGroup: Dispatch<SetStateAction<Record<string, string[]>>>;
  setOpenProjectGroupKeys: (value: string[]) => void;
  setProjectCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setSelection: (url: string, options?: { openCrop?: boolean }) => void;
  sortMode: "recent" | "oldest" | "name";
};

const ImageLibraryProjectSection = ({
  allowUploadManagementActions,
  beginAltTextEdit,
  beginFocalPointEdit,
  cropAvatar,
  filteredProjectImages,
  isDeleting,
  isLoading,
  mode,
  normalizedSearch,
  onRequestDelete,
  onRequestRename,
  openProjectFolderKeysByGroup,
  openProjectGroupKeys,
  projectImageGroups,
  projectImagesView,
  selectedResolvedUrlSet,
  setOpenProjectFolderKeysByGroup,
  setOpenProjectGroupKeys,
  setProjectCardRef,
  setSelection,
  sortMode,
}: ImageLibraryProjectSectionProps) => (
  <div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-foreground">Imagens dos projetos</h3>
      <span className="text-xs text-muted-foreground">
        Ordenação:{" "}
        {sortMode === "recent" ? "mais recentes" : sortMode === "oldest" ? "mais antigos" : "nome"}
      </span>
    </div>
    {isLoading ? (
      <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />
    ) : projectImagesView === "by-project" && projectImageGroups.length === 0 ? (
      <p className="mt-3 text-xs text-muted-foreground">
        {normalizedSearch
          ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
          : "Nenhuma imagem de projeto encontrada."}
      </p>
    ) : projectImagesView === "by-project" ? (
      <Accordion
        type="multiple"
        value={openProjectGroupKeys}
        onValueChange={setOpenProjectGroupKeys}
        className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3"
      >
        {projectImageGroups.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="border-border/50">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{group.title}</span>
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="[&>div]:mt-0">
              {group.folders.length > 0 ? (
                <Accordion
                  type="multiple"
                  value={openProjectFolderKeysByGroup[group.key] || []}
                  onValueChange={(nextOpenFolderKeys) =>
                    setOpenProjectFolderKeysByGroup((prev) => ({
                      ...prev,
                      [group.key]: nextOpenFolderKeys,
                    }))
                  }
                  className="rounded-lg border border-border/40 bg-background/40 px-2"
                >
                  {group.folders.map((folder) => (
                    <AccordionItem key={folder.key} value={folder.key} className="border-border/40">
                      <AccordionTrigger className="py-2 text-xs hover:no-underline">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-foreground/90">{folder.title}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {folder.items.length}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="[&>div]:mt-0">
                        <ImageLibraryBrowserCardGrid
                          allowUploadManagementActions={allowUploadManagementActions}
                          beginAltTextEdit={beginAltTextEdit}
                          beginFocalPointEdit={beginFocalPointEdit}
                          cropAvatar={cropAvatar}
                          emptyText="Nenhuma imagem disponível nesta pasta."
                          isDeleting={isDeleting}
                          isLoading={false}
                          items={folder.items}
                          mode={mode}
                          onRequestDelete={onRequestDelete}
                          onRequestRename={onRequestRename}
                          section="project"
                          selectedResolvedUrlSet={selectedResolvedUrlSet}
                          setCardRef={setProjectCardRef}
                          setSelection={setSelection}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <ImageLibraryBrowserCardGrid
                  allowUploadManagementActions={allowUploadManagementActions}
                  beginAltTextEdit={beginAltTextEdit}
                  beginFocalPointEdit={beginFocalPointEdit}
                  cropAvatar={cropAvatar}
                  emptyText="Nenhuma imagem disponível neste projeto."
                  isDeleting={isDeleting}
                  isLoading={false}
                  items={group.items}
                  mode={mode}
                  onRequestDelete={onRequestDelete}
                  onRequestRename={onRequestRename}
                  section="project"
                  selectedResolvedUrlSet={selectedResolvedUrlSet}
                  setCardRef={setProjectCardRef}
                  setSelection={setSelection}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    ) : (
      <ImageLibraryBrowserCardGrid
        allowUploadManagementActions={allowUploadManagementActions}
        beginAltTextEdit={beginAltTextEdit}
        beginFocalPointEdit={beginFocalPointEdit}
        cropAvatar={cropAvatar}
        emptyText={
          normalizedSearch
            ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
            : "Nenhuma imagem de projeto encontrada."
        }
        isDeleting={isDeleting}
        isLoading={false}
        items={filteredProjectImages}
        mode={mode}
        onRequestDelete={onRequestDelete}
        onRequestRename={onRequestRename}
        section="project"
        selectedResolvedUrlSet={selectedResolvedUrlSet}
        setCardRef={setProjectCardRef}
        setSelection={setSelection}
      />
    )}
  </div>
);

export default ImageLibraryProjectSection;
