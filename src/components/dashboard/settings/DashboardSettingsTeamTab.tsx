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

export const DashboardSettingsTeamTab = () => {
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
    <TabsContent value="equipe" className="mt-6 space-y-6">
                          <Card lift={false} className={dashboardSettingsCardClassName}>
                            <CardContent className="space-y-6 p-6">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <h2 className="text-lg font-semibold">Funções do time</h2>
                                  <p className="text-xs text-foreground/70">
                                    Ajuste os cargos disponíveis para membros.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setSettings((prev) => ({
                                      ...prev,
                                      teamRoles: [
                                        ...prev.teamRoles,
                                        {
                                          id: `role-${Date.now()}`,
                                          label: "Nova função",
                                          icon: "user",
                                        },
                                      ],
                                    }))
                                  }
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
    
                              <div className="grid gap-4">
                                {settings.teamRoles.map((role, index) => (
                                  <div
                                    key={`${role.id}-${index}`}
                                    className={`${responsiveSvgCardRowClass} md:grid-cols-[1.4fr_1fr_auto]`}
                                  >
                                    <Input
                                      value={role.label}
                                      onChange={(event) =>
                                        setSettings((prev) => {
                                          const next = [...prev.teamRoles];
                                          next[index] = { ...next[index], label: event.target.value };
                                          return { ...prev, teamRoles: next };
                                        })
                                      }
                                      placeholder="Nome"
                                    />
                                    <Select
                                      value={role.icon || "user"}
                                      onValueChange={(value) =>
                                        setSettings((prev) => {
                                          const next = [...prev.teamRoles];
                                          next[index] = { ...next[index], icon: value };
                                          return { ...prev, teamRoles: next };
                                        })
                                      }
                                    >
                                      <SelectTrigger className="min-w-0 w-full">
                                        <SelectValue placeholder="Ícone" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {roleIconOptions.map((option) => {
                                          const Icon = roleIconMap[option.id] || User;
                                          return (
                                            <SelectItem key={option.id} value={option.id}>
                                              <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 text-foreground/70" />
                                                <span>{option.label}</span>
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={responsiveCompactRowDeleteButtonClass}
                                      onClick={() =>
                                        setSettings((prev) => ({
                                          ...prev,
                                          teamRoles: prev.teamRoles.filter((_, idx) => idx !== index),
                                        }))
                                      }
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>
  );
};

export default DashboardSettingsTeamTab;
