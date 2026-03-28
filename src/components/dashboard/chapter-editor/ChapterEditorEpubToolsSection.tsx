import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/dashboard/dashboard-form-controls";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

import ChapterEditorAccordionHeader from "./ChapterEditorAccordionHeader";

type EpubCapabilityState = {
  message: string;
  variant: "destructive" | "warning";
} | null;

type ChapterEditorEpubToolsSectionProps = {
  supportsEpubTools: boolean;
  epubCapabilityState: EpubCapabilityState;
  backendBuildLabel: string | null;
  frontendBuildLabel: string | null;
  backendSupportsEpubImport: boolean;
  backendSupportsEpubExport: boolean;
  epubImportInputRef: RefObject<HTMLInputElement | null>;
  epubImportFile: File | null;
  epubImportTargetVolume: string;
  onEpubImportTargetVolumeChange: (nextValue: string) => void;
  epubImportAsDraft: boolean;
  onEpubImportAsDraftChange: (nextValue: boolean) => void;
  isImportingEpub: boolean;
  onOpenEpubPicker: (options: { autoImportAfterSelect: boolean }) => void;
  onEpubImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onEpubImportFileCancel: () => void;
  onImportEpub: () => void | Promise<void>;
  epubExportVolume: string;
  onEpubExportVolumeChange: (nextValue: string) => void;
  epubExportIncludeDrafts: boolean;
  onEpubExportIncludeDraftsChange: (nextValue: boolean) => void;
  isExportingEpub: boolean;
  onExportEpub: () => void | Promise<void>;
};

export const ChapterEditorEpubToolsSection = ({
  supportsEpubTools,
  epubCapabilityState,
  backendBuildLabel,
  frontendBuildLabel,
  backendSupportsEpubImport,
  backendSupportsEpubExport,
  epubImportInputRef,
  epubImportFile,
  epubImportTargetVolume,
  onEpubImportTargetVolumeChange,
  epubImportAsDraft,
  onEpubImportAsDraftChange,
  isImportingEpub,
  onOpenEpubPicker,
  onEpubImportFileChange,
  onEpubImportFileCancel,
  onImportEpub,
  epubExportVolume,
  onEpubExportVolumeChange,
  epubExportIncludeDrafts,
  onEpubExportIncludeDraftsChange,
  isExportingEpub,
  onExportEpub,
}: ChapterEditorEpubToolsSectionProps) => {
  if (!supportsEpubTools) {
    return null;
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="epub-tools"
      className="project-editor-accordion space-y-2.5"
      data-testid="chapter-epub-tools"
    >
      <AccordionItem
        value="epub-tools"
        className="rounded-[22px] border border-border/50 bg-card/70 shadow-[0_14px_42px_-34px_rgba(0,0,0,0.74)]"
      >
        <AccordionTrigger className="flex items-center justify-between gap-3 px-4 py-4 text-left">
          <ChapterEditorAccordionHeader
            title="Ferramentas EPUB"
            subtitle="Importacao e exportacao por volume"
          />
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-5">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Importe capitulos para o editor Lexical e exporte o snapshot atual da pagina.
              </p>
              {epubCapabilityState ? (
                <p
                  className={
                    epubCapabilityState.variant === "destructive"
                      ? "text-xs text-destructive"
                      : "text-xs text-amber-700"
                  }
                >
                  {epubCapabilityState.message}
                </p>
              ) : null}
              {backendBuildLabel ? (
                <p className="text-[11px] text-muted-foreground">
                  Contrato da API: {backendBuildLabel}
                </p>
              ) : null}
              {frontendBuildLabel ? (
                <p className="text-[11px] text-muted-foreground">Frontend: {frontendBuildLabel}</p>
              ) : null}
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-foreground">Importar EPUB</h4>
                <p className="hidden">
                  O arquivo e convertido para Lexical, mergeado no projeto e salvo imediatamente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="chapter-editor-epub-import-file">Arquivo .epub</Label>
                <Input
                  ref={epubImportInputRef}
                  id="chapter-editor-epub-import-file"
                  type="file"
                  accept=".epub,application/epub+zip"
                  className="sr-only"
                  onChange={onEpubImportFileChange}
                  onCancel={onEpubImportFileCancel}
                />
                {epubImportFile ? (
                  <button
                    type="button"
                    onClick={() => onOpenEpubPicker({ autoImportAfterSelect: false })}
                    disabled={isImportingEpub || !backendSupportsEpubImport}
                    className="w-full rounded-xl border border-border/60 bg-background/50 px-3 py-3 text-left transition hover:bg-background/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="block truncate text-sm font-medium text-foreground">
                      {epubImportFile.name}
                    </span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenEpubPicker({ autoImportAfterSelect: false })}
                      disabled={isImportingEpub || !backendSupportsEpubImport}
                    >
                      Escolher arquivo
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Nenhum arquivo selecionado
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="chapter-editor-epub-import-volume">Volume de destino</Label>
                <Input
                  id="chapter-editor-epub-import-volume"
                  type="number"
                  value={epubImportTargetVolume}
                  onChange={(event) => onEpubImportTargetVolumeChange(event.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm">
                <Checkbox
                  checked={epubImportAsDraft}
                  onCheckedChange={(checked) => onEpubImportAsDraftChange(checked === true)}
                />
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">
                    Importar como rascunho
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Capitulos importados ficam ocultos ao publico ate a publicacao.
                  </span>
                </span>
              </label>
              <Button
                type="button"
                onClick={onImportEpub}
                disabled={isImportingEpub || !backendSupportsEpubImport}
                className="gap-2"
              >
                {isImportingEpub ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Importar EPUB
              </Button>
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-foreground">Exportar EPUB</h4>
                <p className="text-xs text-muted-foreground">
                  Usa o estado atual da pagina, inclusive alteracoes ainda nao salvas no capitulo
                  aberto.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="chapter-editor-epub-export-volume">
                  Volume para exportacao
                </Label>
                <Input
                  id="chapter-editor-epub-export-volume"
                  type="number"
                  value={epubExportVolume}
                  onChange={(event) => onEpubExportVolumeChange(event.target.value)}
                  placeholder="Deixe vazio para Sem volume"
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm">
                <Checkbox
                  checked={epubExportIncludeDrafts}
                  onCheckedChange={(checked) => onEpubExportIncludeDraftsChange(checked === true)}
                />
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">Incluir rascunhos</span>
                  <span className="block text-xs text-muted-foreground">
                    Exporta tambem capitulos em draft que tenham conteudo.
                  </span>
                </span>
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={onExportEpub}
                disabled={isExportingEpub || !backendSupportsEpubExport}
                className="gap-2"
              >
                {isExportingEpub ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Exportar volume em EPUB
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ChapterEditorEpubToolsSection;
