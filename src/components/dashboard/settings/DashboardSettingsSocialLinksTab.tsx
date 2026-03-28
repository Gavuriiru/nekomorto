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

export const DashboardSettingsSocialLinksTab = () => {
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
      value="redes-usuarios"
      className="mt-6 space-y-6 data-[state=inactive]:hidden"
    >
      <Card lift={false} className={dashboardSettingsCardClassName}>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Redes sociais (Usuários)</h2>
              <p className="text-xs text-foreground/70">Opções exibidas no editor de usuários.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setLinkTypes((prev) => [
                    ...prev,
                    { id: `nova-${Date.now()}`, label: "Nova rede", icon: "globe" },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleSaveLinkTypes();
                }}
                disabled={isSavingLinkTypes}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSavingLinkTypes ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {linkTypes.length === 0 ? (
              <p className="text-xs text-foreground/70">Nenhuma rede cadastrada.</p>
            ) : null}
            {linkTypes.map((link, index) => {
              const isCustomIcon = isIconUrl(link.icon);
              return (
                <div
                  key={`${link.id}-${index}`}
                  className={`${responsiveSvgCardRowClass} md:grid-cols-[1fr_1.6fr_auto]`}
                >
                  <Input
                    value={link.label}
                    placeholder="Label"
                    onChange={(event) =>
                      setLinkTypes((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], label: event.target.value };
                        return next;
                      })
                    }
                  />
                  <div className={responsiveSvgCardPreviewClass}>
                    {isCustomIcon ? (
                      <ThemedSvgLogo
                        url={toIconPreviewUrl(link.icon)}
                        label={`Ícone ${link.label}`}
                        className="h-6 w-6 text-primary"
                      />
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-card text-[10px]">
                        SVG
                      </span>
                    )}
                    <span className={responsiveSvgCardPreviewStatusClass}>
                      {isCustomIcon ? "SVG atual" : "Sem SVG"}
                    </span>
                    <div className={responsiveSvgCardUploadActionClass}>
                      <Input
                        id={`linktype-icon-${index}`}
                        type="file"
                        accept="image/svg+xml"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            uploadLinkTypeIcon(file, index);
                          }
                        }}
                        disabled={uploadingKey === `linktype-icon-${index}`}
                      />
                      <Label
                        htmlFor={`linktype-icon-${index}`}
                        className={responsiveSvgCardUploadLabelClass}
                      >
                        Escolher SVG
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={responsiveSvgCardMobileRemoveButtonClass}
                        onClick={() =>
                          setLinkTypes((prev) => prev.filter((_, idx) => idx !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={responsiveSvgCardDesktopRemoveButtonClass}
                    onClick={() => setLinkTypes((prev) => prev.filter((_, idx) => idx !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default DashboardSettingsSocialLinksTab;
