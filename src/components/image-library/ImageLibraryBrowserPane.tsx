import type { Dispatch, SetStateAction } from "react";

import { ImageLibraryDialogLoadingGrid } from "@/components/ImageLibraryDialogLoading";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  LibraryImageItem,
  ProjectImageGroup,
  UploadFolderGroup,
} from "@/components/image-library/types";
import {
  toEffectiveName,
  toLibraryItemRenderUrl,
} from "@/components/image-library/utils";

export type ImageLibraryBrowserPaneProps = {
  allowUploadManagementActions: boolean;
  beginAltTextEdit: (item: LibraryImageItem) => void;
  beginFocalPointEdit: (item: LibraryImageItem) => void;
  cropAvatar: boolean;
  filteredProjectImages: LibraryImageItem[];
  includeProjectImages: boolean;
  isDeleting: boolean;
  isLoading: boolean;
  mode: "single" | "multiple";
  normalizedSearch: string;
  openProjectFolderKeysByGroup: Record<string, string[]>;
  openProjectGroupKeys: string[];
  openUploadGroupKeys: string[];
  projectImageGroups: ProjectImageGroup[];
  projectImagesView: "flat" | "by-project";
  selectedResolvedUrlSet: Set<string>;
  selectedUrlsCount: number;
  setOpenProjectFolderKeysByGroup: Dispatch<SetStateAction<Record<string, string[]>>>;
  setOpenProjectGroupKeys: (value: string[]) => void;
  setOpenUploadGroupKeys: (value: string[]) => void;
  setProjectCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setSelection: (url: string, options?: { openCrop?: boolean }) => void;
  setSortMode: (value: "recent" | "oldest" | "name") => void;
  setUploadCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setUploadsFolderFilter: (value: string) => void;
  shouldRenderUploadsFolderFilter: boolean;
  shouldShowAllFoldersFilterOption: boolean;
  sortMode: "recent" | "oldest" | "name";
  uploadFolderFilterOptions: string[];
  uploadFolderGroups: UploadFolderGroup[];
  uploadsFolderFilter: string;
  uploadsLoadError: string;
  onRequestDelete: (item: LibraryImageItem) => void;
  onRequestRename: (item: LibraryImageItem) => void;
};

const ImageLibraryBrowserPane = ({
  allowUploadManagementActions,
  beginAltTextEdit,
  beginFocalPointEdit,
  cropAvatar,
  filteredProjectImages,
  includeProjectImages,
  isDeleting,
  isLoading,
  mode,
  normalizedSearch,
  openProjectFolderKeysByGroup,
  openProjectGroupKeys,
  openUploadGroupKeys,
  projectImageGroups,
  projectImagesView,
  selectedResolvedUrlSet,
  selectedUrlsCount,
  setOpenProjectFolderKeysByGroup,
  setOpenProjectGroupKeys,
  setOpenUploadGroupKeys,
  setProjectCardRef,
  setSelection,
  setSortMode,
  setUploadCardRef,
  setUploadsFolderFilter,
  shouldRenderUploadsFolderFilter,
  shouldShowAllFoldersFilterOption,
  sortMode,
  uploadFolderFilterOptions,
  uploadFolderGroups,
  uploadsFolderFilter,
  uploadsLoadError,
  onRequestDelete,
  onRequestRename,
}: ImageLibraryBrowserPaneProps) => {
  const renderGrid = (
    items: LibraryImageItem[],
    emptyText: string,
    options?: { section?: "upload" | "project" },
  ) => {
    if (isLoading) {
      return <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />;
    }
    if (items.length === 0) {
      return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
    }
    const section =
      options?.section ?? (items.some((item) => item.source === "project") ? "project" : "upload");
    const setCardRef = section === "upload" ? setUploadCardRef : setProjectCardRef;
    return (
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const isSelected = selectedResolvedUrlSet.has(item.url);
          const itemRenderUrl = toLibraryItemRenderUrl(item);
          const canRename = allowUploadManagementActions && item.source === "upload";
          const canDelete =
            allowUploadManagementActions && item.source === "upload" && Boolean(item.canDelete);
          const canEditFocal =
            allowUploadManagementActions && item.source === "upload" && Boolean(item.id);
          const canEditAltText =
            allowUploadManagementActions && item.source === "upload" && Boolean(item.id);
          const hasManagementActions = canRename || canDelete || canEditFocal || canEditAltText;
          return (
            <ContextMenu key={`${item.source}:${item.url}`}>
              <ContextMenuTrigger asChild>
                <button
                  ref={(node) => setCardRef(item.url, node)}
                  type="button"
                  data-library-section={section}
                  className={`group overflow-hidden rounded-xl border border-border/60 bg-card/60 text-left transition hover:border-primary/40 ${
                    isSelected ? "ring-2 ring-inset ring-primary/60 border-primary/60" : ""
                  }`}
                  onClick={() =>
                    setSelection(item.url, {
                      openCrop: cropAvatar && mode === "single",
                    })
                  }
                >
                  <img
                    src={itemRenderUrl}
                    alt={toEffectiveName(item)}
                    className="h-28 w-full object-cover"
                  />
                  <div className="p-2 text-xs text-muted-foreground line-clamp-2">
                    {item.label || toEffectiveName(item)}
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56 z-230">
                <ContextMenuLabel>
                  {item.source === "upload" ? "Upload do servidor" : "Imagem de projeto"}
                </ContextMenuLabel>
                <ContextMenuSeparator />
                {cropAvatar && mode === "single" ? (
                  <ContextMenuItem
                    onSelect={() => {
                      setSelection(item.url, { openCrop: true });
                    }}
                  >
                    Editar avatar
                  </ContextMenuItem>
                ) : null}
                {cropAvatar && mode === "single" && hasManagementActions ? (
                  <ContextMenuSeparator />
                ) : null}
                {hasManagementActions ? (
                  <>
                    <ContextMenuItem
                      disabled={!canEditFocal}
                      onSelect={() => {
                        if (!canEditFocal) {
                          return;
                        }
                        beginFocalPointEdit(item);
                      }}
                    >
                      Definir ponto focal
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!canEditAltText}
                      onSelect={() => {
                        if (!canEditAltText) {
                          return;
                        }
                        beginAltTextEdit(item);
                      }}
                    >
                      Editar texto alternativo
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!canRename}
                      onSelect={() => {
                        if (!canRename) {
                          return;
                        }
                        onRequestRename(item);
                      }}
                    >
                      Renomear
                    </ContextMenuItem>
                    <ContextMenuItem
                      disabled={!canDelete || isDeleting}
                      onSelect={() => {
                        if (!canDelete) {
                          return;
                        }
                        onRequestDelete(item);
                      }}
                    >
                      Excluir
                    </ContextMenuItem>
                    {!canRename || !canDelete || !canEditFocal || !canEditAltText ? (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
                          {item.inUse
                            ? "Exclusão bloqueada: imagem em uso."
                            : "Ações indisponíveis."}
                        </ContextMenuLabel>
                      </>
                    ) : null}
                  </>
                ) : null}
                {item.source === "project" ? (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
                      Item somente leitura (projeto). Texto alternativo editável apenas em uploads.
                    </ContextMenuLabel>
                  </>
                ) : null}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    );
  };

  const renderProjectGroups = (groups: ProjectImageGroup[], emptyText: string) => {
    if (isLoading) {
      return <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />;
    }
    if (groups.length === 0) {
      return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
    }
    if (groups.some((group) => group.folders.length > 0)) {
      return (
        <Accordion
          type="multiple"
          value={openProjectGroupKeys}
          onValueChange={setOpenProjectGroupKeys}
          className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3"
        >
          {groups.map((group) => (
            <AccordionItem key={group.key} value={group.key} className="border-border/50">
              <AccordionTrigger className="py-3 text-sm hover:no-underline">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{group.title}</span>
                  <span className="text-xs text-muted-foreground">{group.items.length}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="[&>div]:mt-0">
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
                        {renderGrid(folder.items, "Nenhuma imagem disponivel nesta pasta.", {
                          section: "project",
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );
    }
    return (
      <Accordion
        type="multiple"
        value={openProjectGroupKeys}
        onValueChange={setOpenProjectGroupKeys}
        className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3"
      >
        {groups.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="border-border/50">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{group.title}</span>
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="[&>div]:mt-0">
              {renderGrid(group.items, "Nenhuma imagem disponível neste projeto.")}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  const renderUploadGroups = (groups: UploadFolderGroup[], emptyText: string) => {
    if (isLoading) {
      return <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />;
    }
    if (uploadsLoadError) {
      return (
        <p data-testid="image-library-uploads-error" className="mt-3 text-xs text-destructive">
          {uploadsLoadError}
        </p>
      );
    }
    if (groups.length === 0) {
      return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
    }
    return (
      <Accordion
        type="multiple"
        value={openUploadGroupKeys}
        onValueChange={setOpenUploadGroupKeys}
        className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card/40 px-3"
      >
        {groups.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="border-border/50">
            <AccordionTrigger className="py-3 text-sm hover:no-underline">
              <span className="flex items-center gap-2">
                <span className="font-medium text-foreground">{group.title}</span>
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="[&>div]:mt-0">
              {renderGrid(group.items, "Nenhuma imagem disponivel nesta pasta.")}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div className="mt-3 min-h-0 flex-1 space-y-6 overflow-auto no-scrollbar sm:mt-4 sm:space-y-8">
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
                  className="h-9 min-w-0 w-full flex-1 basis-[11rem] bg-card/70 transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-inset focus:ring-primary/60 focus:ring-offset-0 data-[state=open]:border-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-inset data-[state=open]:ring-primary/60 data-[state=open]:ring-offset-0 sm:flex-none sm:w-[220px]"
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
                      {folder}
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
                className="h-9 min-w-0 w-full flex-1 basis-[9.5rem] bg-card/70 transition-[border-color,box-shadow] focus:border-primary/60 focus:ring-2 focus:ring-inset focus:ring-primary/60 focus:ring-offset-0 data-[state=open]:border-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-inset data-[state=open]:ring-primary/60 data-[state=open]:ring-offset-0 sm:flex-none sm:w-[180px]"
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
        {renderUploadGroups(
          uploadFolderGroups,
          normalizedSearch || uploadsFolderFilter !== "__all__"
            ? "Nenhum upload corresponde aos filtros atuais."
            : "Nenhum upload disponivel.",
        )}
      </div>
      {includeProjectImages ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Imagens dos projetos</h3>
            <span className="text-xs text-muted-foreground">
              Ordenação:{" "}
              {sortMode === "recent"
                ? "mais recentes"
                : sortMode === "oldest"
                  ? "mais antigos"
                  : "nome"}
            </span>
          </div>
          {projectImagesView === "by-project"
            ? renderProjectGroups(
                projectImageGroups,
                normalizedSearch
                  ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
                  : "Nenhuma imagem de projeto encontrada.",
              )
            : renderGrid(
                filteredProjectImages,
                normalizedSearch
                  ? "Nenhuma imagem de projeto encontrada para essa pesquisa."
                  : "Nenhuma imagem de projeto encontrada.",
              )}
        </div>
      ) : null}
    </div>
  );
};

export default ImageLibraryBrowserPane;
