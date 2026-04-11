import { useCallback, useMemo, type FocusEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import DashboardAutosaveStatus from "@/components/DashboardAutosaveStatus";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import DashboardActionButton, { default as Button } from "@/components/dashboard/DashboardActionButton";
import {
  Input,
  Textarea,
} from "@/components/dashboard/dashboard-form-controls";
import {
  dashboardStrongFocusFieldClassName,
  dashboardStrongFocusScopeClassName,
  dashboardStrongFocusTriggerClassName,
  dashboardStrongSurfaceHoverClassName,
} from "@/components/dashboard/dashboard-page-tokens";
import DashboardShell from "@/components/DashboardShell";
import {
  dashboardAnimationDelay,
  dashboardMotionDelays,
} from "@/components/dashboard/dashboard-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AsyncState from "@/components/ui/async-state";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { autosaveRuntimeConfig } from "@/config/autosave";
import { getApiBase } from "@/lib/api-base";
import { clearDashboardSettingsCache } from "@/lib/dashboard-settings-cache";
import { resolveBranding } from "@/lib/branding";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useDashboardCurrentUser } from "@/hooks/use-dashboard-current-user";
import { usePageMeta } from "@/hooks/use-page-meta";
import { DashboardSettingsProvider } from "@/components/dashboard/settings/dashboard-settings-context";
import type { DashboardSettingsContextValue } from "@/components/dashboard/settings/dashboard-settings-types";
import { DashboardSettingsGeneralTab } from "@/components/dashboard/settings/DashboardSettingsGeneralTab";
import { DashboardSettingsReaderTab } from "@/components/dashboard/settings/DashboardSettingsReaderTab";
import { DashboardSettingsSeoTab } from "@/components/dashboard/settings/DashboardSettingsSeoTab";
import { DashboardSettingsDownloadsTab } from "@/components/dashboard/settings/DashboardSettingsDownloadsTab";
import { DashboardSettingsTeamTab } from "@/components/dashboard/settings/DashboardSettingsTeamTab";
import { DashboardSettingsLayoutTab } from "@/components/dashboard/settings/DashboardSettingsLayoutTab";
import { DashboardSettingsSocialLinksTab } from "@/components/dashboard/settings/DashboardSettingsSocialLinksTab";
import { DashboardSettingsTranslationsTab } from "@/components/dashboard/settings/DashboardSettingsTranslationsTab";
import { useDashboardSettingsResource } from "@/components/dashboard/settings/use-dashboard-settings-resource";
import { useDashboardSettingsMedia } from "@/components/dashboard/settings/use-dashboard-settings-media";
import LazyImageLibraryDialog from "@/components/lazy/LazyImageLibraryDialog";
import {
  type LogoEditorField,
  readLogoField,
  type SettingsTabKey,
} from "@/components/dashboard/settings/shared";

const dashboardSettingsTabComponents = [
  { key: "geral", Component: DashboardSettingsGeneralTab },
  { key: "leitor", Component: DashboardSettingsReaderTab },
  { key: "seo", Component: DashboardSettingsSeoTab },
  { key: "downloads", Component: DashboardSettingsDownloadsTab },
  { key: "equipe", Component: DashboardSettingsTeamTab },
  { key: "layout", Component: DashboardSettingsLayoutTab },
  { key: "redes-usuarios", Component: DashboardSettingsSocialLinksTab },
  { key: "traducoes", Component: DashboardSettingsTranslationsTab },
] as const satisfies ReadonlyArray<{
  key: SettingsTabKey;
  Component: typeof DashboardSettingsGeneralTab;
}>;

// focus-ring contract markers:
// dashboardStrongFocusTriggerClassName
// dashboardStrongFocusFieldClassName
// dashboardStrongSurfaceHoverClassName
// panelClassName={dashboardStrongFocusScopeClassName}

const DashboardSettingsContent = () => {
  usePageMeta({ title: "Configurações", noIndex: true });

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const apiBase = getApiBase();
  const { settings: publicSettings, refresh } = useSiteSettings();
  const resource = useDashboardSettingsResource({
    apiBase,
    location,
    navigate,
    publicSettings,
    refresh,
    searchParams,
  });
  const media = useDashboardSettingsMedia({
    apiBase,
    linkTypes: resource.linkTypes,
    setLinkTypes: resource.setLinkTypes,
    settings: resource.settings,
    setSettings: resource.setSettings,
  });

  const branding = useMemo(() => resolveBranding(resource.settings), [resource.settings]);
  const ActiveSettingsTab =
    dashboardSettingsTabComponents.find(({ key }) => key === resource.activeTab)?.Component ??
    DashboardSettingsGeneralTab;
  const siteNamePreview = (resource.settings.site.name || "Nekomata").trim() || "Nekomata";
  const footerBrandNamePreview =
    (resource.settings.site.name || resource.settings.footer.brandName || "Nekomata").trim() ||
    "Nekomata";
  const footerBrandNameUpperPreview = footerBrandNamePreview.toUpperCase();
  const navbarMode = branding.display.navbar;
  const footerMode = branding.display.footer;
  const showWordmarkInNavbarPreview = branding.navbar.showWordmark;
  const showWordmarkInFooterPreview = branding.footer.showWordmark;
  const showNavbarSymbolPreview = navbarMode === "symbol-text" || navbarMode === "symbol";
  const showNavbarTextPreview = navbarMode === "symbol-text" || navbarMode === "text";
  const isNavbarPreviewLight = resource.settings.theme.mode === "light";
  const navbarPreviewShellClass = isNavbarPreviewLight
    ? "border-border/70 bg-card/95 text-foreground"
    : "border-border/70 bg-sidebar text-sidebar-foreground";
  const navbarPreviewFallbackClass = isNavbarPreviewLight
    ? "border-border/70 bg-card text-foreground"
    : "border-border/70 bg-sidebar-accent/45 text-sidebar-foreground";

  const logoFieldState = useMemo(() => {
    return {
      "branding.assets.symbolUrl": {
        value: branding.direct.symbolAssetUrl,
        preview: branding.assets.symbolUrl,
        status: branding.direct.symbolAssetUrl
          ? "Símbolo principal ativo."
          : branding.legacy.siteSymbolUrl
            ? "Sem valor no modelo novo. Usando fallback legado."
            : "Sem símbolo definido.",
      },
      "branding.assets.wordmarkUrl": {
        value: branding.direct.wordmarkAssetUrl,
        preview: branding.assets.wordmarkUrl,
        status: branding.direct.wordmarkAssetUrl
          ? "Logotipo principal ativo."
          : branding.legacy.wordmarkUrl ||
              branding.legacy.navbarWordmarkUrl ||
              branding.legacy.footerWordmarkUrl
            ? "Sem valor no modelo novo. Usando fallback legado."
            : "Sem logotipo definido.",
      },
      "site.faviconUrl": {
        value: resource.settings.site.faviconUrl?.trim() || "",
        preview: resource.settings.site.faviconUrl?.trim() || "",
        status: resource.settings.site.faviconUrl?.trim()
          ? "Favicon ativa na aba do navegador."
          : "Sem favicon definida.",
      },
      "site.defaultShareImage": {
        value: resource.settings.site.defaultShareImage?.trim() || "",
        preview: resource.settings.site.defaultShareImage?.trim() || "",
        status: resource.settings.site.defaultShareImage?.trim()
          ? "Imagem padrão de compartilhamento ativa."
          : "Sem imagem padrão de compartilhamento.",
      },
      "branding.overrides.navbarWordmarkUrl": {
        value: branding.direct.navbarWordmarkOverrideUrl,
        preview: branding.navbar.wordmarkUrl,
        status: branding.direct.navbarWordmarkOverrideUrl
          ? "Override da navbar ativo."
          : branding.navbar.wordmarkUrl
            ? "Sem override. Navegação usa o logotipo principal."
            : "Sem imagem disponível para a wordmark da navbar.",
      },
      "branding.overrides.footerWordmarkUrl": {
        value: branding.direct.footerWordmarkOverrideUrl,
        preview: branding.footer.wordmarkUrl,
        status: branding.direct.footerWordmarkOverrideUrl
          ? "Override do footer ativo."
          : branding.footer.wordmarkUrl
            ? "Sem override. Rodapé usa o logotipo principal."
            : "Sem imagem disponível para a wordmark do footer.",
      },
      "branding.overrides.navbarSymbolUrl": {
        value: branding.direct.navbarSymbolOverrideUrl,
        preview: branding.navbar.symbolUrl,
        status: branding.direct.navbarSymbolOverrideUrl
          ? "Override da navbar ativo."
          : branding.navbar.symbolUrl
            ? "Sem override. Navegação usa o símbolo principal."
            : "Sem símbolo disponível para a navbar.",
      },
      "branding.overrides.footerSymbolUrl": {
        value: branding.direct.footerSymbolOverrideUrl,
        preview: branding.footer.symbolUrl,
        status: branding.direct.footerSymbolOverrideUrl
          ? "Override do footer ativo."
          : branding.footer.symbolUrl
            ? "Sem override. Rodapé usa o símbolo principal."
            : "Sem símbolo disponível para o footer.",
      },
    } satisfies Record<string, { value: string; preview: string; status: string }>;
  }, [branding, resource.settings.site.defaultShareImage, resource.settings.site.faviconUrl]);

  const renderLogoEditorCards = useCallback(
    (fields: LogoEditorField[]) => (
      <div className="grid gap-4 lg:grid-cols-2">
        {fields.map((field) => {
          const state = logoFieldState[field.target];
          const hasDirectValue = Boolean(state.value);
          return (
            <div
              key={field.target}
              className="rounded-2xl border border-border/70 bg-background p-4 space-y-3"
            >
              <div>
                <p className="text-sm font-semibold">{field.label}</p>
                <p className="text-xs text-foreground/70">{field.description}</p>
              </div>

              <div
                className={`flex items-center justify-center rounded-xl border border-border/70 bg-background p-3 ${field.frameClassName}`}
              >
                {state.preview ? (
                  <img src={state.preview} alt={field.label} className={field.imageClassName} />
                ) : (
                  <span className="text-xs text-foreground/70">Sem imagem definida</span>
                )}
              </div>

              <p className="text-[11px] text-foreground/70">{state.status}</p>

              <div className="flex gap-2">
                <DashboardActionButton
                  type="button"
                  size="sm"
                  className="flex-1"
                  onClick={() => media.openLibrary(field.target)}
                >
                  Biblioteca
                </DashboardActionButton>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!hasDirectValue}
                  onClick={() => media.clearLibraryImage(field.target)}
                >
                  Limpar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    ),
    [logoFieldState, media],
  );

  const contextValue = useMemo<DashboardSettingsContextValue>(
    () => ({
      ...resource,
      ...media,
      footerBrandNamePreview,
      footerBrandNameUpperPreview,
      footerMode,
      navbarMode,
      navbarPreviewFallbackClass,
      navbarPreviewShellClass,
      renderLogoEditorCards,
      resolvedFooterSymbolUrl: branding.footer.symbolUrl,
      resolvedFooterWordmarkUrl: branding.footer.wordmarkUrl,
      resolvedNavbarSymbolUrl: branding.navbar.symbolUrl,
      resolvedNavbarWordmarkUrl: branding.navbar.wordmarkUrl,
      showNavbarSymbolPreview,
      showNavbarTextPreview,
      showWordmarkInFooterPreview,
      showWordmarkInNavbarPreview,
      siteNamePreview,
    }),
    [
      branding.footer.symbolUrl,
      branding.footer.wordmarkUrl,
      branding.navbar.symbolUrl,
      branding.navbar.wordmarkUrl,
      footerBrandNamePreview,
      footerBrandNameUpperPreview,
      footerMode,
      media,
      navbarMode,
      navbarPreviewFallbackClass,
      navbarPreviewShellClass,
      renderLogoEditorCards,
      resource,
      showNavbarSymbolPreview,
      showNavbarTextPreview,
      showWordmarkInFooterPreview,
      showWordmarkInNavbarPreview,
      siteNamePreview,
    ],
  );
  const handleMainBlurCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && event.currentTarget.contains(nextTarget)) {
        return;
      }
      resource.flushAllAutosave();
    },
    [resource],
  );

  return (
    <>
      <main className="pt-24" onBlurCapture={handleMainBlurCapture}>
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <DashboardPageBadge>Configurações</DashboardPageBadge>
              <h1 className="mt-4 text-3xl font-semibold text-foreground animate-slide-up">
                Painel de ajustes
              </h1>
              <p
                className="mt-2 text-sm text-foreground/70 animate-slide-up opacity-0"
                style={dashboardAnimationDelay(dashboardMotionDelays.headerDescriptionMs)}
              >
                Atualize identidade, traduções e links globais do site.
              </p>
            </div>
            <div
              className="w-full animate-slide-up opacity-0 sm:w-auto"
              style={dashboardAnimationDelay(dashboardMotionDelays.headerActionsMs)}
              data-testid="dashboard-settings-autosave-reveal"
            >
              <DashboardAutosaveStatus
                title="Autosave das configurações"
                status={resource.combinedAutosaveStatus}
                enabled={resource.autosaveEnabled}
                onEnabledChange={resource.handleAutosaveToggle}
                toggleDisabled={!autosaveRuntimeConfig.enabledByDefault}
                lastSavedAt={resource.combinedLastSavedAt}
                errorMessage={resource.combinedAutosaveErrorMessage}
                onManualSave={() => {
                  void resource.handleSaveSettings();
                }}
                manualActionLabel={resource.isSaving ? "Salvando..." : "Salvar ajustes"}
                manualActionDisabled={resource.isSettingsManualSaveDisabled}
              />
            </div>
          </div>

          <Tabs
            value={resource.activeTab}
            onValueChange={resource.setActiveTab}
            activationMode="manual"
            className="mt-8 animate-slide-up opacity-0"
            style={dashboardAnimationDelay(dashboardMotionDelays.sectionLeadMs)}
          >
            <TabsList className="no-scrollbar flex w-full flex-nowrap justify-start overflow-x-auto overscroll-x-contain md:grid md:grid-cols-8 md:overflow-visible">
              <TabsTrigger value="geral" className="shrink-0 md:w-full">
                Geral
              </TabsTrigger>
              <TabsTrigger value="leitor" className="shrink-0 md:w-full">
                Leitor
              </TabsTrigger>
              <TabsTrigger value="seo" className="shrink-0 md:w-full">
                SEO
              </TabsTrigger>
              <TabsTrigger value="downloads" className="shrink-0 md:w-full">
                Downloads
              </TabsTrigger>
              <TabsTrigger value="equipe" className="shrink-0 md:w-full">
                Equipe
              </TabsTrigger>
              <TabsTrigger value="layout" className="shrink-0 md:w-full">
                Layout
              </TabsTrigger>
              <TabsTrigger value="redes-usuarios" className="shrink-0 md:w-full">
                Redes sociais
              </TabsTrigger>
              <TabsTrigger value="traducoes" className="shrink-0 md:w-full">
                Traduções
              </TabsTrigger>
            </TabsList>

            {resource.hasBlockingLoadError ? (
              <div className="mt-6">
                <AsyncState
                  kind="error"
                  title="Não foi possível carregar configurações"
                  description="Tente novamente em alguns instantes."
                  action={
                    <Button variant="outline" onClick={resource.requestReload}>
                      Tentar novamente
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                {resource.hasRetainedLoadError ? (
                  <Alert className="mt-6">
                    <AlertTitle>Atualização parcial indisponível</AlertTitle>
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                      <span>Mantendo o último snapshot de configurações carregado.</span>
                      <Button variant="outline" size="sm" onClick={resource.requestReload}>
                        Tentar novamente
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}
                {resource.isInitialLoading ? (
                  <Card
                    lift={false}
                    className="mt-6 rounded-[28px] border border-border/70 bg-card/95 shadow-sm"
                    data-testid="dashboard-settings-skeleton-surface"
                  >
                    <CardContent className="space-y-6 p-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <div key={`settings-skeleton-${index}`} className="space-y-2">
                            <Skeleton className="h-5 w-36" />
                            <Skeleton className="h-10 w-full rounded-xl" />
                            <Skeleton className="h-4 w-4/5" />
                          </div>
                        ))}
                      </div>
                      <Skeleton className="h-64 w-full rounded-2xl" />
                    </CardContent>
                  </Card>
                ) : (
                  <DashboardSettingsProvider value={contextValue}>
                    <ActiveSettingsTab />
                  </DashboardSettingsProvider>
                )}
              </>
            )}
          </Tabs>
        </section>
      </main>
      <LazyImageLibraryDialog
        open={media.isLibraryOpen}
        onOpenChange={media.setIsLibraryOpen}
        apiBase={apiBase}
        description="Selecione uma imagem já enviada para reutilizar ou exclua itens que não estejam em uso."
        uploadFolder="branding"
        listFolders={media.rootLibraryFolders}
        includeProjectImages={false}
        showUrlImport={false}
        allowDeselect
        mode="single"
        currentSelectionUrls={media.currentLibrarySelection ? [media.currentLibrarySelection] : []}
        onSave={({ urls, items }) => media.applyLibraryImage(urls[0] || "", items[0]?.altText)}
      />
    </>
  );
};

const DashboardSettings = () => {
  const navigate = useNavigate();
  const { currentUser, isLoadingUser } = useDashboardCurrentUser();
  const handleUserCardClick = useCallback(() => {
    navigate("/dashboard/usuarios?edit=me");
  }, [navigate]);

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      onUserCardClick={handleUserCardClick}
    >
      <DashboardSettingsContent />
    </DashboardShell>
  );
};

export const __testing = {
  clearDashboardSettingsCache,
};

export default DashboardSettings;
