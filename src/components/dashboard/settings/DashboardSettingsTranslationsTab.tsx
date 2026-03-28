import { useState } from "react";
import DashboardReaderPresetCard from "@/components/dashboard/DashboardReaderPresetCard";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/dashboard/dashboard-form-controls";
import {
  dashboardStrongFocusFieldClassName,
  dashboardStrongFocusScopeClassName,
  dashboardStrongFocusTriggerClassName,
  dashboardStrongSurfaceHoverClassName,
} from "@/components/dashboard/dashboard-page-tokens";
import DashboardSeoRedirectsPanel from "@/components/dashboard/DashboardSeoRedirectsPanel";
import ReorderControls from "@/components/ReorderControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import { Download, GripVertical, Link2, Plus, Save, Trash2, User } from "lucide-react";
import { navbarIconOptions } from "@/lib/navbar-icons";
import { useDashboardSettingsContext } from "./dashboard-settings-context";
import {
  brandingLogoEditorFields,
  dashboardSettingsCardClassName,
  type FooterBrandMode,
  normalizeLinkTypeId,
  type NavbarBrandMode,
  readerProjectTypeMeta,
  responsiveCompactRowDeleteButtonClass,
  responsiveCompactSelfEndDeleteButtonClass,
  responsiveCompactTextareaRowClass,
  responsiveFooterCardShellClass,
  responsiveFooterSocialDesktopRemoveButtonClass,
  responsiveFooterSocialDragButtonClass,
  responsiveFooterSocialGridClass,
  responsiveFooterSocialTopRowClass,
  responsiveSvgCardColorClass,
  responsiveSvgCardDesktopRemoveButtonClass,
  responsiveSvgCardMobileRemoveButtonClass,
  responsiveSvgCardPickerClusterClass,
  responsiveSvgCardPreviewClass,
  responsiveSvgCardPreviewStatusClass,
  responsiveSvgCardRowClass,
  responsiveSvgCardTintClass,
  responsiveSvgCardTintLabelClass,
  responsiveSvgCardUploadActionClass,
  responsiveSvgCardUploadLabelClass,
  responsiveTranslationActionColClass,
  responsiveTranslationTableClass,
  responsiveTranslationTermColClass,
  responsiveTranslationValueColClass,
  roleIconMap,
  roleIconOptions,
  seoLogoEditorFields,
  socialIconMap,
} from "./shared";

export const DashboardSettingsTranslationsTab = () => {
  const {
    clearFooterSocialDragState,
    filteredGenres,
    filteredStaffRoles,
    filteredTags,
    footerBrandNamePreview,
    footerBrandNameUpperPreview,
    footerMode,
    footerSocialDragOverIndex,
    genreQuery,
    genreTranslations,
    handleFooterSocialDragOver,
    handleFooterSocialDragStart,
    handleFooterSocialDrop,
    handleSaveLinkTypes,
    handleSaveTranslations,
    isIconUrl,
    isSavingLinkTypes,
    isSavingTranslations,
    isSyncingAniList,
    linkTypes,
    moveFooterSocialLink,
    navbarMode,
    navbarPreviewFallbackClass,
    navbarPreviewShellClass,
    newGenre,
    newStaffRole,
    newTag,
    readerPresets,
    renderLogoEditorCards,
    resolvedFooterSymbolUrl,
    resolvedFooterWordmarkUrl,
    resolvedNavbarSymbolUrl,
    resolvedNavbarWordmarkUrl,
    setGenreQuery,
    setGenreTranslations,
    setLinkTypes,
    setNewGenre,
    setNewStaffRole,
    setNewTag,
    setSettings,
    setStaffRoleQuery,
    setStaffRoleTranslations,
    setTagQuery,
    setTagTranslations,
    settings,
    showNavbarSymbolPreview,
    showNavbarTextPreview,
    showWordmarkInFooterPreview,
    showWordmarkInNavbarPreview,
    siteNamePreview,
    staffRoleQuery,
    staffRoleTranslations,
    syncAniListTerms,
    tagQuery,
    tagTranslations,
    toIconPreviewUrl,
    updateReaderPreset,
    uploadDownloadIcon,
    uploadLinkTypeIcon,
    uploadingKey,
  } = useDashboardSettingsContext();
  const translationBatchSize = 80;
  const [visibleCounts, setVisibleCounts] = useState({
    genres: translationBatchSize,
    staffRoles: translationBatchSize,
    tags: translationBatchSize,
  });
  const visibleTags = filteredTags.slice(0, visibleCounts.tags);
  const visibleGenres = filteredGenres.slice(0, visibleCounts.genres);
  const visibleStaffRoles = filteredStaffRoles.slice(0, visibleCounts.staffRoles);

  return (
    <TabsContent
      forceMount
      value="traducoes"
      className="mt-6 space-y-6 data-[state=inactive]:hidden"
    >
      <Card lift={false} className={dashboardSettingsCardClassName}>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Tags</h2>
              <p className="text-xs text-foreground/70">
                Termos em inglês importados do AniList com a tradução exibida no site.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncAniListTerms()}
                disabled={isSyncingAniList}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {isSyncingAniList ? "Importando..." : "Importar AniList"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleSaveTranslations();
                }}
                disabled={isSavingTranslations}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSavingTranslations ? "Salvando..." : "Salvar traduções"}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              placeholder="Buscar tag"
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Nova tag"
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
              />
              <Button
                type="button"
                onClick={() => {
                  const value = newTag.trim();
                  if (!value || tagTranslations[value] !== undefined) {
                    return;
                  }
                  setTagTranslations((prev) => ({ ...prev, [value]: "" }));
                  setNewTag("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
            <span>
              Mostrando {visibleTags.length} de {filteredTags.length} tags.
              {filteredTags.length > visibleTags.length
                ? " Refine a busca ou carregue mais resultados."
                : ""}
            </span>
            {filteredTags.length > visibleTags.length ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setVisibleCounts((prev) => ({
                    ...prev,
                    tags: prev.tags + translationBatchSize,
                  }))
                }
              >
                Mostrar mais
              </Button>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-xl border border-border/70">
            {filteredTags.length === 0 ? (
              <p className="px-4 py-3 text-xs text-foreground/70">Nenhuma tag encontrada.</p>
            ) : (
              <div className="max-h-[420px] overflow-auto no-scrollbar">
                <table className={responsiveTranslationTableClass}>
                  <colgroup>
                    <col className={responsiveTranslationTermColClass} />
                    <col className={responsiveTranslationValueColClass} />
                    <col className={responsiveTranslationActionColClass} />
                  </colgroup>
                  <thead className="sticky top-0 bg-background text-xs uppercase tracking-wide text-foreground/70">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Termo (AniList)</th>
                      <th className="px-4 py-3 text-left font-medium">Tradução</th>
                      <th className="px-4 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {visibleTags.map((tag) => (
                      <tr key={tag} className="bg-background">
                        <td className="px-4 py-3 font-medium text-foreground">{tag}</td>
                        <td className="px-4 py-3">
                          <Input
                            value={tagTranslations[tag] || ""}
                            placeholder={tag}
                            onChange={(event) =>
                              setTagTranslations((prev) => ({
                                ...prev,
                                [tag]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setTagTranslations((prev) => {
                                const next = { ...prev };
                                delete next[tag];
                                return next;
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card lift={false} className={dashboardSettingsCardClassName}>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Gêneros</h2>
              <p className="text-xs text-foreground/70">
                Termos em inglês importados do AniList com a tradução exibida no site.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncAniListTerms()}
                disabled={isSyncingAniList}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {isSyncingAniList ? "Importando..." : "Importar AniList"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleSaveTranslations();
                }}
                disabled={isSavingTranslations}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSavingTranslations ? "Salvando..." : "Salvar traduções"}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              placeholder="Buscar gênero"
              value={genreQuery}
              onChange={(event) => setGenreQuery(event.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Novo gênero"
                value={newGenre}
                onChange={(event) => setNewGenre(event.target.value)}
              />
              <Button
                type="button"
                onClick={() => {
                  const value = newGenre.trim();
                  if (!value || genreTranslations[value] !== undefined) {
                    return;
                  }
                  setGenreTranslations((prev) => ({ ...prev, [value]: "" }));
                  setNewGenre("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
            <span>
              Mostrando {visibleGenres.length} de {filteredGenres.length} gêneros.
              {filteredGenres.length > visibleGenres.length
                ? " Refine a busca ou carregue mais resultados."
                : ""}
            </span>
            {filteredGenres.length > visibleGenres.length ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setVisibleCounts((prev) => ({
                    ...prev,
                    genres: prev.genres + translationBatchSize,
                  }))
                }
              >
                Mostrar mais
              </Button>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-xl border border-border/70">
            {filteredGenres.length === 0 ? (
              <p className="px-4 py-3 text-xs text-foreground/70">Nenhum gênero encontrado.</p>
            ) : (
              <div className="max-h-[420px] overflow-auto no-scrollbar">
                <table className={responsiveTranslationTableClass}>
                  <colgroup>
                    <col className={responsiveTranslationTermColClass} />
                    <col className={responsiveTranslationValueColClass} />
                    <col className={responsiveTranslationActionColClass} />
                  </colgroup>
                  <thead className="sticky top-0 bg-background text-xs uppercase tracking-wide text-foreground/70">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Termo (AniList)</th>
                      <th className="px-4 py-3 text-left font-medium">Tradução</th>
                      <th className="px-4 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {visibleGenres.map((genre) => (
                      <tr key={genre} className="bg-background">
                        <td className="px-4 py-3 font-medium text-foreground">{genre}</td>
                        <td className="px-4 py-3">
                          <Input
                            value={genreTranslations[genre] || ""}
                            placeholder={genre}
                            onChange={(event) =>
                              setGenreTranslations((prev) => ({
                                ...prev,
                                [genre]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setGenreTranslations((prev) => {
                                const next = { ...prev };
                                delete next[genre];
                                return next;
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card lift={false} className={dashboardSettingsCardClassName}>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Cargos do AniList</h2>
              <p className="text-xs text-foreground/70">
                Traduza funções da equipe do anime exibidas no projeto.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleSaveTranslations();
              }}
              disabled={isSavingTranslations}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSavingTranslations ? "Salvando..." : "Salvar traduções"}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              placeholder="Buscar cargo"
              value={staffRoleQuery}
              onChange={(event) => setStaffRoleQuery(event.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Novo cargo"
                value={newStaffRole}
                onChange={(event) => setNewStaffRole(event.target.value)}
              />
              <Button
                type="button"
                onClick={() => {
                  const value = newStaffRole.trim();
                  if (!value || staffRoleTranslations[value] !== undefined) {
                    return;
                  }
                  setStaffRoleTranslations((prev) => ({ ...prev, [value]: "" }));
                  setNewStaffRole("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/70">
            <span>
              Mostrando {visibleStaffRoles.length} de {filteredStaffRoles.length} cargos.
              {filteredStaffRoles.length > visibleStaffRoles.length
                ? " Refine a busca ou carregue mais resultados."
                : ""}
            </span>
            {filteredStaffRoles.length > visibleStaffRoles.length ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setVisibleCounts((prev) => ({
                    ...prev,
                    staffRoles: prev.staffRoles + translationBatchSize,
                  }))
                }
              >
                Mostrar mais
              </Button>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-xl border border-border/70">
            {filteredStaffRoles.length === 0 ? (
              <p className="px-4 py-3 text-xs text-foreground/70">Nenhum cargo encontrado.</p>
            ) : (
              <div className="max-h-[420px] overflow-auto no-scrollbar">
                <table className={responsiveTranslationTableClass}>
                  <colgroup>
                    <col className={responsiveTranslationTermColClass} />
                    <col className={responsiveTranslationValueColClass} />
                    <col className={responsiveTranslationActionColClass} />
                  </colgroup>
                  <thead className="sticky top-0 bg-background text-xs uppercase tracking-wide text-foreground/70">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Termo (AniList)</th>
                      <th className="px-4 py-3 text-left font-medium">Tradução</th>
                      <th className="px-4 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {visibleStaffRoles.map((role) => (
                      <tr key={role} className="bg-background">
                        <td className="px-4 py-3 font-medium text-foreground">{role}</td>
                        <td className="px-4 py-3">
                          <Input
                            value={staffRoleTranslations[role] || ""}
                            placeholder={role}
                            onChange={(event) =>
                              setStaffRoleTranslations((prev) => ({
                                ...prev,
                                [role]: event.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setStaffRoleTranslations((prev) => {
                                const next = { ...prev };
                                delete next[role];
                                return next;
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default DashboardSettingsTranslationsTab;
