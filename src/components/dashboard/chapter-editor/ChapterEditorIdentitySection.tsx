import type { ProjectEpisode } from "@/data/projects";

import {
  Combobox,
  Input,
  Textarea,
} from "@/components/dashboard/dashboard-form-controls";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import ProjectEditorSectionCard from "@/components/project-reader/ProjectEditorSectionCard";
import {
  buildChapterVolumeLabel,
  normalizePositiveInteger,
  resolveChapterEntrySubtype,
} from "@/lib/dashboard-project-chapter";

type ChapterEditorIdentitySectionProps = {
  draft: ProjectEpisode;
  identityError: string | null;
  isImageChapter: boolean;
  supportsEpubTools: boolean;
  updateDraft: (updater: (current: ProjectEpisode) => ProjectEpisode) => void;
  onClearIdentityError: () => void;
};

const ChapterEditorIdentitySection = ({
  draft,
  identityError,
  isImageChapter,
  supportsEpubTools,
  updateDraft,
  onClearIdentityError,
}: ChapterEditorIdentitySectionProps) => {
  const chapterLabel = draft.entryKind === "extra" ? "Extra" : "Capítulo";
  const isExtra = draft.entryKind === "extra";
  const title = isImageChapter ? "Dados do capítulo" : "Identidade do capítulo";
  const subtitle = isImageChapter
    ? "Volume, capítulo, tipo de entrada, título e sinopse."
    : "Título, numeração, tipo e resumo";

  return (
    <ProjectEditorSectionCard
      title={title}
      subtitle={subtitle}
      eyebrow="Ficha editorial"
      testId="chapter-identity-accordion"
      actions={
        <>
          <Badge
            variant="secondary"
            className="text-[10px] uppercase tracking-[0.12em]"
          >
            {chapterLabel}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-[0.12em]"
          >
            {buildChapterVolumeLabel(draft.volume)}
          </Badge>
        </>
      }
    >
      <div
        className="space-y-5"
        data-testid="chapter-identity-section"
        data-state="open"
      >
        <button
          type="button"
          className="sr-only"
          data-testid="chapter-identity-trigger"
          aria-expanded="false"
        >
          Alternar identidade
        </button>
        {identityError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {identityError}
          </div>
        ) : null}

        <DashboardFieldStack>
          <Label
            htmlFor={
              isImageChapter ? "chapter-title-image" : "chapter-title-standard"
            }
          >
            Título
          </Label>
          <Input
            id={
              isImageChapter ? "chapter-title-image" : "chapter-title-standard"
            }
            value={draft.title || ""}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            className="w-full"
          />
        </DashboardFieldStack>

        <div
          className="flex flex-wrap gap-3"
          data-testid={
            isImageChapter
              ? "chapter-image-compact-fields"
              : "chapter-standard-compact-fields"
          }
        >
          {isImageChapter ? (
            <DashboardFieldStack>
              <Label htmlFor="chapter-volume-image">Volume</Label>
              <Input
                id="chapter-volume-image"
                type="number"
                min={1}
                step={1}
                value={draft.volume ?? ""}
                onChange={(event) => {
                  onClearIdentityError();
                  updateDraft((current) => ({
                    ...current,
                    volume:
                      event.target.value.trim() === ""
                        ? undefined
                        : normalizePositiveInteger(Number(event.target.value)),
                  }));
                }}
                placeholder="Sem volume"
                className="w-full sm:w-[132px]"
              />
            </DashboardFieldStack>
          ) : (
            <DashboardFieldStack>
              <Label htmlFor="chapter-number-standard">Capítulo</Label>
              <Input
                id="chapter-number-standard"
                type="number"
                min={1}
                step={1}
                value={draft.number}
                onChange={(event) => {
                  onClearIdentityError();
                  updateDraft((current) => ({
                    ...current,
                    number:
                      normalizePositiveInteger(Number(event.target.value), 1) ??
                      current.number,
                  }));
                }}
                className="w-full sm:w-[132px]"
              />
            </DashboardFieldStack>
          )}

          {isImageChapter ? (
            <DashboardFieldStack>
              <Label htmlFor="chapter-number-image">Capítulo</Label>
              <Input
                id="chapter-number-image"
                type="number"
                min={1}
                step={1}
                value={draft.number}
                onChange={(event) => {
                  onClearIdentityError();
                  updateDraft((current) => ({
                    ...current,
                    number:
                      normalizePositiveInteger(Number(event.target.value), 1) ??
                      current.number,
                  }));
                }}
                className="w-full sm:w-[132px]"
              />
            </DashboardFieldStack>
          ) : (
            <DashboardFieldStack>
              <Label htmlFor="chapter-volume-standard">Volume</Label>
              <Input
                id="chapter-volume-standard"
                type="number"
                min={1}
                step={1}
                value={draft.volume ?? ""}
                onChange={(event) => {
                  onClearIdentityError();
                  updateDraft((current) => ({
                    ...current,
                    volume:
                      event.target.value.trim() === ""
                        ? undefined
                        : normalizePositiveInteger(Number(event.target.value)),
                  }));
                }}
                placeholder="Sem volume"
                className="w-full sm:w-[132px]"
              />
            </DashboardFieldStack>
          )}

          <DashboardFieldStack className="sm:min-w-[180px]">
            <Label>Tipo de entrada</Label>
            <Combobox
              value={isExtra ? "extra" : "main"}
              onValueChange={(value) =>
                updateDraft((current) => {
                  const nextEntryKind = value === "extra" ? "extra" : "main";
                  return {
                    ...current,
                    entryKind: nextEntryKind,
                    entrySubtype: resolveChapterEntrySubtype(nextEntryKind),
                    displayLabel:
                      nextEntryKind === "extra"
                        ? current.displayLabel || "Extra"
                        : undefined,
                  };
                })
              }
              ariaLabel="Tipo de entrada"
              options={[
                { value: "main", label: "Capítulo" },
                { value: "extra", label: "Extra" },
              ]}
              placeholder="Tipo"
              searchable={false}
              className="w-full sm:w-[180px]"
            />
          </DashboardFieldStack>

          {!isImageChapter && !supportsEpubTools ? (
            <DashboardFieldStack>
              <Label htmlFor="chapter-reading-order-standard">
                Ordem de leitura
              </Label>
              <Input
                id="chapter-reading-order-standard"
                type="number"
                value={draft.readingOrder ?? ""}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    readingOrder:
                      event.target.value.trim() === ""
                        ? undefined
                        : Number(event.target.value),
                  }))
                }
                className="w-full sm:w-[148px]"
              />
            </DashboardFieldStack>
          ) : null}
        </div>

        {isExtra ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <DashboardFieldStack>
              <Label
                htmlFor={
                  isImageChapter
                    ? "chapter-display-label-image"
                    : "chapter-display-label-standard"
                }
              >
                Rótulo do extra
              </Label>
              <Input
                id={
                  isImageChapter
                    ? "chapter-display-label-image"
                    : "chapter-display-label-standard"
                }
                value={draft.displayLabel || ""}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    displayLabel: event.target.value,
                  }))
                }
                placeholder="Ex.: Side Story"
              />
            </DashboardFieldStack>
          </div>
        ) : null}

        <DashboardFieldStack>
          <Label
            htmlFor={
              isImageChapter
                ? "chapter-synopsis-image"
                : "chapter-synopsis-standard"
            }
          >
            Sinopse
          </Label>
          <Textarea
            id={
              isImageChapter
                ? "chapter-synopsis-image"
                : "chapter-synopsis-standard"
            }
            value={draft.synopsis || ""}
            onChange={(event) =>
              updateDraft((current) => ({
                ...current,
                synopsis: event.target.value,
              }))
            }
            rows={isImageChapter ? 4 : 5}
            className={isImageChapter ? undefined : "w-full"}
          />
        </DashboardFieldStack>
      </div>
    </ProjectEditorSectionCard>
  );
};

export default ChapterEditorIdentitySection;
