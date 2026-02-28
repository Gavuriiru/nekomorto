import { useCallback, useEffect, useMemo, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import DashboardPageContainer from "@/components/dashboard/DashboardPageContainer";
import DashboardPageHeader from "@/components/dashboard/DashboardPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const emptyTotals: StorageAreaRow = {
  area: "total",
  originalBytes: 0,
  variantBytes: 0,
  totalBytes: 0,
  originalFiles: 0,
  variantFiles: 0,
  totalFiles: 0,
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

const DashboardUploads = () => {
  usePageMeta({ title: "Uploads", noIndex: true });
  const apiBase = getApiBase();
  const [me, setMe] = useState<MeUser | null>(null);
  const [summary, setSummary] = useState<StorageSummaryPayload>({
    generatedAt: "",
    totals: emptyTotals,
    areas: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isForbidden, setIsForbidden] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    setIsForbidden(false);
    try {
      const [meResponse, summaryResponse] = await Promise.all([
        apiFetch(apiBase, "/api/me", { auth: true }),
        apiFetch(apiBase, "/api/uploads/storage/areas", { auth: true }),
      ]);
      if (meResponse.ok) {
        setMe(await meResponse.json());
      } else {
        setMe(null);
      }
      if (summaryResponse.status === 403) {
        setIsForbidden(true);
        setSummary({
          generatedAt: "",
          totals: emptyTotals,
          areas: [],
        });
        return;
      }
      if (!summaryResponse.ok) {
        setHasError(true);
        return;
      }
      const payload = await summaryResponse.json();
      setSummary({
        generatedAt: String(payload?.generatedAt || ""),
        totals:
          payload?.totals && typeof payload.totals === "object"
            ? {
                ...emptyTotals,
                ...payload.totals,
              }
            : emptyTotals,
        areas: Array.isArray(payload?.areas)
          ? payload.areas.map((item: Partial<StorageAreaRow>) => ({
              ...emptyTotals,
              ...item,
              area: String(item?.area || "root"),
            }))
          : [],
      });
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
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

  return (
    <DashboardShell currentUser={me} isLoadingUser={isLoading}>
      <DashboardPageContainer maxWidth="7xl">
        <DashboardPageHeader
          badge="Mídia"
          title="Uploads e Storage"
          description="Consumo por área com separação entre originais e variantes automáticas."
          actions={
            <div className="flex items-center gap-2">
              <Badge className="bg-card/80 text-muted-foreground">
                Atualizado: {formatDateTime(summary.generatedAt)}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => void load()} disabled={isLoading}>
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
        </section>
      </DashboardPageContainer>
    </DashboardShell>
  );
};

export default DashboardUploads;
