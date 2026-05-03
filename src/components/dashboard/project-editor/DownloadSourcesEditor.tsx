import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import { Input } from "@/components/dashboard/dashboard-form-controls";
import DownloadSourceSelect from "@/components/project-reader/DownloadSourceSelect";
import type { DownloadSource } from "@/data/projects";
import { cn } from "@/lib/utils";
import { GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";

type DownloadSourcesEditorProps = {
  sources: DownloadSource[];
  sourceAriaLabelPrefix: string;
  cardClassName?: string;
  emptyMessage?: string;
  onChange: (nextSources: DownloadSource[]) => void;
};

const normalizeSources = (sources: DownloadSource[]) =>
  Array.isArray(sources) ? sources.map((source) => ({ ...source })) : [];

const moveSource = (sources: DownloadSource[], fromIndex: number, toIndex: number) => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sources.length ||
    toIndex >= sources.length
  ) {
    return sources;
  }
  const nextSources = [...sources];
  const [movedSource] = nextSources.splice(fromIndex, 1);
  nextSources.splice(toIndex, 0, movedSource);
  return nextSources;
};

const DownloadSourcesEditor = ({
  sources,
  sourceAriaLabelPrefix,
  cardClassName,
  emptyMessage = "Nenhuma fonte cadastrada.",
  onChange,
}: DownloadSourcesEditorProps) => {
  const normalizedSources = normalizeSources(sources);
  const [draggedSourceIndex, setDraggedSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const updateSource = (
    sourceIndex: number,
    updater: (source: DownloadSource) => DownloadSource,
  ) => {
    onChange(
      normalizedSources.map((source, index) => (index === sourceIndex ? updater(source) : source)),
    );
  };

  const handleDrop = (targetIndex: number, transferredIndex: number | null) => {
    const sourceIndex = transferredIndex ?? draggedSourceIndex;
    setDraggedSourceIndex(null);
    setDropTargetIndex(null);
    if (sourceIndex === null || sourceIndex === targetIndex) {
      return;
    }
    onChange(moveSource(normalizedSources, sourceIndex, targetIndex));
  };

  if (normalizedSources.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3" data-testid="download-sources-editor">
      {normalizedSources.map((source, sourceIndex) => {
        const isDragging = draggedSourceIndex === sourceIndex;
        const isDropTarget = dropTargetIndex === sourceIndex && draggedSourceIndex !== sourceIndex;
        return (
          <div
            key={`download-source-${sourceIndex}`}
            className={cn(
              "grid gap-3 rounded-xl border border-border/60 bg-background/40 p-3 transition-colors md:grid-cols-[auto_minmax(0,1fr)]",
              isDragging ? "border-primary/45 bg-primary/5 opacity-70" : "",
              isDropTarget ? "border-primary/65 bg-primary/10" : "",
              cardClassName,
            )}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTargetIndex(sourceIndex);
            }}
            onDragLeave={() => {
              setDropTargetIndex((current) => (current === sourceIndex ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              const transferredIndex = Number(event.dataTransfer.getData("text/plain"));
              handleDrop(sourceIndex, Number.isFinite(transferredIndex) ? transferredIndex : null);
            }}
          >
            <button
              type="button"
              draggable
              className="flex h-10 w-10 cursor-grab items-center justify-center rounded-lg border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground active:cursor-grabbing md:mt-0.5"
              aria-label={`Reordenar ${sourceAriaLabelPrefix.toLowerCase()} ${sourceIndex + 1}`}
              title="Arraste para reordenar"
              onDragStart={(event) => {
                setDraggedSourceIndex(sourceIndex);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(sourceIndex));
              }}
              onDragEnd={() => {
                setDraggedSourceIndex(null);
                setDropTargetIndex(null);
              }}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="grid min-w-0 gap-2">
              <DownloadSourceSelect
                value={source.label}
                ariaLabel={`${sourceAriaLabelPrefix} ${sourceIndex + 1}`}
                legacyLabels={normalizedSources.map((item) => item.label)}
                onValueChange={(value) =>
                  updateSource(sourceIndex, (current) => ({ ...current, label: value }))
                }
              />
              <Input
                value={source.url}
                onChange={(event) =>
                  updateSource(sourceIndex, (current) => ({ ...current, url: event.target.value }))
                }
                placeholder="URL"
                disabled={!String(source.label || "").trim()}
              />
              <div className="flex justify-end">
                <DashboardActionButton
                  type="button"
                  size="sm"
                  onClick={() =>
                    onChange(normalizedSources.filter((_, index) => index !== sourceIndex))
                  }
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Remover</span>
                </DashboardActionButton>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DownloadSourcesEditor;
