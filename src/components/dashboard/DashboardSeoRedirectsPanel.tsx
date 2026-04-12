import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import AsyncState from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/dashboard/dashboard-form-controls";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { Plus, Save, Trash2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { applyBeforeUnloadCompatibility } from "@/lib/before-unload";
import type { SiteSettings } from "@/types/site-settings";

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

const DashboardSeoRedirectsPanel = () => {
  const apiBase = getApiBase();
  const { settings: publicSettings, refresh } = useSiteSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState<SiteSettings>(publicSettings);
  const [redirects, setRedirects] = useState<SeoRedirectRule[]>([]);
  const [savedRedirects, setSavedRedirects] = useState<SeoRedirectRule[]>([]);

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

  const redirectValidationById = useMemo(
    () =>
      redirects.reduce<Record<string, { from: string; to: string }>>((acc, rule) => {
        acc[rule.id] = {
          from: validateSeoRedirectFrom(rule.from),
          to: validateSeoRedirectTo(rule.to),
        };
        return acc;
      }, {}),
    [redirects],
  );

  const hasValidationErrors = useMemo(
    () => Object.values(redirectValidationById).some((item) => item.from || item.to),
    [redirectValidationById],
  );

  const isDirty = useMemo(
    () => stringifyRedirectRules(redirects) !== stringifyRedirectRules(savedRedirects),
    [redirects, savedRedirects],
  );

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
        auth: true,
        json: { settings: payloadSettings },
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
      <AsyncState
        kind="loading"
        title="Carregando redirecionamentos"
        description="Buscando regras 301 salvas no painel."
      />
    );
  }

  if (hasLoadError) {
    return (
      <AsyncState
        kind="error"
        title="Não foi possível carregar redirecionamentos"
        description="Tente novamente em alguns instantes."
        action={
          <Button variant="outline" onClick={() => setLoadVersion((previous) => previous + 1)}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">SEO e redirecionamentos</h2>
            <p className="text-xs text-muted-foreground">
              Gerencie regras 301. A query string da URL antiga é preservada automaticamente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DashboardActionButton type="button" size="toolbar" onClick={addSeoRedirectRule}>
              <Plus className="h-4 w-4" />
              Nova regra
            </DashboardActionButton>
            <DashboardActionButton
              type="button"
              size="toolbar"
              onClick={() => void handleSave()}
              disabled={isSaving || !isDirty}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar"}
            </DashboardActionButton>
          </div>
        </div>

        {redirects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 px-4 py-6 text-sm text-muted-foreground">
            Nenhuma regra cadastrada. Adicione uma rota antiga para redirecionar com status 301.
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
                    <DashboardFieldStack>
                      <Label htmlFor={`settings-redirect-from-${rule.id}`}>Origem</Label>
                      <DashboardFieldStack density="compact">
                        <Input
                          id={`settings-redirect-from-${rule.id}`}
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
                      </DashboardFieldStack>
                    </DashboardFieldStack>

                    <DashboardFieldStack>
                      <Label htmlFor={`settings-redirect-to-${rule.id}`}>Destino</Label>
                      <DashboardFieldStack density="compact">
                        <Input
                          id={`settings-redirect-to-${rule.id}`}
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
                      </DashboardFieldStack>
                    </DashboardFieldStack>

                    <DashboardFieldStack className="lg:justify-self-center">
                      <Label htmlFor={`settings-redirect-enabled-${rule.id}`}>Ativo</Label>
                      <div className="flex h-9 items-center">
                        <Switch
                          id={`settings-redirect-enabled-${rule.id}`}
                          checked={rule.enabled !== false}
                          onCheckedChange={(checked) =>
                            updateSeoRedirectRule(rule.id, { enabled: checked })
                          }
                          aria-label={`Ativar redirecionamento ${index + 1}`}
                        />
                      </div>
                    </DashboardFieldStack>

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
  );
};

export default DashboardSeoRedirectsPanel;
