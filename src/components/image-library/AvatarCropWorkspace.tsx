import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { ImageRestriction } from "advanced-cropper";
import { CircleStencil, FixedCropper, type FixedCropperRef } from "react-advanced-cropper";

import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import { toast } from "@/components/ui/use-toast";
import {
  AVATAR_CROPPER_BOUNDARY_SIZE,
  renderAvatarCropDataUrl,
  resolveAvatarCropStencilSize,
} from "@/components/ImageLibraryDialog.avatar-crop";

export type AvatarCropWorkspaceProps = {
  applyButtonRef?: Ref<HTMLButtonElement>;
  cancelButtonRef?: Ref<HTMLButtonElement>;
  src: string;
  isApplyingCrop: boolean;
  onCancel: () => void;
  onApplyCrop: (dataUrl: string) => Promise<void>;
};

const AvatarCropWorkspace = ({
  applyButtonRef,
  cancelButtonRef,
  src,
  isApplyingCrop,
  onCancel,
  onApplyCrop,
}: AvatarCropWorkspaceProps) => {
  const cropperRef = useRef<FixedCropperRef | null>(null);
  const [isCropReady, setIsCropReady] = useState(false);
  const [cropperRevision, setCropperRevision] = useState(0);

  useEffect(() => {
    setIsCropReady(false);
  }, [cropperRevision, src]);

  const handleReset = useCallback(() => {
    setCropperRevision((prev) => prev + 1);
  }, []);

  const handleApply = useCallback(async () => {
    const cropper = cropperRef.current;
    if (!cropper || !isCropReady) {
      return;
    }

    try {
      const normalizedDataUrl = await renderAvatarCropDataUrl(cropper);
      await onApplyCrop(normalizedDataUrl);
    } catch {
      toast({
        title: "Não foi possível gerar a imagem recortada.",
        description: "Tente novamente em alguns instantes.",
      });
    }
  }, [isCropReady, onApplyCrop]);

  return (
    <>
      <div className="grid gap-4">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="mb-1 text-sm font-medium text-foreground">Área de recorte</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Arraste a imagem e use scroll para ajustar o zoom.
          </p>
          <div
            className="avatar-cropper-preview relative mx-auto overflow-hidden rounded-xl bg-background/40"
            style={{
              width: AVATAR_CROPPER_BOUNDARY_SIZE,
              height: AVATAR_CROPPER_BOUNDARY_SIZE,
            }}
          >
            <div className="avatar-cropper-shell">
              <FixedCropper
                key={`${src}:${cropperRevision}`}
                ref={cropperRef}
                src={src}
                className="avatar-cropper-root"
                stencilComponent={CircleStencil}
                stencilSize={(state) => resolveAvatarCropStencilSize(state)}
                imageRestriction={ImageRestriction.stencil}
                transformImage={{ adjustStencil: false }}
                transitions={false}
                onReady={() => setIsCropReady(true)}
                onError={() => {
                  setIsCropReady(false);
                  toast({
                    title: "Não foi possível carregar a imagem para recorte.",
                    description: "Tente selecionar outra imagem.",
                  });
                }}
                stencilProps={{
                  movable: false,
                  resizable: false,
                  grid: false,
                  handlers: {
                    eastNorth: false,
                    westNorth: false,
                    westSouth: false,
                    eastSouth: false,
                  },
                  lines: {
                    west: false,
                    north: false,
                    east: false,
                    south: false,
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <DashboardActionButton
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleReset}
            disabled={!isCropReady}
          >
            Resetar
          </DashboardActionButton>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DashboardActionButton
            ref={cancelButtonRef}
            type="button"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onCancel}
          >
            Cancelar
          </DashboardActionButton>
          <DashboardActionButton
            ref={applyButtonRef}
            type="button"
            size="sm"
            tone="primary"
            className="w-full sm:w-auto"
            onClick={() => void handleApply()}
            disabled={isApplyingCrop || !isCropReady}
          >
            {isApplyingCrop ? "Aplicando..." : "Aplicar avatar"}
          </DashboardActionButton>
        </div>
      </div>
    </>
  );
};

export default AvatarCropWorkspace;
