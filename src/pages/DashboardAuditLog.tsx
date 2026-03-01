import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/DashboardShell";
import AsyncState from "@/components/ui/async-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MuiBrazilDateField,
  MuiBrazilTimeField,
  MuiDateTimeFieldsProvider,
} from "@/components/ui/mui-date-time-fields";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/date";
import { usePageMeta } from "@/hooks/use-page-meta";
import { toast } from "@/components/ui/use-toast";

type AuditStatus = "success" | "failed" | "denied";

type AuditEntry = {
  id: string;
  ts: string;
  actorId: string;
  actorName: string;
  ip: string;
  action: string;
  resource: string;
  resourceId: string | null;
  status: AuditStatus;
  requestId: string | null;
  meta: Record<string, unknown>;
};

type AuditListResponse = {
  entries?: AuditEntry[];
  page?: number;
  limit?: number;
  total?: number;
};

type FilterForm = {
  q: string;
  action: string;
  resource: string;
  actorId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  limit: string;
};

type FilterDateField = "dateFrom" | "dateTo";

type AuditChangeRow = {
  field: string;
  before: unknown;
  after: unknown;
};

const pad = (value: number) => String(value).padStart(2, "0");

const toLocalDateValue = (value: Date) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

const toDateTimeInputValue = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${toLocalDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseLocalDateTimeValue = (value: string) => {
  const [datePart, timePart] = value.split("T");
  if (!datePart) {
    return { date: null as Date | null, time: "" };
  }
  const [year, month, day] = datePart.split("-").map((chunk) => Number(chunk));
  if (!year || !month || !day) {
    return { date: null as Date | null, time: "" };
  }
  return {
    date: new Date(year, month - 1, day),
    time: timePart || "",
  };
};

const toTimeFieldValue = (time: string, fallback = "00:00") => {
  const [hoursPart, minutesPart] = (time || fallback).split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  const next = new Date();
  next.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
};

const parsePage = (value: string | null) => {
  const parsed = Number(value || "");
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
};

const parseLimit = (value: string | null) => {
  const parsed = Number(value || "");
  if (!Number.isFinite(parsed) || parsed < 10) {
    return 50;
  }
  return Math.min(Math.floor(parsed), 100);
};

const normalizeStatusFilter = (value: string | null) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["all", "success", "failed", "denied"].includes(normalized)) {
    return normalized;
  }
  return "all";
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "posts.create": "Posts · Criação",
  "posts.update": "Posts · Atualização",
  "posts.delete": "Posts · Exclusão",
  "posts.restore": "Posts · Restauração",
  "posts.version.create": "Posts · Versão criada",
  "posts.rollback": "Posts · Rollback",
  "projects.create": "Projetos · Criação",
  "projects.update": "Projetos · Atualização",
  "projects.delete": "Projetos · Exclusão",
  "projects.restore": "Projetos · Restauração",
  "comments.approve": "Comentários · Aprovação",
  "comments.delete": "Comentários · Exclusão",
  "comments.bulk.approve": "Comentários · Aprovação em massa",
  "comments.bulk.delete": "Comentários · Exclusão em massa",
  "ops_alerts.webhook.sent": "Alertas operacionais · Webhook enviado",
  "ops_alerts.webhook.failed": "Alertas operacionais · Webhook falhou",
  "ops_alerts.webhook.skipped": "Alertas operacionais · Webhook ignorado",
  "auth.login.success": "Autenticação · Login",
  "auth.logout": "Autenticação · Logout",
};

const humanizeAuditAction = (action: string) => {
  const normalized = String(action || "").trim();
  if (!normalized) {
    return "Evento";
  }
  if (AUDIT_ACTION_LABELS[normalized]) {
    return AUDIT_ACTION_LABELS[normalized];
  }
  const [resource = "evento", verb = "ação"] = normalized.split(".");
  const resourceLabel = resource.charAt(0).toUpperCase() + resource.slice(1);
  const verbLabel = verb.replace(/_/g, " ");
  return `${resourceLabel} · ${verbLabel.charAt(0).toUpperCase()}${verbLabel.slice(1)}`;
};

const humanizeAuditStatus = (status: AuditStatus) => {
  if (status === "failed") return "Falha";
  if (status === "denied") return "Negado";
  return "Sucesso";
};

const summarizeMeta = (meta: Record<string, unknown>) => {
  const safeMeta = meta && typeof meta === "object" ? meta : {};
  const entries: Array<{ label: string; value: string }> = [];
  const pushIfPresent = (label: string, keys: string[]) => {
    for (const key of keys) {
      const raw = safeMeta[key];
      if (raw === undefined || raw === null || raw === "") {
        continue;
      }
      entries.push({
        label,
        value: typeof raw === "string" ? raw : JSON.stringify(raw),
      });
      return;
    }
  };
  pushIfPresent("ID", ["id", "resourceId", "targetId"]);
  pushIfPresent("Slug", ["slug"]);
  pushIfPresent("Projeto", ["projectId"]);
  pushIfPresent("Usuário", ["userId", "ownerId"]);
  pushIfPresent("Quantidade", ["processedCount", "count"]);
  pushIfPresent("Erro", ["error"]);
  return entries.slice(0, 8);
};

const getAuditChanges = (meta: Record<string, unknown>): AuditChangeRow[] => {
  const rawChanges = meta?.changes;
  if (!Array.isArray(rawChanges)) {
    return [];
  }
  return rawChanges
    .map((change) => {
      if (!change || typeof change !== "object") {
        return null;
      }
      return {
        field: String((change as { field?: unknown }).field || "").trim(),
        before: (change as { before?: unknown }).before,
        after: (change as { after?: unknown }).after,
      };
    })
    .filter((item): item is AuditChangeRow => Boolean(item?.field));
};

const formatMetaValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const DashboardAuditLog = () => {
  usePageMeta({ title: "Auditoria", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [form, setForm] = useState<FilterForm>({
    q: "",
    action: "",
    resource: "",
    actorId: "",
    status: "all",
    dateFrom: "",
    dateTo: "",
    limit: "50",
  });

  const page = parsePage(searchParams.get("page"));
  const limit = parseLimit(searchParams.get("limit"));
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  const dateFromParts = parseLocalDateTimeValue(form.dateFrom);
  const dateToParts = parseLocalDateTimeValue(form.dateTo);
  const dateFromTimeValue = toTimeFieldValue(dateFromParts.time || "00:00");
  const dateToTimeValue = toTimeFieldValue(dateToParts.time || "00:00");

  const handleFilterDateChange = (field: FilterDateField, nextDate: Date | null) => {
    setForm((prev) => {
      if (!nextDate) {
        return { ...prev, [field]: "" };
      }
      const { time } = parseLocalDateTimeValue(prev[field]);
      const timePart = time || "00:00";
      return {
        ...prev,
        [field]: `${toLocalDateValue(nextDate)}T${timePart}`,
      };
    });
  };

  const handleFilterTimeChange = (field: FilterDateField, nextTime: Date | null) => {
    if (!nextTime || Number.isNaN(nextTime.getTime())) {
      return;
    }
    const nextTimePart = `${pad(nextTime.getHours())}:${pad(nextTime.getMinutes())}`;
    setForm((prev) => {
      const { date } = parseLocalDateTimeValue(prev[field]);
      if (!date) {
        return prev;
      }
      return {
        ...prev,
        [field]: `${toLocalDateValue(date)}T${nextTimePart}`,
      };
    });
  };

  useEffect(() => {
    setForm({
      q: searchParams.get("q") || "",
      action: searchParams.get("action") || "",
      resource: searchParams.get("resource") || "",
      actorId: searchParams.get("actorId") || "",
      status: normalizeStatusFilter(searchParams.get("status")),
      dateFrom: toDateTimeInputValue(searchParams.get("dateFrom") || ""),
      dateTo: toDateTimeInputValue(searchParams.get("dateTo") || ""),
      limit: String(parseLimit(searchParams.get("limit"))),
    });
  }, [searchParams]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      } finally {
        setIsLoadingUser(false);
      }
    };

    loadUser();
  }, [apiBase]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setError("");
      setForbidden(false);
      try {
        const params = new URLSearchParams(searchParams);
        if (!params.get("page")) {
          params.set("page", "1");
        }
        if (!params.get("limit")) {
          params.set("limit", "50");
        }
        const response = await apiFetch(apiBase, `/api/audit-log?${params.toString()}`, {
          auth: true,
        });
        if (!isMounted) {
          return;
        }
        if (response.status === 403) {
          setForbidden(true);
          setEntries([]);
          setTotal(0);
          return;
        }
        if (!response.ok) {
          setError("Não foi possível carregar o audit log.");
          setEntries([]);
          setTotal(0);
          return;
        }
        const data = (await response.json()) as AuditListResponse;
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setTotal(Number.isFinite(data.total) ? Number(data.total) : 0);
      } catch {
        if (!isMounted) {
          return;
        }
        setError("Erro de conexão ao carregar o audit log.");
        setEntries([]);
        setTotal(0);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [apiBase, refreshTick, searchParams]);

  const statusBadgeVariant = (status: AuditStatus) => {
    if (status === "failed") {
      return "danger";
    }
    if (status === "denied") {
      return "warning";
    }
    return "success";
  };

  const applyFilters = () => {
    const next = new URLSearchParams();
    next.set("page", "1");
    next.set("limit", form.limit || "50");
    if (form.q.trim()) next.set("q", form.q.trim());
    if (form.action.trim()) next.set("action", form.action.trim());
    if (form.resource.trim()) next.set("resource", form.resource.trim());
    if (form.actorId.trim()) next.set("actorId", form.actorId.trim());
    if (normalizeStatusFilter(form.status) !== "all")
      next.set("status", normalizeStatusFilter(form.status));
    if (form.dateFrom) {
      const dateFromIso = new Date(form.dateFrom);
      if (!Number.isNaN(dateFromIso.getTime())) {
        next.set("dateFrom", dateFromIso.toISOString());
      }
    }
    if (form.dateTo) {
      const dateToIso = new Date(form.dateTo);
      if (!Number.isNaN(dateToIso.getTime())) {
        next.set("dateTo", dateToIso.toISOString());
      }
    }
    setSearchParams(next);
  };

  const clearFilters = () => {
    setForm({
      q: "",
      action: "",
      resource: "",
      actorId: "",
      status: "all",
      dateFrom: "",
      dateTo: "",
      limit: "50",
    });
    setSearchParams(new URLSearchParams({ page: "1", limit: "50" }));
  };

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    const next = new URLSearchParams(searchParams);
    next.set("page", String(safePage));
    next.set("limit", String(limit));
    setSearchParams(next);
  };

  const formattedTotal = useMemo(() => total.toLocaleString("pt-BR"), [total]);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    if (isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      const params = new URLSearchParams(searchParams);
      params.set("format", "csv");
      const response = await apiFetch(apiBase, `/api/audit-log?${params.toString()}`, {
        auth: true,
      });
      if (!response.ok) {
        setError("Não foi possível exportar o CSV.");
        toast({
          title: "Falha ao exportar CSV",
          description: "Não foi possível gerar o arquivo no momento.",
          variant: "destructive",
        });
        return;
      }
      const isTruncated = response.headers.get("X-Audit-Export-Truncated") === "1";
      if (isTruncated) {
        const count = response.headers.get("X-Audit-Export-Count") || "";
        const total = response.headers.get("X-Audit-Export-Total") || "";
        toast({
          title: "CSV exportado com limite",
          description: `Foram exportados ${count || "10000"} de ${total || "muitos"} eventos.`,
        });
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const dateStamp = new Date().toISOString().slice(0, 10);
      anchor.download = `audit-log-${dateStamp}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      if (!isTruncated) {
        toast({
          title: "CSV exportado",
          description: "O arquivo foi gerado com sucesso.",
          intent: "success",
        });
      }
    } catch {
      setError("Erro ao exportar CSV.");
      toast({
        title: "Falha ao exportar CSV",
        description: "Ocorreu um erro inesperado durante a exportação.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={isLoadingUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <main className="pt-24">
          <section className="mx-auto w-full max-w-7xl px-6 pb-20 md:px-10">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
                  Auditoria
                </div>
                <h1 className="mt-4 text-3xl font-semibold lg:text-4xl animate-slide-up">
                  Registro de Auditoria
                </h1>
                <p
                  className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
                  style={{ animationDelay: "0.2s" }}
                >
                  Eventos mutáveis e de segurança dos últimos 30 dias.
                </p>
              </div>
              <div
                className="flex items-center gap-3 animate-slide-up opacity-0"
                style={{ animationDelay: "0.24s" }}
              >
                <Badge className="bg-card/80 text-muted-foreground">{formattedTotal} eventos</Badge>
                <Button
                  variant="outline"
                  onClick={() => void handleExportCsv()}
                  disabled={isExporting || forbidden}
                >
                  {isExporting ? "Exportando..." : "Exportar CSV"}
                </Button>
                <Button variant="outline" onClick={() => setRefreshTick((value) => value + 1)}>
                  Atualizar
                </Button>
              </div>
            </header>

            <div
              className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-4 md:p-5 animate-slide-up opacity-0"
              style={{ animationDelay: "0.28s" }}
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-2">
                  <Label htmlFor="audit-q">Busca</Label>
                  <Input
                    id="audit-q"
                    value={form.q}
                    onChange={(event) => setForm((prev) => ({ ...prev, q: event.target.value }))}
                    placeholder="ator, IP, meta..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="audit-action">Ação</Label>
                  <Input
                    id="audit-action"
                    value={form.action}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, action: event.target.value }))
                    }
                    placeholder="ex.: posts.update"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="audit-resource">Recurso</Label>
                  <Input
                    id="audit-resource"
                    value={form.resource}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, resource: event.target.value }))
                    }
                    placeholder="ex.: posts"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="audit-actor">Actor ID</Label>
                  <Input
                    id="audit-actor"
                    value={form.actorId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, actorId: event.target.value }))
                    }
                    placeholder="ID do Discord"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="success">Sucesso</SelectItem>
                      <SelectItem value="failed">Falha</SelectItem>
                      <SelectItem value="denied">Negado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="audit-date-from">Data inicial</Label>
                  <MuiDateTimeFieldsProvider>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <MuiBrazilDateField
                        id="audit-date-from"
                        value={dateFromParts.date}
                        onChange={(nextDate) => handleFilterDateChange("dateFrom", nextDate)}
                      />
                      <MuiBrazilTimeField
                        id="audit-date-from-time"
                        value={dateFromTimeValue}
                        onChange={(nextTime) => handleFilterTimeChange("dateFrom", nextTime)}
                        disabled={!form.dateFrom}
                      />
                    </div>
                  </MuiDateTimeFieldsProvider>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="audit-date-to">Data final</Label>
                  <MuiDateTimeFieldsProvider>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <MuiBrazilDateField
                        id="audit-date-to"
                        value={dateToParts.date}
                        onChange={(nextDate) => handleFilterDateChange("dateTo", nextDate)}
                      />
                      <MuiBrazilTimeField
                        id="audit-date-to-time"
                        value={dateToTimeValue}
                        onChange={(nextTime) => handleFilterTimeChange("dateTo", nextTime)}
                        disabled={!form.dateTo}
                      />
                    </div>
                  </MuiDateTimeFieldsProvider>
                </div>
                <div className="grid gap-2">
                  <Label>Itens por página</Label>
                  <Select
                    value={form.limit}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, limit: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="50" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={applyFilters}>Aplicar filtros</Button>
                <Button variant="outline" onClick={clearFilters}>
                  Limpar
                </Button>
              </div>
            </div>

            <div
              className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-2 md:p-4 animate-slide-up opacity-0"
              style={{ animationDelay: "0.32s" }}
            >
              {forbidden ? (
                <AsyncState
                  kind="error"
                  title="Acesso negado"
                  description="Apenas o dono pode visualizar o audit log."
                />
              ) : isLoading ? (
                <AsyncState
                  kind="loading"
                  title="Carregando auditoria"
                  description="Buscando eventos mais recentes."
                />
              ) : error ? (
                <AsyncState
                  kind="error"
                  title="Não foi possível carregar o audit log"
                  description={error}
                  action={
                    <Button variant="outline" onClick={() => setRefreshTick((value) => value + 1)}>
                      Tentar novamente
                    </Button>
                  }
                />
              ) : entries.length === 0 ? (
                <AsyncState
                  kind="empty"
                  title="Nenhum evento encontrado para os filtros atuais."
                  description="Ajuste os filtros ou limpe para ver mais resultados."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Ator</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Alvo</TableHead>
                      <TableHead className="text-right">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDateTime(entry.ts)}</TableCell>
                        <TableCell className="max-w-44">
                          <div className="truncate">{entry.actorName || "anonymous"}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {entry.actorId}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-56">
                          <div className="truncate text-sm">
                            {humanizeAuditAction(entry.action)}
                          </div>
                          <div className="truncate font-mono text-xs text-muted-foreground">
                            {entry.action}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>{entry.resource || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.resourceId || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(entry.status)}>
                            {humanizeAuditStatus(entry.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{entry.ip || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {entry.resourceId || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedEntry(entry)}
                          >
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {!forbidden && !error && !isLoading ? (
              <div
                className="mt-4 flex items-center justify-between gap-3 animate-slide-up opacity-0"
                style={{ animationDelay: "0.36s" }}
              >
                <p className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || isLoading}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages || isLoading}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            ) : null}
          </section>
        </main>
      </DashboardShell>

      <Dialog
        open={Boolean(selectedEntry)}
        onOpenChange={(open) => !open && setSelectedEntry(null)}
      >
        <DialogContent className="w-[95vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do evento</DialogTitle>
            <DialogDescription>
              {selectedEntry ? `${selectedEntry.action} • ${formatDateTime(selectedEntry.ts)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry ? (
            <div className="space-y-3">
              <div className="grid gap-2 rounded-xl border border-border/60 bg-card/60 p-4 text-sm md:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Ator</p>
                  <p>
                    {selectedEntry.actorName} ({selectedEntry.actorId})
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Request ID</p>
                  <p className="font-mono text-xs">{selectedEntry.requestId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">IP</p>
                  <p className="font-mono text-xs">{selectedEntry.ip || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={statusBadgeVariant(selectedEntry.status)}>
                    {humanizeAuditStatus(selectedEntry.status)}
                  </Badge>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/80 p-4">
                <p className="mb-2 text-sm text-muted-foreground">Resumo</p>
                <div className="grid gap-2 text-sm md:grid-cols-2">
                  {summarizeMeta(selectedEntry.meta || {}).length > 0 ? (
                    summarizeMeta(selectedEntry.meta || {}).map((item) => (
                      <div key={`${item.label}-${item.value}`} className="min-w-0">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="truncate" title={item.value}>
                          {item.value}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground md:col-span-2">
                      Sem campos resumíveis neste evento.
                    </p>
                  )}
                </div>
              </div>
              {getAuditChanges(selectedEntry.meta || {}).length > 0 ? (
                <div className="rounded-xl border border-border/60 bg-card/80 p-4">
                  <p className="mb-2 text-sm text-muted-foreground">Mudanças</p>
                  <div className="space-y-2">
                    {getAuditChanges(selectedEntry.meta || {}).map((change) => (
                      <div
                        key={change.field}
                        className="rounded-lg border border-border/60 bg-background/50 p-3"
                      >
                        <p className="text-xs font-medium text-muted-foreground">{change.field}</p>
                        <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                          <div>
                            <p className="text-muted-foreground">Antes</p>
                            <p className="break-words">{formatMetaValue(change.before)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Depois</p>
                            <p className="break-words">{formatMetaValue(change.after)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedEntry.meta?.before !== undefined ||
              selectedEntry.meta?.after !== undefined ? (
                <div className="space-y-2">
                  {selectedEntry.meta?.before !== undefined ? (
                    <details className="rounded-xl border border-border/60 bg-card/80 p-4">
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        Antes (raw)
                      </summary>
                      <pre className="mt-3 max-h-[25vh] overflow-auto text-xs leading-relaxed text-foreground">
                        {JSON.stringify(selectedEntry.meta.before, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                  {selectedEntry.meta?.after !== undefined ? (
                    <details className="rounded-xl border border-border/60 bg-card/80 p-4">
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        Depois (raw)
                      </summary>
                      <pre className="mt-3 max-h-[25vh] overflow-auto text-xs leading-relaxed text-foreground">
                        {JSON.stringify(selectedEntry.meta.after, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-xl border border-border/60 bg-card/80 p-4">
                <p className="mb-2 text-sm text-muted-foreground">Meta raw</p>
                <pre className="max-h-[45vh] overflow-auto text-xs leading-relaxed text-foreground">
                  {JSON.stringify(selectedEntry.meta || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DashboardAuditLog;
