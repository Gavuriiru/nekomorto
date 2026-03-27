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

export const DashboardSettingsReaderTab = () => {
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

  return (
    <TabsContent value="leitor" className="mt-6 space-y-6">
                          {readerProjectTypeMeta.map((presetMeta) => {
                            const preset = readerPresets[presetMeta.key];
                            return (
                              <DashboardReaderPresetCard
                                key={presetMeta.key}
                                cardClassName={dashboardSettingsCardClassName}
                                preset={preset}
                                presetMeta={presetMeta}
                                onUpdate={updateReaderPreset}
                              />
                            );
                            /*
                            return (
                              <Card
                                key={presetMeta.key}
                                lift={false}
                                className={dashboardSettingsCardClassName}
                                data-testid={`reader-preset-${presetMeta.key}`}
                              >
                                <CardContent className="space-y-6 p-4 md:p-6">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <h2 className="text-lg font-semibold">{presetMeta.title}</h2>
                                      <p className="text-xs text-foreground/70">
                                        {presetMeta.description}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <DashboardPageBadge>
                                        {preset.direction === PROJECT_READER_DIRECTIONS.RTL
                                          ? "RTL"
                                          : "LTR"}
                                      </DashboardPageBadge>
                                      <DashboardPageBadge>
                                        {preset.layout === PROJECT_READER_LAYOUTS.DOUBLE
                                          ? "Dupla"
                                          : preset.layout === PROJECT_READER_LAYOUTS.SCROLL_VERTICAL
                                            ? "Scroll vertical"
                                            : preset.layout === PROJECT_READER_LAYOUTS.SCROLL_HORIZONTAL
                                              ? "Scroll horizontal"
                                              : "Única"}
                                          ? "Dupla"
                                          : "Página"}
                                      </DashboardPageBadge>
                                    </div>
                                  </div>
    
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <DashboardFieldStack>
                                      <Label>Direção</Label>
                                      <Select
                                        value={preset.direction}
                                        onValueChange={(value) =>
                                          updateReaderPreset(presetMeta.key, (current) => ({
                                            ...normalizeProjectReaderConfig(current, {
                                              projectType: presetMeta.projectType,
                                            }),
                                            direction:
                                              value === PROJECT_READER_DIRECTIONS.LTR
                                                ? PROJECT_READER_DIRECTIONS.LTR
                                                : PROJECT_READER_DIRECTIONS.RTL,
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={PROJECT_READER_DIRECTIONS.RTL}>
                                            Direita para esquerda
                                          </SelectItem>
                                          <SelectItem value={PROJECT_READER_DIRECTIONS.LTR}>
                                            Esquerda para direita
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </DashboardFieldStack>
    
                                    <DashboardFieldStack>
                                      <Label>Modo de leitura</Label>
                                      <Select
                                        value={preset.viewMode}
                                        onValueChange={(value) =>
                                          updateReaderPreset(presetMeta.key, (current) => ({
                                            ...normalizeProjectReaderConfig(current, {
                                              projectType: presetMeta.projectType,
                                            }),
                                            viewMode:
                                              value === PROJECT_READER_VIEW_MODES.SCROLL
                                                ? PROJECT_READER_VIEW_MODES.SCROLL
                                                : PROJECT_READER_VIEW_MODES.PAGE,
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={PROJECT_READER_VIEW_MODES.PAGE}>
                                            Página
                                          </SelectItem>
                                          <SelectItem value={PROJECT_READER_VIEW_MODES.SCROLL}>
                                            Scroll contínuo
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </DashboardFieldStack>
    
                                    <DashboardFieldStack>
                                      <Label htmlFor={`reader-preview-limit-${presetMeta.key}`}>
                                        Limite de preview
                                      </Label>
                                      <Input
                                        id={`reader-preview-limit-${presetMeta.key}`}
                                        type="number"
                                        min="1"
                                        value={preset.previewLimit ?? ""}
                                        placeholder="Opcional"
                                        onChange={(event) =>
                                          updateReaderPreset(presetMeta.key, (current) => ({
                                            ...normalizeProjectReaderConfig(current, {
                                              projectType: presetMeta.projectType,
                                            }),
                                            previewLimit: event.target.value.trim()
                                              ? Math.max(1, Number(event.target.value))
                                              : null,
                                          }))
                                        }
                                      />
                                    </DashboardFieldStack>
    
                                    <DashboardFieldStack>
                                      <Label htmlFor={`reader-theme-${presetMeta.key}`}>
                                        Preset visual
                                      </Label>
                                      <Input
                                        id={`reader-theme-${presetMeta.key}`}
                                        value={preset.themePreset || ""}
                                        placeholder="manga, webtoon, custom..."
                                        onChange={(event) =>
                                          updateReaderPreset(presetMeta.key, (current) => ({
                                            ...normalizeProjectReaderConfig(current, {
                                              projectType: presetMeta.projectType,
                                            }),
                                            themePreset: event.target.value,
                                          }))
                                        }
                                      />
                                    </DashboardFieldStack>
                                  </div>
    
                                  <div className="grid gap-3 md:grid-cols-3">
                                    <label className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
                                      <span className="space-y-1">
                                        <span className="block font-medium text-foreground">
                                          Primeira página isolada
                                        </span>
                                        <span className="block text-xs text-foreground/70">
                                          Útil para capas e páginas ímpares.
                                        </span>
                                      </span>
                                      <Switch
                                        checked={preset.firstPageSingle !== false}
                                        onCheckedChange={(checked) =>
                                          updateReaderPreset(presetMeta.key, (current) => ({
                                            ...normalizeProjectReaderConfig(current, {
                                              projectType: presetMeta.projectType,
                                            }),
                                            firstPageSingle: checked,
                                          }))
                                        }
                                      />
                                    </label>
    
                                    <label className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
                                      <span className="space-y-1">
                                        <span className="block font-medium text-foreground">
                                          Permitir spread
                                        </span>
                                        <span className="block text-xs text-foreground/70">
                                          Junta páginas duplas no modo paginado.
                                        </span>
                                      </span>
                                      <Switch
                                        checked={preset.allowSpread !== false}
                                        onCheckedChange={(checked) =>
                                          updateReaderPreset(presetMeta.key, (current) => ({
                                            ...normalizeProjectReaderConfig(current, {
                                              projectType: presetMeta.projectType,
                                            }),
                                            allowSpread: checked,
                                          }))
                                        }
                                      />
                                    </label>
    
                                    <label className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
                                      <span className="space-y-1">
                                        <span className="block font-medium text-foreground">
                                          Mostrar rodapé
                                        </span>
                                        <span className="block text-xs text-foreground/70">
                                          Mantém os controles inferiores do viewer.
                                        </span>
                                      </span>
                                      <Switch
                                        checked={preset.showFooter !== false}
                                        onCheckedChange={(checked) =>
                                          updateReaderPreset(presetMeta.key, (current) => ({
                                            ...normalizeProjectReaderConfig(current, {
                                              projectType: presetMeta.projectType,
                                            }),
                                            showFooter: checked,
                                          }))
                                        }
                                      />
                                    </label>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                            */
                          })}
                        </TabsContent>
  );
};

export default DashboardSettingsReaderTab;
