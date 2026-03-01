import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "@/components/DashboardShell";
import AsyncState from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Plus, Save, Trash2 } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { applyBeforeUnloadCompatibility } from "@/lib/before-unload";

type SeoRedirectRule = SiteSettings["seo"]["redirects"][number];

const createSeoRedirectId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `redirect-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeSeoRedirectFromDraft = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return trimmed;
  }
  const withoutHash = trimmed.split("#")[0] || "";
  const withoutQuery = withoutHash.split("?")[0] || "";
  if (!withoutQuery) {
    return "/";
  }
  if (withoutQuery === "/") {
    return "/";
  }
  return withoutQuery.replace(/\/+$/, "");
};

const validateSeoRedirectFrom = (value: string) => {
  const raw = String(value || "").trim();
  if (raw.includes("?") || raw.includes("#")) {
    return "A origem não pode conter query string ou hash.";
  }
  const normalized = normalizeSeoRedirectFromDraft(value);
  if (!normalized) {
    return "Informe a rota antiga.";
  }
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return "A origem precisa ser um caminho interno iniciado por /.";
  }
  return "";
};

const validateSeoRedirectTo = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "Informe a rota de destino.";
  }
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) {
      return "Destino interno inválido.";
    }
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    const protocol = String(parsed.protocol || "").toLowerCase();
    if (protocol === "http:" || protocol === "https:") {
      return "";
    }
    return "Destino absoluto precisa usar http ou https.";
  } catch {
    return "Destino inválido.";
  }
};

const buildEmptySeoRedirectRule = (): SeoRedirectRule => ({
  id: createSeoRedirectId(),
  from: "",
  to: "",
  enabled: true,
});

const normalizeRedirectRules = (value: unknown): SeoRedirectRule[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const rule = item as Partial<SeoRedirectRule>;
      return {
        id: String(rule.id || createSeoRedirectId()),
        from: String(rule.from || ""),
        to: String(rule.to || ""),
        enabled: rule.enabled !== false,
      };
    });
};

const stringifyRedirectRules = (value: SeoRedirectRule[]) =>
  JSON.stringify(
    (Array.isArray(value) ? value : []).map((rule) => ({
      id: String(rule.id || ""),
      from: String(rule.from || ""),
      to: String(rule.to || ""),
      enabled: rule.enabled !== false,
    })),
  );

const DashboardRedirects = () => {
  usePageMeta({ title: "Redirecionamentos", noIndex: true });
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const { settings: publicSettings, refresh } = useSiteSettings();

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    email?: string | null;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState<SiteSettings>(publicSettings);
  const [redirects, setRedirects] = useState<SeoRedirectRule[]>([]);
  const [savedRedirects, setSavedRedirects] = useState<SeoRedirectRule[]>([]);

  useEffect(() => {
    const loadUser = async () => {
      setIsLoadingUser(true);
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
    void loadUser();
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      setIsLoading(true);
      setHasLoadError(false);
      try {
        const response = await apiFetch(apiBase, "/api/settings", { auth: true });
        if (!response.ok) {
          throw new Error("settings_load_failed");
        }
        const data = await response.json();
        if (!isActive) {
          return;
        }
        const nextSettings = mergeSettings(defaultSettings, data?.settings || {});
        const nextRedirects = normalizeRedirectRules(nextSettings?.seo?.redirects);
        setSettingsSnapshot(nextSettings);
        setRedirects(nextRedirects);
        setSavedRedirects(nextRedirects);
      } catch {
        if (!isActive) {
          return;
        }
        const fallbackSettings = mergeSettings(defaultSettings, publicSettings || {});
        const fallbackRedirects = normalizeRedirectRules(fallbackSettings?.seo?.redirects);
        setSettingsSnapshot(fallbackSettings);
        setRedirects(fallbackRedirects);
        setSavedRedirects(fallbackRedirects);
        setHasLoadError(true);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, loadVersion, publicSettings]);

  const updateSeoRedirectRule = useCallback((id: string, patch: Partial<SeoRedirectRule>) => {
    setRedirects((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }, []);

  const addSeoRedirectRule = useCallback(() => {
    setRedirects((prev) => [...prev, buildEmptySeoRedirectRule()]);
  }, []);

  const removeSeoRedirectRule = useCallback((id: string) => {
    setRedirects((prev) => prev.filter((rule) => rule.id !== id));
  }, []);

  const redirectValidationById = useMemo(() => {
    return redirects.reduce<Record<string, { from: string; to: string }>>((acc, rule) => {
      acc[rule.id] = {
        from: validateSeoRedirectFrom(rule.from),
        to: validateSeoRedirectTo(rule.to),
      };
      return acc;
    }, {});
  }, [redirects]);

  const hasValidationErrors = useMemo(() => {
    return Object.values(redirectValidationById).some((item) => item.from || item.to);
  }, [redirectValidationById]);

  const isDirty = useMemo(() => {
    return stringifyRedirectRules(redirects) !== stringifyRedirectRules(savedRedirects);
  }, [redirects, savedRedirects]);

  useEffect(() => {
    if (isLoading || !isDirty) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      applyBeforeUnloadCompatibility(event);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isLoading]);

  const handleSave = useCallback(async () => {
    if (isSaving) {
      return;
    }
    if (hasValidationErrors) {
      toast({
        title: "Campos inválidos",
        description: "Revise as regras de redirecionamento antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    const payloadSettings: SiteSettings = {
      ...settingsSnapshot,
      seo: {
        ...(settingsSnapshot?.seo && typeof settingsSnapshot.seo === "object"
          ? settingsSnapshot.seo
          : { redirects: [] }),
        redirects,
      },
    };
    try {
      const response = await apiFetch(apiBase, "/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        auth: true,
        body: JSON.stringify({ settings: payloadSettings }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const data = await response.json().catch(() => null);
      const normalizedSettings = mergeSettings(defaultSettings, data?.settings || payloadSettings);
      const normalizedRedirects = normalizeRedirectRules(normalizedSettings?.seo?.redirects);
      setSettingsSnapshot(normalizedSettings);
      setRedirects(normalizedRedirects);
      setSavedRedirects(normalizedRedirects);
      await refresh().catch(() => undefined);
      toast({
        title: "Redirecionamentos salvos",
        description: "As regras 301 foram atualizadas com sucesso.",
      });
    } catch {
      toast({
        title: "Falha ao salvar",
        description: "Não foi possível salvar os redirecionamentos.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [apiBase, hasValidationErrors, isSaving, redirects, refresh, settingsSnapshot]);

  if (isLoading) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={isLoadingUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <main className="pt-28">
          <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:px-10">
            <AsyncState
              kind="loading"
              title="Carregando redirecionamentos"
              description="Buscando regras 301 salvas no painel."
            />
          </section>
        </main>
      </DashboardShell>
    );
  }

  if (hasLoadError) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={isLoadingUser}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <main className="pt-28">
          <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:px-10">
            <AsyncState
              kind="error"
              title="Não foi possível carregar redirecionamentos"
              description="Tente novamente em alguns instantes."
              action={
                <Button
                  variant="outline"
                  onClick={() => setLoadVersion((previous) => previous + 1)}
                >
                  Tentar novamente
                </Button>
              }
            />
          </section>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <main className="pt-24">
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
                Redirecionamentos
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-foreground animate-slide-up">
                Regras 301
              </h1>
              <p
                className="mt-2 text-sm text-muted-foreground animate-slide-up opacity-0"
                style={{ animationDelay: "0.2s" }}
              >
                Gerencie redirecionamentos 301 de URLs antigas para novas URLs.
              </p>
            </div>
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                void handleSave();
              }}
              disabled={isSaving || !isDirty}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar redirecionamentos"}
            </Button>
          </div>

          <Card className="mt-8 border-border/60 bg-card/80 animate-slide-up opacity-0">
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Regras de redirecionamento 301</h2>
                  <p className="text-xs text-muted-foreground">
                    A query string da URL antiga e preservada automaticamente.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={addSeoRedirectRule}
                >
                  <Plus className="h-4 w-4" />
                  Nova regra
                </Button>
              </div>

              {redirects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 px-4 py-6 text-sm text-muted-foreground">
                  Nenhuma regra cadastrada. Adicione uma rota antiga para redirecionar com status
                  301.
                </div>
              ) : (
                <div className="space-y-3">
                  {redirects.map((rule, index) => {
                    const validation = redirectValidationById[rule.id] || { from: "", to: "" };
                    const hasError = Boolean(validation.from || validation.to);
                    return (
                      <div
                        key={rule.id}
                        className={`rounded-2xl border p-4 ${
                          hasError
                            ? "border-destructive/60 bg-destructive/5"
                            : "border-border/60 bg-background/50"
                        }`}
                      >
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] lg:items-start">
                          <div className="space-y-1.5">
                            <Label htmlFor={`redirect-from-${rule.id}`}>Origem</Label>
                            <Input
                              id={`redirect-from-${rule.id}`}
                              value={rule.from}
                              placeholder="/url-antiga"
                              onChange={(event) =>
                                updateSeoRedirectRule(rule.id, { from: event.target.value })
                              }
                              onBlur={(event) =>
                                updateSeoRedirectRule(rule.id, {
                                  from: normalizeSeoRedirectFromDraft(event.target.value),
                                })
                              }
                            />
                            {validation.from ? (
                              <p className="text-xs text-destructive">{validation.from}</p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor={`redirect-to-${rule.id}`}>Destino</Label>
                            <Input
                              id={`redirect-to-${rule.id}`}
                              value={rule.to}
                              placeholder="/url-nova ou https://dominio.com/pagina"
                              onChange={(event) =>
                                updateSeoRedirectRule(rule.id, { to: event.target.value })
                              }
                              onBlur={(event) =>
                                updateSeoRedirectRule(rule.id, {
                                  to: String(event.target.value || "").trim(),
                                })
                              }
                            />
                            {validation.to ? (
                              <p className="text-xs text-destructive">{validation.to}</p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5 lg:justify-self-center">
                            <Label htmlFor={`redirect-enabled-${rule.id}`}>Ativo</Label>
                            <div className="flex h-9 items-center">
                              <Switch
                                id={`redirect-enabled-${rule.id}`}
                                checked={rule.enabled !== false}
                                onCheckedChange={(checked) =>
                                  updateSeoRedirectRule(rule.id, { enabled: checked })
                                }
                                aria-label={`Ativar redirecionamento ${index + 1}`}
                              />
                            </div>
                          </div>

                          <div className="flex h-9 items-center lg:justify-self-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:text-destructive"
                              aria-label={`Remover redirecionamento ${index + 1}`}
                              onClick={() => removeSeoRedirectRule(rule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </DashboardShell>
  );
};

export default DashboardRedirects;
