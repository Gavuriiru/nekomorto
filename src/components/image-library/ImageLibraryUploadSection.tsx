import type { Dispatch, SetStateAction } from "react";

import { ImageLibraryDialogLoadingGrid } from "@/components/ImageLibraryDialogLoading";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LibraryImageItem, UploadFolderGroup } from "@/components/image-library/types";
import ImageLibraryBrowserCardGrid from "@/components/image-library/ImageLibraryBrowserCardGrid";

type ImageLibraryUploadSectionProps = {
  allowUploadManagementActions: boolean;
  beginAltTextEdit: (item: LibraryImageItem) => void;
  beginFocalPointEdit: (item: LibraryImageItem) => void;
  cropAvatar: boolean;
  isDeleting: boolean;
  isLoading: boolean;
  mode: "single" | "multiple";
  normalizedSearch: string;
  openUploadFolderKeysByGroup: Record<string, string[]>;
  openUploadGroupKeys: string[];
  onRequestDelete: (item: LibraryImageItem) => void;
  onRequestRename: (item: LibraryImageItem) => void;
  selectedResolvedUrlSet: Set<string>;
  selectedUrlsCount: number;
  setOpenUploadFolderKeysByGroup: Dispatch<SetStateAction<Record<string, string[]>>>;
  setOpenUploadGroupKeys: (value: string[]) => void;
  setSortMode: (value: "recent" | "oldest" | "name") => void;
  setSelection: (url: string, options?: { openCrop?: boolean }) => void;
  setUploadCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setUploadsFolderFilter: (value: string) => void;
  shouldRenderUploadsFolderFilter: boolean;
  shouldShowAllFoldersFilterOption: boolean;
  sortMode: "recent" | "oldest" | "name";
  uploadFolderFilterOptionLabels: Record<string, string>;
  uploadFolderFilterOptions: string[];
  uploadFolderGroups: UploadFolderGroup[];
  uploadsFolderFilter: string;
  uploadsLoadError: string;
};

const ImageLibraryUploadSection = ({
  allowUploadManagementActions,
  beginAltTextEdit,
  beginFocalPointEdit,
  cropAvatar,
  isDeleting,
  isLoading,
  mode,
  normalizedSearch,
  openUploadFolderKeysByGroup,
  openUploadGroupKeys,
  onRequestDelete,
  onRequestRename,
  selectedResolvedUrlSet,
  selectedUrlsCount,
  setOpenUploadFolderKeysByGroup,
  setOpenUploadGroupKeys,
  setSortMode,
  setSelection,
  setUploadCardRef,
  setUploadsFolderFilter,
  shouldRenderUploadsFolderFilter,
  shouldShowAllFoldersFilterOption,
  sortMode,
  uploadFolderFilterOptionLabels,
  uploadFolderFilterOptions,
  uploadFolderGroups,
  uploadsFolderFilter,
  uploadsLoadError,
}: ImageLibraryUploadSectionProps) => (
  <div>
    <div
      data-testid="image-library-uploads-controls"
      className="mb-3 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {shouldRenderUploadsFolderFilter ? (
          <Select value={uploadsFolderFilter} onValueChange={setUploadsFolderFilter}>
            <SelectTrigger
              aria-label="Filtrar por pasta"
              className="h-9 min-w-0 w-full flex-1 basis-[11rem] bg-card/70 sm:flex-none sm:w-[220px]"
            >
              <SelectValue placeholder="Todas as pastas" />
            </SelectTrigger>
            <SelectContent
              align="start"
              className="z-[210] origin-[var(--radix-select-content-transform-origin)]"
            >
              {shouldShowAllFoldersFilterOption ? (
                <SelectItem value="__all__">Todas as pastas</SelectItem>
              ) : null}
              {uploadFolderFilterOptions.map((folder) => (
                <SelectItem key={folder} value={folder}>
                  {uploadFolderFilterOptionLabels[folder] || folder}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select
          value={sortMode}
          onValueChange={(value) => setSortMode(value as "recent" | "oldest" | "name")}
        >
          <SelectTrigger
            aria-label="Ordenar biblioteca"
            className="h-9 min-w-0 w-full flex-1 basis-[9.5rem] bg-card/70 sm:flex-none sm:w-[180px]"
          >
            <SelectValue placeholder="Mais recentes" />
          </SelectTrigger>
          <SelectContent
            align="start"
            className="z-[210] origin-[var(--radix-select-content-transform-origin)]"
          >
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="name">Nome</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p
        data-testid="image-library-selection-count"
        className="inline-flex items-center rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
      >
        Selecionadas: {selectedUrlsCount}
      </p>
    </div>
    {isLoading ? (
      <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />
    ) : uploadsLoadError ? (
      <p data-testid="image-library-uploads-error" className="mt-3 text-xs text-destructive">
        {uploadsLoadError}
      </p>
    ) : uploadFolderGroups.length === 0 ? (
      <p className="mt-3 text-xs text-muted-foreground">
        {normalizedSearch || uploadsFolderFilter !== "__all__"
          ? "Nenhum upload corresponde aos filtros atuais."
          : "Nenhum upload disponível."}
      </p>
    ) : (
      <Accordion
        type="multiple"
        value={openUploadGroupKeys}
        onValueChange={setOpenUploadGroupKeys}
        className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3"
      >
        {uploadFolderGroups.map((group) => (
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
                  value={openUploadFolderKeysByGroup[group.key] || []}
                  onValueChange={(nextOpenFolderKeys) =>
                    setOpenUploadFolderKeysByGroup((prev) => ({
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
                          emptyText="Nenhum upload disponível nesta subpasta."
                          isDeleting={isDeleting}
                          isLoading={false}
                          items={folder.items}
                          mode={mode}
                          onRequestDelete={onRequestDelete}
                          onRequestRename={onRequestRename}
                          section="upload"
                          selectedResolvedUrlSet={selectedResolvedUrlSet}
                          setCardRef={setUploadCardRef}
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
                  emptyText={
                    normalizedSearch || uploadsFolderFilter !== "__all__"
                      ? "Nenhum upload corresponde aos filtros atuais."
                      : "Nenhum upload disponível."
                  }
                  isDeleting={isDeleting}
                  isLoading={false}
                  items={group.items}
                  mode={mode}
                  onRequestDelete={onRequestDelete}
                  onRequestRename={onRequestRename}
                  section="upload"
                  selectedResolvedUrlSet={selectedResolvedUrlSet}
                  setCardRef={setUploadCardRef}
                  setSelection={setSelection}
                />
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )}
  </div>
);

export default ImageLibraryUploadSection;
