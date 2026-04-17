import { type Dispatch, type SetStateAction, useRef } from "react";

import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import AvatarCropWorkspace from "@/components/image-library/AvatarCropWorkspace";
import FocalPointWorkspace from "@/components/image-library/FocalPointWorkspace";
import type { LibraryImageItem } from "@/components/image-library/types";
import { toEffectiveName, toLibraryItemRenderUrl } from "@/components/image-library/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UploadFocalCrops, UploadFocalPresetKey } from "@/lib/upload-focal-points";

const focusFirstAvailable = (...targets: Array<HTMLElement | null>) => {
  for (const target of targets) {
    if (!target) {
      continue;
    }
    if ("disabled" in target && Boolean(target.disabled)) {
      continue;
    }
    target.focus();
    return;
  }
};

export type ImageLibraryAvatarCropDialogProps = {
  applyCrop: (dataUrl: string) => Promise<void>;
  isApplyingCrop: boolean;
  isCropDialogOpen: boolean;
  primarySelectedRenderKey: string;
  primarySelectedRenderUrl: string;
  primarySelectedUrl: string;
  setIsCropDialogOpen: (value: boolean) => void;
};

export const ImageLibraryAvatarCropDialog = ({
  applyCrop,
  isApplyingCrop,
  isCropDialogOpen,
  primarySelectedRenderKey,
  primarySelectedRenderUrl,
  primarySelectedUrl,
  setIsCropDialogOpen,
}: ImageLibraryAvatarCropDialogProps) => {
  const applyButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Dialog
      open={isCropDialogOpen}
      onOpenChange={(next) => {
        if (next) {
          setIsCropDialogOpen(true);
          return;
        }
        setIsCropDialogOpen(false);
      }}
    >
      <DialogContent
        className="max-h-[92vh] max-w-xl overflow-auto data-[state=open]:animate-none data-[state=closed]:animate-none"
        containerClassName="z-240"
        overlayClassName="z-230 data-[state=open]:animate-none data-[state=closed]:animate-none"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusFirstAvailable(applyButtonRef.current, cancelButtonRef.current);
        }}
      >
        <DialogHeader>
          <DialogTitle>Editor de avatar</DialogTitle>
          <DialogDescription>
            Defina o enquadramento final do avatar e clique em Aplicar avatar para liberar o
            salvamento.
          </DialogDescription>
        </DialogHeader>
        {primarySelectedUrl ? (
          <AvatarCropWorkspace
            key={primarySelectedRenderKey}
            applyButtonRef={applyButtonRef}
            cancelButtonRef={cancelButtonRef}
            src={primarySelectedRenderUrl}
            isApplyingCrop={isApplyingCrop}
            onCancel={() => setIsCropDialogOpen(false)}
            onApplyCrop={applyCrop}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Selecione um avatar na biblioteca antes de abrir o editor.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export type ImageLibraryFocalPointDialogProps = {
  activeFocalPreset: UploadFocalPresetKey;
  focalCropDraft: UploadFocalCrops;
  focalTarget: LibraryImageItem | null;
  isSavingFocal: boolean;
  saveFocalPoint: () => Promise<void>;
  setActiveFocalPreset: (value: UploadFocalPresetKey) => void;
  setFocalCropDraft: Dispatch<SetStateAction<UploadFocalCrops>>;
  setFocalTarget: (value: LibraryImageItem | null) => void;
};

export const ImageLibraryFocalPointDialog = ({
  activeFocalPreset,
  focalCropDraft,
  focalTarget,
  isSavingFocal,
  saveFocalPoint,
  setActiveFocalPreset,
  setFocalCropDraft,
  setFocalTarget,
}: ImageLibraryFocalPointDialogProps) => {
  const activePresetButtonRef = useRef<HTMLButtonElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Dialog
      open={Boolean(focalTarget)}
      onOpenChange={(next) => {
        if (!next && !isSavingFocal) {
          setFocalTarget(null);
        }
      }}
    >
      <DialogContent
        className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col overflow-hidden data-[state=open]:animate-none data-[state=closed]:animate-none"
        containerClassName="z-240"
        overlayClassName="z-230 data-[state=open]:animate-none data-[state=closed]:animate-none"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusFirstAvailable(activePresetButtonRef.current, saveButtonRef.current);
        }}
      >
        <DialogHeader>
          <DialogTitle>Definir ponto focal</DialogTitle>
          <DialogDescription>
            Ajuste o enquadramento por preset e regenere as variantes automáticas com uma prévia
            fiel ao recorte final.
          </DialogDescription>
        </DialogHeader>
        {focalTarget ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto pr-1">
              <FocalPointWorkspace
                activePresetButtonRef={activePresetButtonRef}
                item={focalTarget}
                renderUrl={toLibraryItemRenderUrl(focalTarget)}
                draft={focalCropDraft}
                activePreset={activeFocalPreset}
                onDraftChange={setFocalCropDraft}
                onActivePresetChange={setActiveFocalPreset}
              />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DashboardActionButton
                type="button"
                size="sm"
                disabled={isSavingFocal}
                onClick={() => setFocalTarget(null)}
              >
                Cancelar
              </DashboardActionButton>
              <DashboardActionButton
                ref={saveButtonRef}
                type="button"
                size="sm"
                tone="primary"
                disabled={isSavingFocal}
                onClick={() => void saveFocalPoint()}
              >
                {isSavingFocal ? "Salvando..." : "Salvar ponto focal"}
              </DashboardActionButton>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export type ImageLibraryDeleteDialogProps = {
  deleteTarget: LibraryImageItem | null;
  handleDelete: (item: LibraryImageItem) => Promise<void>;
  isDeleting: boolean;
  setDeleteTarget: (value: LibraryImageItem | null) => void;
};

export const ImageLibraryDeleteDialog = ({
  deleteTarget,
  handleDelete,
  isDeleting,
  setDeleteTarget,
}: ImageLibraryDeleteDialogProps) => {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
      <DialogContent
        className="max-w-md"
        containerClassName="z-240"
        overlayClassName="z-230"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusFirstAvailable(cancelButtonRef.current);
        }}
      >
        <DialogHeader>
          <DialogTitle>Excluir imagem?</DialogTitle>
          <DialogDescription>
            {deleteTarget
              ? `A imagem "${toEffectiveName(deleteTarget)}" será removida permanentemente.`
              : "Confirme a exclusão da imagem."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <DashboardActionButton
            ref={cancelButtonRef}
            type="button"
            size="sm"
            onClick={() => setDeleteTarget(null)}
            disabled={isDeleting}
          >
            Cancelar
          </DashboardActionButton>
          <DashboardActionButton
            type="button"
            size="sm"
            tone="destructive"
            disabled={isDeleting}
            onClick={() => {
              if (!deleteTarget) {
                return;
              }
              void (async () => {
                await handleDelete(deleteTarget);
                setDeleteTarget(null);
              })();
            }}
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </DashboardActionButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type ImageLibraryAltTextDialogProps = {
  altTextTarget: LibraryImageItem | null;
  altTextValue: string;
  handleAltTextConfirm: () => Promise<void>;
  isSavingAltText: boolean;
  setAltTextTarget: (value: LibraryImageItem | null) => void;
  setAltTextValue: (value: string) => void;
};

export const ImageLibraryAltTextDialog = ({
  altTextTarget,
  altTextValue,
  handleAltTextConfirm,
  isSavingAltText,
  setAltTextTarget,
  setAltTextValue,
}: ImageLibraryAltTextDialogProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog
      open={Boolean(altTextTarget)}
      onOpenChange={(next) => {
        if (!next) {
          setAltTextTarget(null);
          setAltTextValue("");
        }
      }}
    >
      <DialogContent
        className="max-w-md"
        containerClassName="z-240"
        overlayClassName="z-230"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusFirstAvailable(inputRef.current);
        }}
      >
        <DialogHeader>
          <DialogTitle>Editar texto alternativo</DialogTitle>
          <DialogDescription>
            Esse texto fica salvo no upload e pode ser reutilizado ao selecionar a imagem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="edit-image-alt-text">Texto alternativo</Label>
          <Input
            ref={inputRef}
            id="edit-image-alt-text"
            value={altTextValue}
            onChange={(event) => setAltTextValue(event.target.value)}
            placeholder="Descreva a imagem, se quiser"
          />
          <div className="flex justify-end gap-2">
            <DashboardActionButton
              type="button"
              size="sm"
              onClick={() => {
                setAltTextTarget(null);
                setAltTextValue("");
              }}
              disabled={isSavingAltText}
            >
              Cancelar
            </DashboardActionButton>
            <DashboardActionButton
              type="button"
              size="sm"
              tone="primary"
              disabled={isSavingAltText}
              onClick={() => void handleAltTextConfirm()}
            >
              {isSavingAltText ? "Salvando..." : "Salvar"}
            </DashboardActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type ImageLibraryRenameDialogProps = {
  handleRenameConfirm: () => Promise<void>;
  isRenaming: boolean;
  renameTarget: LibraryImageItem | null;
  renameValue: string;
  setRenameTarget: (value: LibraryImageItem | null) => void;
  setRenameValue: (value: string) => void;
};

export const ImageLibraryRenameDialog = ({
  handleRenameConfirm,
  isRenaming,
  renameTarget,
  renameValue,
  setRenameTarget,
  setRenameValue,
}: ImageLibraryRenameDialogProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Dialog open={Boolean(renameTarget)} onOpenChange={(next) => !next && setRenameTarget(null)}>
      <DialogContent
        className="max-w-md"
        containerClassName="z-240"
        overlayClassName="z-230"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusFirstAvailable(inputRef.current);
        }}
      >
        <DialogHeader>
          <DialogTitle>Renomear imagem</DialogTitle>
          <DialogDescription>
            O nome novo atualiza o caminho da imagem onde ela estiver sendo usada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="rename-image-file-name">Novo nome do arquivo</Label>
          <Input
            ref={inputRef}
            id="rename-image-file-name"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <DashboardActionButton type="button" size="sm" onClick={() => setRenameTarget(null)}>
              Cancelar
            </DashboardActionButton>
            <DashboardActionButton
              type="button"
              size="sm"
              tone="primary"
              disabled={isRenaming || !renameValue.trim()}
              onClick={() => void handleRenameConfirm()}
            >
              {isRenaming ? "Renomeando..." : "Renomear"}
            </DashboardActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
