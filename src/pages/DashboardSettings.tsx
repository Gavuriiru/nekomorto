import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import {
  BadgeCheck,
  Check,
  Clock,
  Code,
  Download,
  Facebook,
  Instagram,
  Languages,
  Layers,
  Link2,
  MessageCircle,
  Paintbrush,
  Palette,
  PenTool,
  Send,
  Sparkles,
  Twitter,
  User,
  Video,
  HardDrive,
  Cloud,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { useSiteSettings } from "@/hooks/use-site-settings";
import type { SiteSettings } from "@/types/site-settings";
import { usePageMeta } from "@/hooks/use-page-meta";

const downloadIconOptions = [
  { id: "google-drive", label: "Google Drive" },
  { id: "mega", label: "MEGA" },
  { id: "torrent", label: "Torrent" },
  { id: "mediafire", label: "Mediafire" },
  { id: "telegram", label: "Telegram" },
  { id: "link", label: "Link" },
];

const socialIconOptions = [
  ...downloadIconOptions,
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "twitter", label: "Twitter" },
  { id: "discord", label: "Discord" },
];

const roleIconOptions = [
  { id: "languages", label: "Languages" },
  { id: "check", label: "Check" },
  { id: "pen-tool", label: "Pen Tool" },
  { id: "sparkles", label: "Sparkles" },
  { id: "code", label: "Code" },
  { id: "paintbrush", label: "Paintbrush" },
  { id: "layers", label: "Layers" },
  { id: "video", label: "Video" },
  { id: "clock", label: "Clock" },
  { id: "badge", label: "Badge" },
  { id: "palette", label: "Palette" },
  { id: "user", label: "User" },
];

const roleIconMap: Record<string, typeof User> = {
  languages: Languages,
  check: Check,
  "pen-tool": PenTool,
  sparkles: Sparkles,
  code: Code,
  paintbrush: Paintbrush,
  layers: Layers,
  video: Video,
  clock: Clock,
  badge: BadgeCheck,
  palette: Palette,
  user: User,
};

const socialIconMap: Record<string, typeof Link2> = {
  "google-drive": Cloud,
  mega: HardDrive,
  torrent: Download,
  mediafire: HardDrive,
  telegram: Send,
  link: Link2,
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  discord: MessageCircle,
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
const DashboardSettings = () => {
  usePageMeta({ title: "Configurações", noIndex: true });

  const navigate = useNavigate();
  const apiBase = getApiBase();
  const { settings: publicSettings, refresh } = useSiteSettings();
  const [settings, setSettings] = useState<SiteSettings>(publicSettings);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    email?: string | null;
    avatarUrl?: string | null;
  } | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const [genreTranslations, setGenreTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTranslations, setIsSavingTranslations] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const [genreQuery, setGenreQuery] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newGenre, setNewGenre] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch(`${apiBase}/api/me`, { credentials: "include" });
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
    let isActive = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [settingsRes, translationsRes] = await Promise.all([
          fetch(`${apiBase}/api/settings`, { credentials: "include" }),
          fetch(`${apiBase}/api/public/tag-translations`),
        ]);
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (isActive && data.settings) {
            setSettings(data.settings);
          }
        }
        if (translationsRes.ok) {
          const data = await translationsRes.json();
          if (isActive) {
            setTagTranslations(data.tags || {});
            setGenreTranslations(data.genres || {});
          }
        }
      } catch {
        if (isActive) {
          setSettings(publicSettings);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, [apiBase, publicSettings]);

  const isIconUrl = (value?: string | null) => {
    if (!value) return false;
    return value.startsWith("http") || value.startsWith("data:");
  };

  const uploadImage = async (file: File, target: string) => {
    setUploadingKey(target);
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await fetch(`${apiBase}/api/uploads/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataUrl,
          filename: file.name,
          folder: "branding",
        }),
      });
      if (!response.ok) {
        throw new Error("upload_failed");
      }
      const data = await response.json();
      setSettings((prev) => {
        if (target === "site.logoUrl") {
          return { ...prev, site: { ...prev.site, logoUrl: data.url } };
        }
        if (target === "site.faviconUrl") {
          return { ...prev, site: { ...prev.site, faviconUrl: data.url } };
        }
        if (target === "site.defaultShareImage") {
          return { ...prev, site: { ...prev.site, defaultShareImage: data.url } };
        }
        if (target === "footer.brandLogoUrl") {
          return { ...prev, footer: { ...prev.footer, brandLogoUrl: data.url } };
        }
        return prev;
      });
      toast({ title: "Upload concluído", description: "Imagem enviada com sucesso." });
    } catch {
      toast({
        title: "Falha no upload",
        description: "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const uploadDownloadIcon = async (file: File, index: number) => {
    setUploadingKey(`download-icon-${index}`);
    try {
      const dataUrl = await fileToDataUrl(file);
      const response = await fetch(`${apiBase}/api/uploads/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataUrl,
          filename: file.name,
          folder: "downloads",
        }),
      });
      if (!response.ok) {
        throw new Error("upload_failed");
      }
      const data = await response.json();
      setSettings((prev) => {
        const next = [...prev.downloads.sources];
        next[index] = { ...next[index], icon: data.url };
        return { ...prev, downloads: { ...prev.downloads, sources: next } };
      });
      toast({ title: "Ícone enviado", description: "SVG atualizado com sucesso." });
    } catch {
      toast({
        title: "Falha no upload",
        description: "Não foi possível enviar o ícone.",
        variant: "destructive",
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const nextSettings = { ...settings };
      const socialDiscord = nextSettings.footer.socialLinks.find(
        (link) => String(link.label || "").toLowerCase() === "discord",
      );
      if (socialDiscord?.href) {
        nextSettings.community.discordUrl = socialDiscord.href;
        nextSettings.navbar.recruitmentUrl = socialDiscord.href;
      } else if (nextSettings.community.discordUrl) {
        nextSettings.navbar.recruitmentUrl = nextSettings.community.discordUrl;
      }
      const response = await fetch(`${apiBase}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ settings: nextSettings }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      const data = await response.json();
      setSettings(data.settings || nextSettings);
      await refresh();
      toast({ title: "Configurações salvas" });
    } catch {
      toast({
        title: "Falha ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTranslations = async () => {
    setIsSavingTranslations(true);
    try {
      const response = await fetch(`${apiBase}/api/tag-translations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tags: tagTranslations,
          genres: genreTranslations,
        }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      toast({ title: "Traduções salvas" });
    } catch {
      toast({
        title: "Falha ao salvar",
        description: "Não foi possível salvar as traduções.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTranslations(false);
    }
  };

  const filteredTags = useMemo(() => {
    const query = tagQuery.trim().toLowerCase();
    return Object.keys(tagTranslations)
      .filter((tag) => !query || tag.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tagTranslations, tagQuery]);

  const filteredGenres = useMemo(() => {
    const query = genreQuery.trim().toLowerCase();
    return Object.keys(genreTranslations)
      .filter((genre) => !query || genre.toLowerCase().includes(query))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [genreTranslations, genreQuery]);

  const userLabel = useMemo(() => {
    if (isLoadingUser) {
      return "Carregando usuário...";
    }
    return currentUser?.name ?? "Usuário não conectado";
  }, [currentUser, isLoadingUser]);

  const userSubLabel = useMemo(() => {
    if (isLoadingUser) {
      return "Aguarde";
    }
    return currentUser ? `@${currentUser.username}` : "OAuth Discord pendente";
  }, [currentUser, isLoadingUser]);
  if (isLoading) {
    return (
      <DashboardShell
        currentUser={currentUser}
        isLoadingUser={isLoadingUser}
        userLabel={userLabel}
        userSubLabel={userSubLabel}
        onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
      >
        <main className="pt-28">
          <section className="mx-auto w-full max-w-5xl px-6 pb-20 md:px-10">
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
              Carregando configurações...
            </div>
          </section>
        </main>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      currentUser={currentUser}
      isLoadingUser={isLoadingUser}
      userLabel={userLabel}
      userSubLabel={userSubLabel}
      onUserCardClick={() => navigate("/dashboard/usuarios?edit=me")}
    >
      <main className="pt-24">
          <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:px-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Configurações
                </div>
                <h1 className="mt-4 text-3xl font-semibold text-foreground">Painel de ajustes</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Atualize identidade, traduções e links globais do site.
                </p>
              </div>
              <Button onClick={handleSaveSettings} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Salvando..." : "Salvar ajustes"}
              </Button>
            </div>

            <Tabs defaultValue="geral" className="mt-8">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="traducoes">Traduções</TabsTrigger>
                <TabsTrigger value="downloads">Downloads</TabsTrigger>
                <TabsTrigger value="equipe">Equipe</TabsTrigger>
                <TabsTrigger value="footer">Footer</TabsTrigger>
              </TabsList>

              <TabsContent value="geral" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome do site</Label>
                        <Input
                          value={settings.site.name}
                          onChange={(event) =>
                            setSettings((prev) => ({ ...prev, site: { ...prev.site, name: event.target.value } }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição curta</Label>
                        <Textarea
                          value={settings.site.description}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              site: { ...prev.site, description: event.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Logo (URL)</Label>
                        <Input
                          value={settings.site.logoUrl}
                          onChange={(event) =>
                            setSettings((prev) => ({ ...prev, site: { ...prev.site, logoUrl: event.target.value } }))
                          }
                        />
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              uploadImage(file, "site.logoUrl");
                            }
                          }}
                          disabled={uploadingKey === "site.logoUrl"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Favicon (URL)</Label>
                        <Input
                          value={settings.site.faviconUrl}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              site: { ...prev.site, faviconUrl: event.target.value },
                            }))
                          }
                        />
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              uploadImage(file, "site.faviconUrl");
                            }
                          }}
                          disabled={uploadingKey === "site.faviconUrl"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Imagem padrao de compartilhamento</Label>
                        <Input
                          value={settings.site.defaultShareImage}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              site: { ...prev.site, defaultShareImage: event.target.value },
                            }))
                          }
                        />
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              uploadImage(file, "site.defaultShareImage");
                            }
                          }}
                          disabled={uploadingKey === "site.defaultShareImage"}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Link do Discord</Label>
                        <Input
                          value={settings.community.discordUrl}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              community: { ...prev.community, discordUrl: event.target.value },
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Atualiza recrutamento na navbar e o botão de entrar no servidor.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Link de recrutamento (navbar)</Label>
                        <Input
                          value={settings.navbar.recruitmentUrl}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              navbar: { ...prev.navbar, recruitmentUrl: event.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="traducoes" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Tags</h2>
                        <p className="text-xs text-muted-foreground">
                          Termos em inglês importados do AniList com a tradução exibida no site.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveTranslations}
                        disabled={isSavingTranslations}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {isSavingTranslations ? "Salvando..." : "Salvar traduções"}
                      </Button>
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
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      {filteredTags.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">Nenhuma tag encontrada.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-background/70 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Termo (AniList)</th>
                              <th className="px-4 py-3 text-left font-medium">Tradução</th>
                              <th className="px-4 py-3 text-right font-medium">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {filteredTags.map((tag) => (
                              <tr key={tag} className="bg-background/40">
                                <td className="px-4 py-3 font-medium text-foreground">{tag}</td>
                                <td className="px-4 py-3">
                                  <Input
                                    value={tagTranslations[tag] || ""}
                                    placeholder="Tradução"
                                    onChange={(event) =>
                                      setTagTranslations((prev) => ({ ...prev, [tag]: event.target.value }))
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
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Gêneros</h2>
                        <p className="text-xs text-muted-foreground">
                          Termos em inglês importados do AniList com a tradução exibida no site.
                        </p>
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
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      {filteredGenres.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum gênero encontrado.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-background/70 text-xs uppercase tracking-wide text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Termo (AniList)</th>
                              <th className="px-4 py-3 text-left font-medium">Tradução</th>
                              <th className="px-4 py-3 text-right font-medium">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {filteredGenres.map((genre) => (
                              <tr key={genre} className="bg-background/40">
                                <td className="px-4 py-3 font-medium text-foreground">{genre}</td>
                                <td className="px-4 py-3">
                                  <Input
                                    value={genreTranslations[genre] || ""}
                                    placeholder="Tradução"
                                    onChange={(event) =>
                                      setGenreTranslations((prev) => ({ ...prev, [genre]: event.target.value }))
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
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="downloads" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Fontes de download</h2>
                        <p className="text-xs text-muted-foreground">
                          Ajuste nome, cor e envie o SVG do serviço para exibição nos downloads.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
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
                                },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4">
                      {settings.downloads.sources.map((source, index) => (
                        <div key={`${source.id}-${index}`} className="grid gap-3 md:grid-cols-[1.4fr_0.6fr_1.2fr_auto]">
                          <Input
                            value={source.label}
                            onChange={(event) =>
                              setSettings((prev) => {
                                const next = [...prev.downloads.sources];
                                next[index] = { ...next[index], label: event.target.value };
                                return { ...prev, downloads: { ...prev.downloads, sources: next } };
                              })
                            }
                            placeholder="Nome"
                          />
                          <Input
                            type="color"
                            value={source.color}
                            onChange={(event) =>
                              setSettings((prev) => {
                                const next = [...prev.downloads.sources];
                                next[index] = { ...next[index], color: event.target.value };
                                return { ...prev, downloads: { ...prev.downloads, sources: next } };
                              })
                            }
                          />
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                              {isIconUrl(source.icon) ? (
                                <img
                                  src={source.icon}
                                  alt={`Ícone ${source.label}`}
                                  className="h-6 w-6 rounded bg-white/90 p-1"
                                />
                              ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-white/10 text-[10px]">
                                  SVG
                                </span>
                              )}
                              <span className="truncate">
                                {isIconUrl(source.icon) ? "SVG atual" : "Nenhum SVG enviado"}
                              </span>
                            </div>
                            <Input
                              type="file"
                              accept="image/svg+xml"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  uploadDownloadIcon(file, index);
                                }
                              }}
                              disabled={uploadingKey === `download-icon-${index}`}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
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
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="equipe" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Funcoes do time</h2>
                        <p className="text-xs text-muted-foreground">
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
                              { id: `role-${Date.now()}`, label: "Nova função", icon: "user" },
                            ],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-4">
                      {settings.teamRoles.map((role, index) => (
                        <div key={`${role.id}-${index}`} className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
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
                            <SelectTrigger>
                              <SelectValue placeholder="Ícone" />
                            </SelectTrigger>
                            <SelectContent>
                              {roleIconOptions.map((option) => {
                                const Icon = roleIconMap[option.id] || User;
                                return (
                                  <SelectItem key={option.id} value={option.id}>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-muted-foreground" />
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

              <TabsContent value="footer" className="mt-6 space-y-6">
                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div>
                      <h2 className="text-lg font-semibold">Identidade do footer</h2>
                      <p className="text-xs text-muted-foreground">Nome, logo e descricao.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={settings.footer.brandName}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              footer: { ...prev.footer, brandName: event.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Logo (URL)</Label>
                        <Input
                          value={settings.footer.brandLogoUrl}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              footer: { ...prev.footer, brandLogoUrl: event.target.value },
                            }))
                          }
                        />
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              uploadImage(file, "footer.brandLogoUrl");
                            }
                          }}
                          disabled={uploadingKey === "footer.brandLogoUrl"}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={settings.footer.brandDescription}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            footer: { ...prev.footer, brandDescription: event.target.value },
                          }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Colunas de links</h2>
                      <p className="text-xs text-muted-foreground">Edite as seções do footer.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            footer: {
                              ...prev.footer,
                              columns: [
                                ...prev.footer.columns,
                                { title: "Nova coluna", links: [] },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-6">
                      {settings.footer.columns.map((column, columnIndex) => (
                        <div key={`${column.title}-${columnIndex}`} className="rounded-2xl border border-border/60 bg-background/50 p-4 space-y-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Input
                              value={column.title}
                              onChange={(event) =>
                                setSettings((prev) => {
                                  const next = [...prev.footer.columns];
                                  next[columnIndex] = { ...next[columnIndex], title: event.target.value };
                                  return { ...prev, footer: { ...prev.footer, columns: next } };
                                })
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setSettings((prev) => ({
                                  ...prev,
                                  footer: {
                                    ...prev.footer,
                                    columns: prev.footer.columns.filter((_, idx) => idx !== columnIndex),
                                  },
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-3">
                            {column.links.map((link, linkIndex) => (
                              <div key={`${link.label}-${linkIndex}`} className="grid gap-3 md:grid-cols-[1fr_1.6fr_auto]">
                                <Input
                                  value={link.label}
                                  placeholder="Label"
                                  onChange={(event) =>
                                    setSettings((prev) => {
                                      const nextColumns = [...prev.footer.columns];
                                      const links = [...nextColumns[columnIndex].links];
                                      links[linkIndex] = { ...links[linkIndex], label: event.target.value };
                                      nextColumns[columnIndex] = { ...nextColumns[columnIndex], links };
                                      return { ...prev, footer: { ...prev.footer, columns: nextColumns } };
                                    })
                                  }
                                />
                                <Input
                                  value={link.href}
                                  placeholder="URL"
                                  onChange={(event) =>
                                    setSettings((prev) => {
                                      const nextColumns = [...prev.footer.columns];
                                      const links = [...nextColumns[columnIndex].links];
                                      links[linkIndex] = { ...links[linkIndex], href: event.target.value };
                                      nextColumns[columnIndex] = { ...nextColumns[columnIndex], links };
                                      return { ...prev, footer: { ...prev.footer, columns: nextColumns } };
                                    })
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setSettings((prev) => {
                                      const nextColumns = [...prev.footer.columns];
                                      const links = nextColumns[columnIndex].links.filter((_, idx) => idx !== linkIndex);
                                      nextColumns[columnIndex] = { ...nextColumns[columnIndex], links };
                                      return { ...prev, footer: { ...prev.footer, columns: nextColumns } };
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                setSettings((prev) => {
                                  const nextColumns = [...prev.footer.columns];
                                  const links = [...nextColumns[columnIndex].links, { label: "", href: "" }];
                                  nextColumns[columnIndex] = { ...nextColumns[columnIndex], links };
                                  return { ...prev, footer: { ...prev.footer, columns: nextColumns } };
                                })
                              }
                            >
                              <Plus className="h-4 w-4" />
                              Adicionar link
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Redes sociais</h2>
                        <p className="text-xs text-muted-foreground">Links exibidos no footer.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            footer: {
                              ...prev.footer,
                              socialLinks: [
                                ...prev.footer.socialLinks,
                                { label: "Nova rede", href: "", icon: "link" },
                              ],
                            },
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {settings.footer.socialLinks.map((link, index) => (
                        <div key={`${link.label}-${index}`} className="grid gap-3 md:grid-cols-[1fr_1.6fr_0.8fr_auto]">
                          <Input
                            value={link.label}
                            placeholder="Label"
                            onChange={(event) =>
                              setSettings((prev) => {
                                const next = [...prev.footer.socialLinks];
                                next[index] = { ...next[index], label: event.target.value };
                                return { ...prev, footer: { ...prev.footer, socialLinks: next } };
                              })
                            }
                          />
                          <Input
                            value={link.href}
                            placeholder="URL"
                            onChange={(event) =>
                              setSettings((prev) => {
                                const next = [...prev.footer.socialLinks];
                                next[index] = { ...next[index], href: event.target.value };
                                return { ...prev, footer: { ...prev.footer, socialLinks: next } };
                              })
                            }
                          />
                          <Select
                            value={link.icon || "link"}
                            onValueChange={(value) =>
                              setSettings((prev) => {
                                const next = [...prev.footer.socialLinks];
                                next[index] = { ...next[index], icon: value };
                                return { ...prev, footer: { ...prev.footer, socialLinks: next } };
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Ícone" />
                            </SelectTrigger>
                            <SelectContent>
                              {socialIconOptions.map((option) => {
                                const Icon = socialIconMap[option.id] || Link2;
                                return (
                                  <SelectItem key={option.id} value={option.id}>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-muted-foreground" />
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
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                footer: {
                                  ...prev.footer,
                                  socialLinks: prev.footer.socialLinks.filter((_, idx) => idx !== index),
                                },
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

                <Card className="border-border/60 bg-card/80">
                  <CardContent className="space-y-6 p-6">
                    <div>
                      <h2 className="text-lg font-semibold">Textos legais</h2>
                      <p className="text-xs text-muted-foreground">Descrição, aviso e copyright.</p>
                    </div>
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label>Parágrafos do aviso</Label>
                        <div className="space-y-3">
                          {settings.footer.disclaimer.map((item, index) => (
                            <div key={`disclaimer-${index}`} className="grid gap-3 md:grid-cols-[1fr_auto]">
                              <Textarea
                                value={item}
                                onChange={(event) =>
                                  setSettings((prev) => {
                                    const next = [...prev.footer.disclaimer];
                                    next[index] = event.target.value;
                                    return { ...prev, footer: { ...prev.footer, disclaimer: next } };
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setSettings((prev) => ({
                                    ...prev,
                                    footer: {
                                      ...prev.footer,
                                      disclaimer: prev.footer.disclaimer.filter((_, idx) => idx !== index),
                                    },
                                  }))
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              footer: {
                                ...prev.footer,
                                disclaimer: [...prev.footer.disclaimer, ""],
                              },
                            }))
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar paragrafo
                        </Button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Titulo do destaque</Label>
                          <Input
                            value={settings.footer.highlightTitle}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                footer: { ...prev.footer, highlightTitle: event.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição do destaque</Label>
                          <Textarea
                            value={settings.footer.highlightDescription}
                            onChange={(event) =>
                              setSettings((prev) => ({
                                ...prev,
                                footer: { ...prev.footer, highlightDescription: event.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Copyright</Label>
                        <Input
                          value={settings.footer.copyright}
                          onChange={(event) =>
                            setSettings((prev) => ({
                              ...prev,
                              footer: { ...prev.footer, copyright: event.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>
        </main>
    </DashboardShell>
  );
};

export default DashboardSettings;
