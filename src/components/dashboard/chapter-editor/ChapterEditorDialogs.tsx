import type { ComponentProps } from "react";

import LazyImageLibraryDialog from "@/components/lazy/LazyImageLibraryDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { LeaveGuardDialogState } from "./useChapterEditorLeaveGuard";

type ChapterEditorDialogsProps = {
  leaveDialogDescription: string;
  leaveDialogState: LeaveGuardDialogState | null;
  leaveDialogTitle: string;
  libraryDialogProps: ComponentProps<typeof LazyImageLibraryDialog> | null;
  onCloseVolumeRequiredSaveDialog: () => void;
  onLeaveDialogCancel: () => void;
  onLeaveDialogDiscardAndContinue: () => void;
  onLeaveDialogSaveAndContinue: (publicationStatus: "draft" | "published") => Promise<boolean>;
  volumeRequiredSaveDialogDescription: string;
  volumeRequiredSaveDialogOpen: boolean;
};

const ChapterEditorDialogs = ({
  leaveDialogDescription,
  leaveDialogState,
  leaveDialogTitle,
  libraryDialogProps,
  onCloseVolumeRequiredSaveDialog,
  onLeaveDialogCancel,
  onLeaveDialogDiscardAndContinue,
  onLeaveDialogSaveAndContinue,
  volumeRequiredSaveDialogDescription,
  volumeRequiredSaveDialogOpen,
}: ChapterEditorDialogsProps) => (
  <>
    <Dialog
      open={Boolean(leaveDialogState)}
      onOpenChange={(open) => {
        if (!open) {
          onLeaveDialogCancel();
        }
      }}
    >
      <DialogContent className="max-w-lg" data-testid="chapter-unsaved-leave-dialog">
        <DialogHeader>
          <>
            <DialogTitle>{leaveDialogTitle}</DialogTitle>
            <DialogDescription>{leaveDialogDescription}</DialogDescription>
          </>
          <div className="hidden">
            {leaveDialogState?.chapterDirty
              ? "Há alterações não salvas"
              : "Salvar alterações do volume antes de continuar?"}
          </div>
          <div className="hidden">
            {leaveDialogState?.chapterDirty
              ? "Escolha se deseja salvar como rascunho, publicar ou descartar antes de trocar de contexto."
              : "Você pode salvar o volume agora, descartar as mudanças ou cancelar e continuar editando."}
          </div>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button type="button" variant="ghost" onClick={onLeaveDialogCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={onLeaveDialogDiscardAndContinue}>
            Descartar e continuar
          </Button>
          {leaveDialogState?.chapterDirty && !leaveDialogState?.mangaWorkflowDirty ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void onLeaveDialogSaveAndContinue("draft");
                }}
              >
                Salvar como rascunho e continuar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void onLeaveDialogSaveAndContinue("published");
                }}
              >
                Publicar e continuar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant={
                leaveDialogState?.mangaWorkflowDirty || leaveDialogState?.chapterDirty
                  ? "outline"
                  : "default"
              }
              onClick={() => {
                void onLeaveDialogSaveAndContinue("draft");
              }}
            >
              {leaveDialogState?.mangaWorkflowDirty || leaveDialogState?.chapterDirty
                ? "Salvar como rascunho e continuar"
                : "Salvar volume e continuar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={volumeRequiredSaveDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCloseVolumeRequiredSaveDialog();
        }
      }}
    >
      <DialogContent className="max-w-md" data-testid="chapter-save-volume-required-dialog">
        <DialogHeader>
          <DialogTitle>Volume obrigatório</DialogTitle>
          <DialogDescription>{volumeRequiredSaveDialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button type="button" onClick={onCloseVolumeRequiredSaveDialog}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {libraryDialogProps ? <LazyImageLibraryDialog {...libraryDialogProps} /> : null}
  </>
);

export default ChapterEditorDialogs;
