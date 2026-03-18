import { FileArchive, FolderOpen, Loader2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import type { Project } from "@/data/projects";
import { apiFetch } from "@/lib/api-client";
import { downloadBinaryResponse } from "@/lib/project-epub";
import {
  buildProjectImageImportFormData,
  buildProjectSnapshotForMangaExport,
  mergeImportedImageChaptersIntoProject,
  normalizeProjectImageExportJob,
  normalizeProjectImageImportJob,
  normalizeProjectImageImportPreviewPayload,
  type ProjectImageImportPreviewPayload,
} from "@/lib/project-manga";

type MangaImportExportPanelProps = {
  apiBase: string;
  project: Project;
  backendSupportsMangaImport: boolean;
  backendSupportsMangaImportAsync: boolean;
  backendSupportsMangaExport: boolean;
  onProjectChange: (nextProject: Project) => void;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const MangaImportExportPanel = ({
  apiBase,
  project,
  backendSupportsMangaImport,
  backendSupportsMangaImportAsync,
  backendSupportsMangaExport,
  onProjectChange,
}: MangaImportExportPanelProps) => {
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [importSource, setImportSource] = useState<{
    archiveFile?: File | null;
    files?: File[];
    label: string;
  } | null>(null);
  const [previewPayload, setPreviewPayload] = useState<ProjectImageImportPreviewPayload | null>(
    null,
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [targetVolume, setTargetVolume] = useState("");
  const [targetChapterNumber, setTargetChapterNumber] = useState("");
  const [exportVolume, setExportVolume] = useState("");
  const [exportIncludeDrafts, setExportIncludeDrafts] = useState(false);

  const canSubmit = useMemo(
    () =>
      Boolean(project.id) &&
      Boolean(importSource?.archiveFile || (importSource?.files && importSource.files.length > 0)),
    [importSource, project.id],
  );

  const submitPreview = async (source: {
    archiveFile?: File | null;
    files?: File[];
    label: string;
  }) => {
    setIsPreviewing(true);
    try {
      const formData = buildProjectImageImportFormData({
        project,
        archiveFile: source.archiveFile || null,
        files: source.files || [],
        targetVolume: targetVolume.trim() ? Number(targetVolume) : null,
        targetChapterNumber: targetChapterNumber.trim() ? Number(targetChapterNumber) : null,
      });
      const response = await apiFetch(
        apiBase,
        `/api/projects/${encodeURIComponent(project.id)}/manga-import/preview`,
        {
          method: "POST",
          auth: true,
          body: formData,
        },
      );
      if (!response.ok) {
        throw new Error("preview_failed");
      }
      const payload = normalizeProjectImageImportPreviewPayload(await response.json());
      if (!payload) {
        throw new Error("preview_invalid");
      }
      setImportSource(source);
      setPreviewPayload(payload);
    } catch {
      toast({
        title: "Não foi possível analisar o lote",
        variant: "destructive",
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleArchiveSelected = async (file: File) => {
    await submitPreview({
      archiveFile: file,
      files: [],
      label: file.name,
    });
    if (archiveInputRef.current) {
      archiveInputRef.current.value = "";
    }
  };

  const handleFolderSelected = async (files: File[]) => {
    await submitPreview({
      archiveFile: null,
      files,
      label: `${files.length} arquivo(s)`,
    });
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
    }
  };

  const pollImportJob = async (jobId: string) => {
    while (true) {
      const response = await apiFetch(
        apiBase,
        `/api/projects/${encodeURIComponent(project.id)}/manga-import/jobs/${encodeURIComponent(jobId)}`,
        {
          auth: true,
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new Error("import_job_failed");
      }
      const data = (await response.json().catch(() => null)) as { job?: unknown } | null;
      const job = normalizeProjectImageImportJob(data?.job);
      if (!job) {
        throw new Error("import_job_invalid");
      }
      if (job.status === "queued" || job.status === "processing") {
        await sleep(2000);
        continue;
      }
      return job;
    }
  };

  const applyImportedResult = (payload: ProjectImageImportPreviewPayload | null) => {
    if (!payload?.chapters?.length) {
      toast({
        title: "Nenhum capítulo importado",
        variant: "destructive",
      });
      return;
    }
    const nextProject = mergeImportedImageChaptersIntoProject(project, payload.chapters);
    onProjectChange(nextProject);
    toast({
      title: "Importação concluída",
      description: `${payload.summary.chapters} capítulo(s) preparado(s) no formulário.`,
      intent: "success",
    });
  };

  const handleImportConfirm = async () => {
    if (!importSource || !canSubmit || !backendSupportsMangaImport) {
      return;
    }
    setIsImporting(true);
    try {
      const formData = buildProjectImageImportFormData({
        project,
        archiveFile: importSource.archiveFile || null,
        files: importSource.files || [],
        targetVolume: targetVolume.trim() ? Number(targetVolume) : null,
        targetChapterNumber: targetChapterNumber.trim() ? Number(targetChapterNumber) : null,
      });
      const response = await apiFetch(
        apiBase,
        `/api/projects/${encodeURIComponent(project.id)}/manga-import/jobs`,
        {
          method: "POST",
          auth: true,
          body: formData,
        },
      );
      if (!response.ok) {
        throw new Error("import_start_failed");
      }
      const data = (await response.json().catch(() => null)) as { job?: unknown } | null;
      const initialJob = normalizeProjectImageImportJob(data?.job);
      if (!initialJob) {
        throw new Error("import_job_invalid");
      }
      const finalJob =
        backendSupportsMangaImportAsync &&
        (initialJob.status === "queued" || initialJob.status === "processing")
          ? await pollImportJob(initialJob.id)
          : initialJob;
      if (finalJob.status !== "completed" || !finalJob.result) {
        throw new Error(finalJob.error || "import_failed");
      }
      applyImportedResult(finalJob.result);
    } catch {
      toast({
        title: "Não foi possível importar o lote",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const pollExportJob = async (jobId: string) => {
    while (true) {
      const response = await apiFetch(
        apiBase,
        `/api/projects/${encodeURIComponent(project.id)}/manga-export/jobs/${encodeURIComponent(jobId)}`,
        {
          auth: true,
          cache: "no-store",
        },
      );
      if (!response.ok) {
        throw new Error("export_job_failed");
      }
      const data = (await response.json().catch(() => null)) as { job?: unknown } | null;
      const job = normalizeProjectImageExportJob(data?.job);
      if (!job) {
        throw new Error("export_job_invalid");
      }
      if (job.status === "queued" || job.status === "processing") {
        await sleep(2000);
        continue;
      }
      return job;
    }
  };

  const handleExport = async () => {
    if (!backendSupportsMangaExport || !project.id) {
      return;
    }
    setIsExporting(true);
    try {
      const response = await apiFetch(
        apiBase,
        `/api/projects/${encodeURIComponent(project.id)}/manga-export/jobs`,
        {
          method: "POST",
          auth: true,
          json: {
            project: buildProjectSnapshotForMangaExport(project),
            volume: exportVolume.trim() ? Number(exportVolume) : null,
            includeDrafts: exportIncludeDrafts,
          },
        },
      );
      if (!response.ok) {
        throw new Error("export_start_failed");
      }
      const data = (await response.json().catch(() => null)) as { job?: unknown } | null;
      const initialJob = normalizeProjectImageExportJob(data?.job);
      if (!initialJob) {
        throw new Error("export_job_invalid");
      }
      const finalJob = await pollExportJob(initialJob.id);
      if (finalJob.status !== "completed" || !finalJob.downloadPath) {
        throw new Error(finalJob.error || "export_failed");
      }
      const downloadResponse = await apiFetch(apiBase, finalJob.downloadPath, {
        auth: true,
      });
      if (!downloadResponse.ok) {
        throw new Error("export_download_failed");
      }
      await downloadBinaryResponse(
        downloadResponse,
        `${project.id || "projeto"}-${exportVolume.trim() ? `volume-${exportVolume.trim()}` : "manga"}.zip`,
      );
      toast({
        title: "Exportação concluída",
        intent: "success",
      });
    } catch {
      toast({
        title: "Não foi possível exportar o lote",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border/60 bg-background/35 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Ferramentas de manga/webtoon</h3>
        <p className="text-xs text-muted-foreground">
          Faça preview do lote antes de importar e exporte volumes ou o projeto inteiro em ZIP.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-foreground">Importar por pasta ou ZIP</h4>
            <p className="text-xs text-muted-foreground">
              O preview detecta volume, capítulo, ordem e se haverá criação ou atualização.
            </p>
          </div>

          <div className="hidden">
            <Input
              ref={archiveInputRef}
              type="file"
              accept=".zip,.cbz,application/zip,application/x-cbz"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleArchiveSelected(file);
                }
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => void handleFolderSelected(Array.from(event.target.files || []))}
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => archiveInputRef.current?.click()}
              disabled={isPreviewing || !backendSupportsMangaImport}
              className="gap-2"
            >
              {isPreviewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4" />
              )}
              <span>Selecionar ZIP/CBZ</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              disabled={isPreviewing || !backendSupportsMangaImport}
              className="gap-2"
            >
              {isPreviewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderOpen className="h-4 w-4" />
              )}
              <span>Selecionar pasta</span>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manga-import-target-volume">Volume base</Label>
              <Input
                id="manga-import-target-volume"
                type="number"
                value={targetVolume}
                onChange={(event) => setTargetVolume(event.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manga-import-target-chapter">Capítulo base</Label>
              <Input
                id="manga-import-target-chapter"
                type="number"
                value={targetChapterNumber}
                onChange={(event) => setTargetChapterNumber(event.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {importSource ? (
            <div className="rounded-xl border border-border/60 bg-background/50 px-3 py-3 text-sm text-foreground">
              <span className="font-medium">Origem:</span> {importSource.label}
            </div>
          ) : null}

          {previewPayload ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{previewPayload.summary.chapters} capítulo(s)</Badge>
                <Badge variant="outline">{previewPayload.summary.pages} página(s)</Badge>
                {previewPayload.summary.warnings > 0 ? (
                  <Badge variant="outline">{previewPayload.summary.warnings} aviso(s)</Badge>
                ) : null}
              </div>
              <div className="max-h-64 overflow-auto rounded-xl border border-border/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-background/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Capítulo</th>
                      <th className="px-3 py-2 font-medium">Volume</th>
                      <th className="px-3 py-2 font-medium">Páginas</th>
                      <th className="px-3 py-2 font-medium">A??o</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewPayload.items.map((item) => (
                      <tr key={item.key} className="border-t border-border/50">
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">
                              Cap. {item.number}
                              {item.titleDetected ? ` - ${item.titleDetected}` : ""}
                            </div>
                            {item.warnings.length > 0 ? (
                              <div className="text-[11px] text-amber-700">
                                {item.warnings.join(", ")}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2">{item.volume ?? "—"}</td>
                        <td className="px-3 py-2">{item.pageCount}</td>
                        <td className="px-3 py-2 uppercase tracking-[0.08em]">{item.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <Button
            type="button"
            onClick={() => void handleImportConfirm()}
            disabled={!canSubmit || isImporting || !backendSupportsMangaImport}
            className="gap-2"
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>Confirmar importação</span>
          </Button>
        </section>

        <section className="space-y-4 rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-foreground">Exportar ZIP</h4>
            <p className="text-xs text-muted-foreground">
              Gere um arquivo com a árvore Volume/Capítulo/páginas e um manifesto JSON.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manga-export-volume">Volume</Label>
            <Input
              id="manga-export-volume"
              type="number"
              value={exportVolume}
              onChange={(event) => setExportVolume(event.target.value)}
              placeholder="Deixe vazio para exportar o projeto inteiro"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm">
            <Checkbox
              checked={exportIncludeDrafts}
              onCheckedChange={(checked) => setExportIncludeDrafts(checked === true)}
            />
            <span className="space-y-1">
              <span className="block font-medium text-foreground">Incluir rascunhos</span>
              <span className="block text-xs text-muted-foreground">
                Exporta também capítulos com publicação em draft.
              </span>
            </span>
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport()}
            disabled={isExporting || !backendSupportsMangaExport}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span>Exportar lote</span>
          </Button>
        </section>
      </div>
    </div>
  );
};

export default MangaImportExportPanel;



