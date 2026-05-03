import { Loader2, Search } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ImageLibraryUploadPanelProps = {
  cropAvatar: boolean;
  handleDrop: (event: DragEvent<HTMLDivElement>) => void;
  handleImportFromUrl: () => Promise<void> | void;
  handleUploadFiles: (files: File[] | FileList | null | undefined) => Promise<void> | void;
  isDragActive: boolean;
  isUploading: boolean;
  mode: "single" | "multiple";
  searchQuery: string;
  setIsDragActive: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  setUrlInput: (value: string) => void;
  showUrlImport: boolean;
  urlInput: string;
};

const DEFAULT_FILE_STATUS = "Nenhum arquivo escolhido";

const getFileStatusLabel = (files: File[]) => {
  if (files.length === 0) {
    return DEFAULT_FILE_STATUS;
  }
  if (files.length === 1) {
    return files[0]?.name || DEFAULT_FILE_STATUS;
  }
  return `${files.length} arquivos selecionados`;
};

const ImageLibraryUploadPanel = ({
  cropAvatar,
  handleDrop,
  handleImportFromUrl,
  handleUploadFiles,
  isDragActive,
  isUploading,
  mode,
  searchQuery,
  setIsDragActive,
  setSearchQuery,
  setUrlInput,
  showUrlImport,
  urlInput,
}: ImageLibraryUploadPanelProps) => {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileStatus, setFileStatus] = useState(DEFAULT_FILE_STATUS);

  return (
    <div className="mt-2 grid min-w-0 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.95fr)]">
      <div
        className={`flex h-full min-w-0 flex-col rounded-2xl border border-dashed border-border/70 bg-card/50 p-3 text-sm text-muted-foreground transition sm:p-4 ${
          isDragActive ? "ring-2 ring-inset ring-primary/60 border-primary/60" : ""
        }`}
        aria-busy={isUploading}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={handleDrop}
      >
        <div className="flex flex-1 flex-col justify-center">
          <p className="font-medium text-foreground">Arraste, cole (Ctrl+V) ou escolha arquivos</p>
          <p className="mt-1 text-xs text-muted-foreground">Upload direto para o servidor.</p>
        </div>
        <div className="mt-3 space-y-2">
          <Input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="image/*"
            multiple={mode === "multiple"}
            disabled={isUploading}
            className="sr-only"
            onCancel={() => {
              setFileStatus(DEFAULT_FILE_STATUS);
            }}
            onChange={(event) => {
              const nextFiles = Array.from(event.currentTarget.files || []);
              setFileStatus(getFileStatusLabel(nextFiles));
              void handleUploadFiles(nextFiles);
              event.currentTarget.value = "";
            }}
          />
          <div className="grid min-w-0 gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-controls={fileInputId}
            >
              {mode === "multiple" ? "Escolher arquivos" : "Escolher arquivo"}
            </Button>
            <span className="min-w-0 truncate text-xs text-muted-foreground sm:flex-1">
              {fileStatus}
            </span>
          </div>
          {isUploading ? (
            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processando upload...
            </p>
          ) : null}
        </div>
        <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
          <Label htmlFor="image-library-search-input" className="text-xs font-medium">
            Pesquisar na biblioteca
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/80" />
            <Input
              id="image-library-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Pesquisar por nome, projeto ou URL..."
              className="h-9 w-full border-border/60 bg-background/80 pl-9 text-sm transition-colors"
            />
          </div>
        </div>
      </div>
      <div
        className="min-w-0 space-y-3 rounded-2xl border border-border/60 bg-card/70 p-3 sm:p-4"
        aria-busy={isUploading}
      >
        {showUrlImport ? (
          <div className="space-y-2">
            <Label>Importar por URL</Label>
            <div className="grid min-w-0 gap-2 xl:flex xl:items-center">
              <Input
                className="min-w-0 xl:flex-1"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://site.com/imagem.png"
              />
              <Button
                type="button"
                size="sm"
                className="w-full shrink-0 px-3 xl:w-auto"
                onClick={() => void handleImportFromUrl()}
                disabled={isUploading || !urlInput.trim()}
                aria-busy={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Importando...
                  </>
                ) : (
                  "Importar URL"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Importação por URL desativada.</p>
        )}
        <p className="text-xs text-muted-foreground">
          {mode === "multiple"
            ? "Clique para alternar seleção. A ordem de clique vira a ordem de inserção."
            : cropAvatar
              ? "Clique na imagem para selecionar e abrir o editor de avatar."
              : "Clique para selecionar. A imagem só será aplicada ao clicar em Salvar."}
        </p>
      </div>
    </div>
  );
};

export default ImageLibraryUploadPanel;
