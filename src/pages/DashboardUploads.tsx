import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";

type MeUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  accessRole?: string;
  grants?: Partial<Record<string, boolean>>;
};

type StorageAreaRow = {
  area: string;
  originalBytes: number;
  variantBytes: number;
  totalBytes: number;
  originalFiles: number;
  variantFiles: number;
  totalFiles: number;
};

type StorageSummaryPayload = {
  generatedAt: string;
  totals: StorageAreaRow;
  areas: StorageAreaRow[];
};

type CleanupFailure = {
  kind: "upload" | "variant";
  url: string;
  reason: string;
};

type CleanupExampleRow = {
  kind: "upload" | "variant";
  scope: "unused_upload" | "orphaned_variant";
  id: string | null;
  ownerUploadId: string | null;
  url: string;
  fileName: string;
  folder: string;
  area: string;
  createdAt: string | null;
  originalBytes: number;
  variantBytes: number;
  totalBytes: number;
};

type CleanupPreviewPayload = {
  generatedAt: string;
  unusedCount: number;
  unusedUploadCount: number;
  orphanedVariantFilesCount: number;
  orphanedVariantDirsCount: number;
  totals: StorageAreaRow;
  areas: StorageAreaRow[];
  examples: CleanupExampleRow[];
};

type CleanupRunPayload = {
  ok: boolean;
  deletedCount: number;
  deletedUnusedUploadsCount: number;
  deletedOrphanedVariantFilesCount: number;
  deletedOrphanedVariantDirsCount: number;
  failedCount: number;
  deletedTotals: StorageAreaRow;
  failures: CleanupFailure[];
};

const CLEANUP_CONFIRM_TEXT = "EXCLUIR";
const CLEANUP_ACTION_LABEL = "Limpar armazenamento não utilizado";

const emptyTotals: StorageAreaRow = {
  area: "total",
  originalBytes: 0,
  variantBytes: 0,
  totalBytes: 0,
  originalFiles: 0,
  variantFiles: 0,
  totalFiles: 0,
};

const emptySummary: StorageSummaryPayload = {
  generatedAt: "",
  totals: emptyTotals,
  areas: [],
};

const emptyCleanupPreview: CleanupPreviewPayload = {
  generatedAt: "",
  unusedCount: 0,
  unusedUploadCount: 0,
  orphanedVariantFilesCount: 0,
  orphanedVariantDirsCount: 0,
  totals: emptyTotals,
  areas: [],
  examples: [],
};

const normalizeStorageAreaRow = (
  value: Partial<StorageAreaRow> | null | undefined,
  fallbackArea: string,
): StorageAreaRow => ({
  ...emptyTotals,
  ...(value && typeof value === "object" ? value : {}),
  area: String(value?.area || fallbackArea),
});

const normalizeStorageSummaryPayload = (payload: unknown): StorageSummaryPayload => {
  const source = payload && typeof payload === "object" ? (payload as Partial<StorageSummaryPayload>) : {};
  return {
    generatedAt: String(source.generatedAt || ""),
    totals: normalizeStorageAreaRow(source.totals, "total"),
    areas: Array.isArray(source.areas)
      ? source.areas.map((item) => normalizeStorageAreaRow(item, String(item?.area || "root")))
      : [],
  };
};

const normalizeCleanupPreviewPayload = (payload: unknown): CleanupPreviewPayload => {
  const source = payload && typeof payload === "object" ? (payload as Partial<CleanupPreviewPayload>) : {};
  const examples = Array.isArray(source.examples) ? source.examples : [];
  const unusedUploadCount = Number.isFinite(Number(source.unusedUploadCount))
    ? Number(source.unusedUploadCount)
    : Number.isFinite(Number(source.unusedCount))
      ? Number(source.unusedCount)
      : 0;

  return {
    generatedAt: String(source.generatedAt || ""),
    unusedCount: Number.isFinite(Number(source.unusedCount)) ? Number(source.unusedCount) : unusedUploadCount,
    unusedUploadCount,
    orphanedVariantFilesCount: Number.isFinite(Number(source.orphanedVariantFilesCount))
      ? Number(source.orphanedVariantFilesCount)
      : 0,
    orphanedVariantDirsCount: Number.isFinite(Number(source.orphanedVariantDirsCount))
      ? Number(source.orphanedVariantDirsCount)
      : 0,
    totals: normalizeStorageAreaRow(source.totals, "total"),
    areas: Array.isArray(source.areas)
      ? source.areas.map((item) => normalizeStorageAreaRow(item, String(item?.area || "root")))
      : [],
    examples: examples.map((item) => {
      const example = item && typeof item === "object" ? (item as Partial<CleanupExampleRow>) : {};
      const kind = example.kind === "variant" ? "variant" : "upload";
      return {
        kind,
        scope: example.scope === "orphaned_variant" ? "orphaned_variant" : "unused_upload",
        id: example.id ? String(example.id) : null,
        ownerUploadId: example.ownerUploadId ? String(example.ownerUploadId) : null,
        url: String(example.url || ""),
        fileName: String(example.fileName || ""),
        folder: String(example.folder || ""),
        area: String(example.area || "root"),
        createdAt: example.createdAt ? String(example.createdAt) : null,
        originalBytes: Number.isFinite(Number(example.originalBytes)) ? Number(example.originalBytes) : 0,
        variantBytes: Number.isFinite(Number(example.variantBytes)) ? Number(example.variantBytes) : 0,
        totalBytes: Number.isFinite(Number(example.totalBytes)) ? Number(example.totalBytes) : 0,
      };
    }),
  };
};

const normalizeCleanupRunPayload = (payload: unknown): CleanupRunPayload => {
  const source = payload && typeof payload === "object" ? (payload as Partial<CleanupRunPayload>) : {};
  const failures = Array.isArray(source.failures) ? source.failures : [];
  const deletedUnusedUploadsCount = Number.isFinite(Number(source.deletedUnusedUploadsCount))
    ? Number(source.deletedUnusedUploadsCount)
    : Number.isFinite(Number(source.deletedCount))
      ? Number(source.deletedCount)
      : 0;

  return {
    ok: source.ok !== false,
    deletedCount: Number.isFinite(Number(source.deletedCount)) ? Number(source.deletedCount) : deletedUnusedUploadsCount,
    deletedUnusedUploadsCount,
    deletedOrphanedVariantFilesCount: Number.isFinite(Number(source.deletedOrphanedVariantFilesCount))
      ? Number(source.deletedOrphanedVariantFilesCount)
      : 0,
    deletedOrphanedVariantDirsCount: Number.isFinite(Number(source.deletedOrphanedVariantDirsCount))
      ? Number(source.deletedOrphanedVariantDirsCount)
      : 0,
    failedCount: Number.isFinite(Number(source.failedCount)) ? Number(source.failedCount) : 0,
    deletedTotals: normalizeStorageAreaRow(source.deletedTotals, "total"),
    failures: failures.map((item) => {
      const failure = item && typeof item === "object" ? item : {};
      return {
        kind: (failure as { kind?: string }).kind === "variant" ? "variant" : "upload",
        url: String((failure as { url?: string }).url || ""),
        reason: String((failure as { reason?: string }).reason || ""),
      };
    }),
  };
};

const formatBytes = (value: number) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let next = size;
  while (next >= 1024 && index < units.length - 1) {
    next /= 1024;
    index += 1;
  }
  const digits = next >= 100 ? 0 : next >= 10 ? 1 : 2;
  return `${next.toFixed(digits)} ${units[index]}`;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString("pt-BR");
};

const formatCleanupDescription = ({
  deletedUnusedUploadsCount,
  deletedOrphanedVariantFilesCount,
  deletedOrphanedVariantDirsCount,
  totalBytes,
}: {
  deletedUnusedUploadsCount: number;
  deletedOrphanedVariantFilesCount: number;
  deletedOrphanedVariantDirsCount: number;
  totalBytes: number;
}) =>
  `${deletedUnusedUploadsCount} uploads removidos, ${deletedOrphanedVariantFilesCount} variantes órfãs removidas, ${deletedOrphanedVariantDirsCount} diretórios órfãos removidos e ${formatBytes(totalBytes)} liberados.`;

const DashboardUploads = () => {
  usePageMeta({ title: "Uploads", noIndex: true });
  const apiBase = getApiBase();
  const [me, setMe] = useState<MeUser | null>(null);
  const [summary, setSummary] = useState<StorageSummaryPayload>(emptySummary);
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreviewPayload>(emptyCleanupPreview);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isCleanupLoading, setIsCleanupLoading] = useState(true);
  const [hasCleanupError, setHasCleanupError] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);
  const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [isCleanupRunning, setIsCleanupRunning] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    setIsCleanupLoading(true);
    setHasCleanupError(false);
    setIsForbidden(false);

    try {
      const [meResponse, summaryResponse, cleanupResponse] = await Promise.all([
        apiFetch(apiBase, "/api/me", { auth: true }),
        apiFetch(apiBase, "/api/uploads/storage/areas", { auth: true }),
        apiFetch(apiBase, "/api/uploads/storage/cleanup", { auth: true }),
      ]);

      if (meResponse.ok) {
        setMe(await meResponse.json());
      } else {
        setMe(null);
      }

      if (summaryResponse.status === 403 || cleanupResponse.status === 403) {
        setIsForbidden(true);
        setSummary(emptySummary);
        setCleanupPreview(emptyCleanupPreview);
        return;
      }

      if (summaryResponse.ok) {
        try {
          setSummary(normalizeStorageSummaryPayload(await summaryResponse.json()));
        } catch {
          setHasError(true);
          setSummary(emptySummary);
        }
      } else {
        setHasError(true);
        setSummary(emptySummary);
      }

      if (cleanupResponse.ok) {
        try {
          setCleanupPreview(normalizeCleanupPreviewPayload(await cleanupResponse.json()));
        } catch {
          setHasCleanupError(true);
          setCleanupPreview(emptyCleanupPreview);
        }
      } else {
        setHasCleanupError(true);
        setCleanupPreview(emptyCleanupPreview);
      }
    } catch {
      setHasError(true);
      setHasCleanupError(true);
      setSummary(emptySummary);
      setCleanupPreview(emptyCleanupPreview);
    } finally {
      setIsLoading(false);
      setIsCleanupLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(
    () => [
      {
        label: "Originais",
        value: formatBytes(summary.totals.originalBytes),
        files: summary.totals.originalFiles,
      },
      {
        label: "Variantes",
        value: formatBytes(summary.totals.variantBytes),
        files: summary.totals.variantFiles,
      },
      {
        label: "Total",
        value: formatBytes(summary.totals.totalBytes),
        files: summary.totals.totalFiles,
      },
    ],
    [summary.totals],
  );

  const hasCleanupCandidates = useMemo(
    () =>
      cleanupPreview.unusedUploadCount > 0 ||
      cleanupPreview.orphanedVariantFilesCount > 0 ||
      cleanupPreview.orphanedVariantDirsCount > 0,
    [
      cleanupPreview.orphanedVariantDirsCount,
      cleanupPreview.orphanedVariantFilesCount,
      cleanupPreview.unusedUploadCount,
    ],
  );

  const handleConfirmCleanup = useCallback(async () => {
    if (cleanupConfirmText !== CLEANUP_CONFIRM_TEXT || isCleanupRunning) {
      return;
    }

    setIsCleanupRunning(true);
    try {
      const response = await apiFetch(apiBase, "/api/uploads/storage/cleanup", {
        auth: true,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirm: CLEANUP_CONFIRM_TEXT,
        }),
      });

      if (!response.ok) {
        toast({
          title: "Não foi possível limpar o armazenamento",
          variant: "destructive",
        });
        return;
      }

      const payload = normalizeCleanupRunPayload(await response.json());
      setIsCleanupConfirmOpen(false);
      setCleanupConfirmText("");
      await load();

      if (payload.failedCount > 0) {
        toast({
          title: "Limpeza parcial concluida",
          description: `${formatCleanupDescription({
            deletedUnusedUploadsCount: payload.deletedUnusedUploadsCount,
            deletedOrphanedVariantFilesCount: payload.deletedOrphanedVariantFilesCount,
            deletedOrphanedVariantDirsCount: payload.deletedOrphanedVariantDirsCount,
            totalBytes: payload.deletedTotals.totalBytes,
          })} ${payload.failedCount} falharam.`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Armazenamento não utilizado removido",
        description: formatCleanupDescription({
          deletedUnusedUploadsCount: payload.deletedUnusedUploadsCount,
          deletedOrphanedVariantFilesCount: payload.deletedOrphanedVariantFilesCount,
          deletedOrphanedVariantDirsCount: payload.deletedOrphanedVariantDirsCount,
          totalBytes: payload.deletedTotals.totalBytes,
        }),
      });
    } catch {
      toast({
        title: "Não foi possível limpar o armazenamento",
        variant: "destructive",
      });
    } finally {
      setIsCleanupRunning(false);
    }
  }, [apiBase, cleanupConfirmText, isCleanupRunning, load]);

  return (
    <DashboardShell currentUser={me} isLoadingUser={isLoading}>
      <DashboardPageContainer maxWidth="7xl">
        <DashboardPageHeader
          badge="Midia"
          title="Uploads e Storage"
          description="Consumo por área com separação entre originais e variantes automáticas."
          actions={
            <div className="flex items-center gap-2">
              <Badge className="bg-card/80 text-muted-foreground">
                Atualizado: {formatDateTime(summary.generatedAt)}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void load()}
                disabled={isLoading || isCleanupLoading || isCleanupRunning}
              >
                Atualizar
              </Button>
            </div>
          }
        />

        <section className="mt-8 space-y-6">
          {isForbidden ? (
            <article className="rounded-2xl border border-border/60 bg-card/60 p-5 text-sm text-muted-foreground">
              Você não possui permissão para visualizar o painel de uploads.
            </article>
          ) : null}

          {!isForbidden ? (
            <div className="grid gap-4 md:grid-cols-3">
              {cards.map((card) => (
                <article key={card.label} className="rounded-2xl border border-border/60 bg-card/60 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{card.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.files} arquivos</p>
                </article>
              ))}
            </div>
          ) : null}

          {!isForbidden ? (
            <article className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
              <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-sm font-semibold text-foreground">Consumo por área</h2>
              </div>
              {isLoading ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">Carregando dados de storage...</p>
              ) : hasError ? (
                <p className="px-5 py-4 text-sm text-amber-300">Não foi possível carregar os dados de storage.</p>
              ) : summary.areas.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">Nenhuma área encontrada no inventário.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-background/60 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Área</th>
                        <th className="px-4 py-3 text-right">Originais</th>
                        <th className="px-4 py-3 text-right">Variantes</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Arquivos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.areas.map((area) => (
                        <tr key={area.area} className="border-t border-border/50">
                          <td className="px-4 py-3 font-medium text-foreground">{area.area}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {formatBytes(area.originalBytes)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {formatBytes(area.variantBytes)}
                          </td>
                          <td className="px-4 py-3 text-right text-foreground">
                            {formatBytes(area.totalBytes)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{area.totalFiles}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ) : null}

          {!isForbidden ? (
            <article className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-foreground">
                    Limpeza de armazenamento não utilizado
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Remove uploads sem referência e variantes órfãs encontradas em _variants.
                  </p>
                </div>
                <Badge className="bg-card/80 text-muted-foreground">
                  Análise: {formatDateTime(cleanupPreview.generatedAt)}
                </Badge>
              </div>

              {isCleanupLoading ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  Analisando armazenamento não utilizado...
                </p>
              ) : hasCleanupError ? (
                <p className="px-5 py-4 text-sm text-amber-300">
                  Não foi possível analisar o armazenamento não utilizado.
                </p>
              ) : !hasCleanupCandidates ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  Nenhum arquivo elegível para limpeza.
                </p>
              ) : (
                <div className="space-y-4 px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {cleanupPreview.unusedUploadCount} uploads sem uso
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {cleanupPreview.orphanedVariantFilesCount} arquivos de variante órfãos
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {cleanupPreview.orphanedVariantDirsCount} diretórios de variantes órfãos
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(cleanupPreview.totals.totalBytes)} recuperáveis no total
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(cleanupPreview.totals.originalBytes)} em originais e{" "}
                        {formatBytes(cleanupPreview.totals.variantBytes)} em variantes.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isCleanupRunning}
                      onClick={() => setIsCleanupConfirmOpen(true)}
                    >
                      {isCleanupRunning ? "Limpando..." : CLEANUP_ACTION_LABEL}
                    </Button>
                  </div>

                  {cleanupPreview.examples.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[820px] text-sm">
                        <thead className="bg-background/60 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left">Tipo</th>
                            <th className="px-4 py-3 text-left">Arquivo</th>
                            <th className="px-4 py-3 text-left">Área</th>
                            <th className="px-4 py-3 text-left">Criado em</th>
                            <th className="px-4 py-3 text-right">Recuperável</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cleanupPreview.examples.map((item) => (
                            <tr
                              key={`${item.kind}:${item.id || item.url}`}
                              className="border-t border-border/50"
                            >
                              <td className="px-4 py-3 text-muted-foreground">
                                {item.kind === "variant" ? "Variante órfã" : "Upload"}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-foreground">{item.fileName || item.url}</p>
                                <p className="text-xs text-muted-foreground">{item.url}</p>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">{item.area}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatDateTime(item.createdAt)}</td>
                              <td className="px-4 py-3 text-right text-foreground">
                                {formatBytes(item.totalBytes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          ) : null}
        </section>
      </DashboardPageContainer>

      <AlertDialog
        open={isCleanupConfirmOpen}
        onOpenChange={(open) => {
          if (isCleanupRunning) {
            return;
          }
          setIsCleanupConfirmOpen(open);
          if (!open) {
            setCleanupConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar armazenamento não utilizado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove uploads sem uso e variantes órfãs encontradas em _variants.
              Variantes válidas referenciadas pelo metadata atual serão preservadas. Digite EXCLUIR
              para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Uploads sem uso:{" "}
              <span className="font-semibold text-foreground">{cleanupPreview.unusedUploadCount}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Variantes órfãs:{" "}
              <span className="font-semibold text-foreground">
                {cleanupPreview.orphanedVariantFilesCount}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              Diretórios órfãos:{" "}
              <span className="font-semibold text-foreground">{cleanupPreview.orphanedVariantDirsCount}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Espaço recuperável:{" "}
              <span className="font-semibold text-foreground">
                {formatBytes(cleanupPreview.totals.totalBytes)}
              </span>
            </p>
            <Input
              value={cleanupConfirmText}
              onChange={(event) => setCleanupConfirmText(event.target.value)}
              placeholder="Digite EXCLUIR"
              disabled={isCleanupRunning}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleanupRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCleanupRunning || cleanupConfirmText !== CLEANUP_CONFIRM_TEXT}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmCleanup();
              }}
            >
              {isCleanupRunning ? "Limpando..." : CLEANUP_ACTION_LABEL}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
};

export default DashboardUploads;
