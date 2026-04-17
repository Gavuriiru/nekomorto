import type { PointerEvent as ReactPointerEvent, Ref, SyntheticEvent } from "react";

import type { LibraryImageItem } from "@/components/image-library/types";
import {
  UPLOAD_FOCAL_PRESET_KEYS,
  UPLOAD_VARIANT_PRESET_DIMENSIONS,
  type UploadFocalCrops,
  type UploadFocalPresetKey,
} from "@/lib/upload-focal-points";

import {
  buildFocalPreviewImageStyle,
  FOCAL_CROP_HANDLE_KEYS,
  getFocalCropHandleStyle,
} from "./focal-point-workspace";
import useFocalPointWorkspace from "./useFocalPointWorkspace";
import { toEffectiveName } from "./utils";

export type FocalPointWorkspaceProps = {
  activePresetButtonRef?: Ref<HTMLButtonElement>;
  item: LibraryImageItem;
  renderUrl: string;
  draft: UploadFocalCrops;
  activePreset: UploadFocalPresetKey;
  onDraftChange: (next: UploadFocalCrops) => void;
  onActivePresetChange: (preset: UploadFocalPresetKey) => void;
};

const FocalPointWorkspace = ({
  activePresetButtonRef,
  item,
  renderUrl,
  draft,
  activePreset,
  onDraftChange,
  onActivePresetChange,
}: FocalPointWorkspaceProps) => {
  const {
    activeCropDisplayRect,
    beginMoveInteraction,
    beginResizeInteraction,
    fitRect,
    frameRef,
    handleImageLoad,
    handleStagePointerEnd,
    handleStagePointerMove,
    interactionMode,
  } = useFocalPointWorkspace({
    activePreset,
    draft,
    item,
    onDraftChange,
    renderUrl,
  });

  return (
    <div
      data-testid="focal-layout"
      className="grid min-h-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]"
    >
      <aside
        data-testid="focal-sidebar"
        className="flex min-h-0 flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Presets</p>
          <p className="text-xs text-muted-foreground">
            Selecione um preset para editar. OG e CARDWIDE continuam derivados de CARD.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {UPLOAD_FOCAL_PRESET_KEYS.map((preset) => {
            const dimensions = UPLOAD_VARIANT_PRESET_DIMENSIONS[preset];
            const isActive = preset === activePreset;
            return (
              <button
                key={preset}
                ref={isActive ? activePresetButtonRef : undefined}
                type="button"
                className={`w-full rounded-xl border p-2 text-left transition ${
                  isActive
                    ? "border-primary/60 bg-primary/10 ring-2 ring-primary/40"
                    : "border-border/60 bg-card/60 hover:border-primary/40"
                }`}
                onClick={() => onActivePresetChange(preset)}
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold uppercase text-foreground">{preset}</span>
                  <span>
                    {dimensions.width}x{dimensions.height}
                  </span>
                </div>
                <div
                  data-testid={`focal-preview-${preset}`}
                  className="relative overflow-hidden rounded-lg border border-border/40 bg-background/60"
                  style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
                >
                  <img
                    src={renderUrl}
                    alt=""
                    aria-hidden="true"
                    data-testid={`focal-preview-${preset}-image`}
                    className="pointer-events-none absolute max-w-none select-none"
                    style={buildFocalPreviewImageStyle({ rect: draft[preset] })}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section
        data-testid="focal-editor-panel"
        className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border/60 bg-card/60 p-3 lg:p-4"
      >
        <p className="mb-1 text-sm font-medium text-foreground">
          Preset ativo: {activePreset.toUpperCase()}
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Arraste e redimensione a caixa para definir o enquadramento final.
        </p>
        <div
          ref={frameRef}
          data-testid="focal-stage"
          className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-background/40"
          style={{ height: "min(68vh, 46rem)" }}
          onPointerMove={
            handleStagePointerMove as (event: ReactPointerEvent<HTMLDivElement>) => void
          }
          onPointerUp={handleStagePointerEnd as (event: ReactPointerEvent<HTMLDivElement>) => void}
          onPointerCancel={
            handleStagePointerEnd as (event: ReactPointerEvent<HTMLDivElement>) => void
          }
        >
          <div
            data-testid="focal-image-shell"
            className="absolute"
            style={{
              left: `${fitRect.left}px`,
              top: `${fitRect.top}px`,
              width: `${fitRect.width}px`,
              height: `${fitRect.height}px`,
            }}
          >
            <img
              src={renderUrl}
              alt={toEffectiveName(item)}
              data-testid="focal-stage-image"
              className="pointer-events-none block h-full w-full select-none object-contain object-center"
              draggable={false}
              onLoad={handleImageLoad as (event: SyntheticEvent<HTMLImageElement>) => void}
            />
            {activeCropDisplayRect ? (
              <div
                data-testid="focal-crop-body"
                className="absolute border-2 border-primary/70 bg-primary/10"
                style={{
                  left: `${activeCropDisplayRect.left}px`,
                  top: `${activeCropDisplayRect.top}px`,
                  width: `${activeCropDisplayRect.width}px`,
                  height: `${activeCropDisplayRect.height}px`,
                  cursor: interactionMode === "move" ? "grabbing" : "grab",
                  touchAction: "none",
                }}
                onPointerDown={
                  beginMoveInteraction as (event: ReactPointerEvent<HTMLDivElement>) => void
                }
              >
                {FOCAL_CROP_HANDLE_KEYS.map((handle) => (
                  <div
                    key={handle}
                    data-testid={`focal-crop-handle-${handle}`}
                    className="absolute z-10 h-4 w-4 rounded-full border-2 border-background bg-primary shadow"
                    style={{
                      ...getFocalCropHandleStyle(handle),
                      touchAction: "none",
                    }}
                    onPointerDown={(event) => beginResizeInteraction(handle, event)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};

export default FocalPointWorkspace;
