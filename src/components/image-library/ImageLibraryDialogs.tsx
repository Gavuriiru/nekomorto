import type { Dispatch, SetStateAction } from "react";

import AvatarCropWorkspace from "@/components/image-library/AvatarCropWorkspace";
import FocalPointWorkspace from "@/components/image-library/FocalPointWorkspace";
import type { LibraryImageItem } from "@/components/image-library/types";
import { toEffectiveName, toLibraryItemRenderUrl } from "@/components/image-library/utils";
import { Button } from "@/components/ui/button";
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

export type ImageLibraryDialogsProps = {
  activeFocalPreset: UploadFocalPresetKey;
  altTextTarget: LibraryImageItem | null;
  altTextValue: string;
  applyCrop: (dataUrl: string) => Promise<void> | void;
  deleteTarget: LibraryImageItem | null;
  focalCropDraft: UploadFocalCrops;
  focalTarget: LibraryImageItem | null;
  handleAltTextConfirm: () => Promise<void> | void;
  handleDelete: (item: LibraryImageItem) => Promise<void> | void;
  handleRenameConfirm: () => Promise<void> | void;
  isApplyingCrop: boolean;
  isCropDialogOpen: boolean;
  isDeleting: boolean;
  isRenaming: boolean;
  isSavingAltText: boolean;
  isSavingFocal: boolean;
  primarySelectedRenderKey: string;
  primarySelectedRenderUrl: string;
  primarySelectedUrl: string;
  renameTarget: LibraryImageItem | null;
  renameValue: string;
  saveFocalPoint: () => Promise<void> | void;
  setActiveFocalPreset: (value: UploadFocalPresetKey) => void;
  setAltTextTarget: (value: LibraryImageItem | null) => void;
  setAltTextValue: (value: string) => void;
  setDeleteTarget: (value: LibraryImageItem | null) => void;
  setFocalCropDraft: Dispatch<SetStateAction<UploadFocalCrops>>;
  setFocalTarget: (value: LibraryImageItem | null) => void;
  setIsCropDialogOpen: (value: boolean) => void;
  setRenameTarget: (value: LibraryImageItem | null) => void;
  setRenameValue: (value: string) => void;
};

const ImageLibraryDialogs = ({
  activeFocalPreset,
  altTextTarget,
  altTextValue,
  applyCrop,
  deleteTarget,
  focalCropDraft,
  focalTarget,
  handleAltTextConfirm,
  handleDelete,
  handleRenameConfirm,
  isApplyingCrop,
  isCropDialogOpen,
  isDeleting,
  isRenaming,
  isSavingAltText,
  isSavingFocal,
  primarySelectedRenderKey,
  primarySelectedRenderUrl,
  primarySelectedUrl,
  renameTarget,
  renameValue,
  saveFocalPoint,
  setActiveFocalPreset,
  setAltTextTarget,
  setAltTextValue,
  setDeleteTarget,
  setFocalCropDraft,
  setFocalTarget,
  setIsCropDialogOpen,
  setRenameTarget,
  setRenameValue,
}: ImageLibraryDialogsProps) => (
  <>
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
                item={focalTarget}
                renderUrl={toLibraryItemRenderUrl(focalTarget)}
                draft={focalCropDraft}
                activePreset={activeFocalPreset}
                onDraftChange={setFocalCropDraft}
                onActivePresetChange={setActiveFocalPreset}
              />
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isSavingFocal}
                onClick={() => setFocalTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isSavingFocal}
                onClick={() => void saveFocalPoint()}
              >
                {isSavingFocal ? "Salvando..." : "Salvar ponto focal"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
      <DialogContent className="max-w-md" containerClassName="z-240" overlayClassName="z-230">
        <DialogHeader>
          <DialogTitle>Excluir imagem?</DialogTitle>
          <DialogDescription>
            {deleteTarget
              ? `A imagem "${toEffectiveName(deleteTarget)}" será removida permanentemente.`
              : "Confirme a exclusão da imagem."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDeleteTarget(null)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
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
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={Boolean(altTextTarget)}
      onOpenChange={(next) => {
        if (!next) {
          setAltTextTarget(null);
          setAltTextValue("");
        }
      }}
    >
      <DialogContent className="max-w-md" containerClassName="z-240" overlayClassName="z-230">
        <DialogHeader>
          <DialogTitle>Editar texto alternativo</DialogTitle>
          <DialogDescription>
            Esse texto fica salvo no upload e pode ser reutilizado ao selecionar a imagem.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="edit-image-alt-text">Texto alternativo</Label>
          <Input
            id="edit-image-alt-text"
            value={altTextValue}
            onChange={(event) => setAltTextValue(event.target.value)}
            placeholder="Descreva a imagem, se quiser"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAltTextTarget(null);
                setAltTextValue("");
              }}
              disabled={isSavingAltText}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSavingAltText}
              onClick={() => void handleAltTextConfirm()}
            >
              {isSavingAltText ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(renameTarget)} onOpenChange={(next) => !next && setRenameTarget(null)}>
      <DialogContent className="max-w-md" containerClassName="z-240" overlayClassName="z-230">
        <DialogHeader>
          <DialogTitle>Renomear imagem</DialogTitle>
          <DialogDescription>
            O nome novo atualiza o caminho da imagem onde ela estiver sendo usada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="rename-image-file-name">Novo nome do arquivo</Label>
          <Input
            id="rename-image-file-name"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isRenaming || !renameValue.trim()}
              onClick={() => void handleRenameConfirm()}
            >
              {isRenaming ? "Renomeando..." : "Renomear"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
);

export default ImageLibraryDialogs;
