import DashboardReaderPresetCard from "@/components/dashboard/DashboardReaderPresetCard";
import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import DashboardActionButton from "@/components/dashboard/DashboardActionButton";
import { Input, Textarea } from "@/components/dashboard/dashboard-form-controls";
import {
  dashboardStrongFocusFieldClassName,
  dashboardStrongFocusScopeClassName,
  dashboardStrongFocusTriggerClassName,
  dashboardStrongSurfaceHoverClassName,
} from "@/components/dashboard/dashboard-page-tokens";
import DashboardSeoRedirectsPanel from "@/components/dashboard/DashboardSeoRedirectsPanel";
import ReorderControls from "@/components/ReorderControls";
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

export const DashboardSettingsDownloadsTab = () => {
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
    <TabsContent
      forceMount
      value="downloads"
      className="mt-6 space-y-6 data-[state=inactive]:hidden"
    >
      <Card lift={false} className={dashboardSettingsCardClassName}>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Fontes de download</h2>
              <p className="text-xs text-foreground/70">
                Ajuste nome, cor e envie o SVG do serviço para exibição nos downloads.
              </p>
            </div>
            <DashboardActionButton
              type="button"
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  downloads: {
                    ...prev.downloads,
                    sources: [
                      ...prev.downloads.sources,
                      {
                        id: `fonte-${Date.now()}`,
                        label: "Nova fonte",
                        color: "#64748B",
                        icon: "",
                        tintIcon: true,
                      },
                    ],
                  },
                }))
              }
            >
              <Plus className="h-4 w-4" />
            </DashboardActionButton>
          </div>

          <div className="grid gap-3">
            {settings.downloads.sources.map((source, index) => {
              const shouldTint = source.tintIcon !== false;
              return (
                <div
                  key={`${source.id}-${index}`}
                  className={`${responsiveSvgCardRowClass} md:grid-cols-[1.2fr_0.25fr_0.6fr_1.6fr_auto]`}
                >
                  <Input
                    value={source.label}
                    onChange={(event) =>
                      setSettings((prev) => {
                        const next = [...prev.downloads.sources];
                        next[index] = { ...next[index], label: event.target.value };
                        return {
                          ...prev,
                          downloads: { ...prev.downloads, sources: next },
                        };
                      })
                    }
                    placeholder="Nome"
                  />
                  <div className={responsiveSvgCardPickerClusterClass}>
                    <div className={responsiveSvgCardColorClass}>
                      <ColorPicker
                        label=""
                        showSwatch
                        buttonClassName={`inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/70 bg-background shadow-none transition-[border-color,background-color,color] duration-200 ${dashboardStrongSurfaceHoverClassName} focus-visible:outline-hidden md:h-9 md:w-9 ${dashboardStrongFocusFieldClassName} ${dashboardStrongFocusTriggerClassName}`}
                        panelClassName={dashboardStrongFocusScopeClassName}
                        value={source.color}
                        onChange={(color) =>
                          setSettings((prev) => {
                            const next = [...prev.downloads.sources];
                            next[index] = {
                              ...next[index],
                              color: color.toString("hex"),
                            };
                            return {
                              ...prev,
                              downloads: { ...prev.downloads, sources: next },
                            };
                          })
                        }
                      />
                    </div>
                    <div className={responsiveSvgCardTintClass}>
                      <span className={responsiveSvgCardTintLabelClass}>Aplicar ao ícone</span>
                      <Switch
                        checked={shouldTint}
                        onCheckedChange={(checked) =>
                          setSettings((prev) => {
                            const next = [...prev.downloads.sources];
                            next[index] = { ...next[index], tintIcon: checked };
                            return {
                              ...prev,
                              downloads: { ...prev.downloads, sources: next },
                            };
                          })
                        }
                        aria-label={`Colorir SVG de ${source.label}`}
                      />
                    </div>
                  </div>
                  <div className={responsiveSvgCardPreviewClass}>
                    {isIconUrl(source.icon) ? (
                      shouldTint ? (
                        <ThemedSvgLogo
                          url={toIconPreviewUrl(source.icon)}
                          label={`Ícone ${source.label}`}
                          className="h-6 w-6 rounded bg-card/90 p-1"
                          color={source.color}
                        />
                      ) : (
                        <img
                          src={toIconPreviewUrl(source.icon)}
                          alt={`Ícone ${source.label}`}
                          className="h-6 w-6 rounded bg-card/90 p-1"
                        />
                      )
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-card text-[10px]">
                        SVG
                      </span>
                    )}
                    <span className={responsiveSvgCardPreviewStatusClass}>
                      {isIconUrl(source.icon) ? "SVG atual" : "Sem SVG"}
                    </span>
                    <div className={responsiveSvgCardUploadActionClass}>
                      <Input
                        id={`download-icon-${index}`}
                        type="file"
                        accept="image/svg+xml"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            uploadDownloadIcon(file, index);
                          }
                        }}
                        disabled={uploadingKey === `download-icon-${index}`}
                      />
                      <Label
                        htmlFor={`download-icon-${index}`}
                        className={responsiveSvgCardUploadLabelClass}
                      >
                        Escolher SVG
                      </Label>
                      <DashboardActionButton
                        type="button"
                        size="icon"
                        className={responsiveSvgCardMobileRemoveButtonClass}
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            downloads: {
                              ...prev.downloads,
                              sources: prev.downloads.sources.filter((_, idx) => idx !== index),
                            },
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </DashboardActionButton>
                    </div>
                  </div>
                  <DashboardActionButton
                    type="button"
                    size="icon"
                    className={responsiveSvgCardDesktopRemoveButtonClass}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        downloads: {
                          ...prev.downloads,
                          sources: prev.downloads.sources.filter((_, idx) => idx !== index),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </DashboardActionButton>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default DashboardSettingsDownloadsTab;
