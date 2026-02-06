import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  BadgeCheck,
  Check,
  Clock,
  Code,
  Globe,
  Instagram,
  Languages,
  Layers,
  MessageCircle,
  Paintbrush,
  Palette,
  PenTool,
  Sparkles,
  Shield,
  User,
  Video,
  X,
  Youtube,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";

type PublicUser = {
  id: string;
  name: string;
  phrase: string;
  bio: string;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  socials?: Array<{ label: string; href: string }>;
  permissions?: string[];
  roles?: string[];
  isAdmin?: boolean;
  status?: "active" | "retired";
};

const Team = () => {
  usePageMeta({ title: "Equipe" });

  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cacheBust, setCacheBust] = useState(Date.now());
  const [linkTypes, setLinkTypes] = useState<Array<{ id: string; label: string; icon: string }>>([]);
  const [pageCopy, setPageCopy] = useState({
    heroBadge: "Equipe",
    heroTitle: "Conheça quem faz o projeto acontecer",
    heroSubtitle:
      "Os perfis e redes sociais serão gerenciados pela dashboard. Este layout antecipa como a equipe aparecerá para o público.",
    retiredTitle: "Membros aposentados",
    retiredSubtitle: "Agradecemos por todas as contribuições.",
  });
  const socialIcons = useMemo(
    () => ({
      instagram: Instagram,
      twitter: X,
      x: X,
      youtube: Youtube,
      discord: MessageCircle,
      "message-circle": MessageCircle,
      site: Globe,
      website: Globe,
      portfolio: Globe,
      globe: Globe,
    }),
    [],
  );
  const isIconUrl = (value?: string | null) => {
    if (!value) return false;
    return value.startsWith("http") || value.startsWith("data:") || value.startsWith("/uploads/");
  };
  const roleIconRegistry = useMemo(
    () => ({
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
    }),
    [],
  );
  const roleIconMap = useMemo(
    () => new Map((settings?.teamRoles || []).map((role) => [role.label, role.icon])),
    [settings?.teamRoles],
  );
  const getRoleIcon = (role: string) => {
    const key = roleIconMap.get(role);
    if (key) {
      return roleIconRegistry[String(key).toLowerCase()];
    }
    const normalized = role.toLowerCase();
    if (normalized === "dono") {
      return BadgeCheck;
    }
    if (normalized === "membro") {
      return User;
    }
    if (normalized === "administrador") {
      return Shield;
    }
    if (normalized.includes("aposent")) {
      return Clock;
    }
    return null;
  };

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const [usersRes, linkRes] = await Promise.all([
          apiFetch(apiBase, "/api/public/users"),
          apiFetch(apiBase, "/api/link-types"),
        ]);
        if (usersRes.ok) {
          const data = await usersRes.json();
          if (isActive) {
            setMembers(Array.isArray(data.users) ? data.users : []);
            setCacheBust(Date.now());
          }
        }
        if (linkRes.ok) {
          const data = await linkRes.json();
          if (isActive) {
            setLinkTypes(Array.isArray(data.items) ? data.items : []);
          }
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [apiBase]);

  useEffect(() => {
    let isActive = true;
    const loadCopy = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/pages");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive && data.pages?.team) {
          setPageCopy((prev) => ({ ...prev, ...data.pages.team }));
        }
      } catch {
        // ignore
      }
    };
    loadCopy();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  const normalizedStatus = (status?: string | null) => (status || "").toLowerCase();
  const retiredMembers = members
    .filter(
      (member) =>
        normalizedStatus(member.status) === "retired" || normalizedStatus(member.status) === "aposentado",
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const activeMembers = members
    .filter(
      (member) => normalizedStatus(member.status) !== "retired" && normalizedStatus(member.status) !== "aposentado",
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="min-h-screen bg-background text-foreground">

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-background to-background" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-12 pt-24 md:px-10 md:pt-28 reveal" data-reveal>
            <div className="max-w-3xl space-y-4">
              <Badge variant="secondary" className="text-xs uppercase tracking-widest animate-fade-in">
                {pageCopy.heroBadge}
              </Badge>
              <h1 className="text-3xl font-semibold text-foreground md:text-5xl animate-slide-up">
                {pageCopy.heroTitle}
              </h1>
              <p
                className="text-sm text-muted-foreground md:text-base animate-slide-up opacity-0"
                style={{ animationDelay: "0.2s" }}
              >
                {pageCopy.heroSubtitle}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-6 md:px-10 reveal" data-reveal>
          {isLoading ? (
            <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
              Carregando equipe...
            </div>
          ) : members.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-10 text-sm text-muted-foreground">
              Nenhum membro disponível no momento.
            </div>
          ) : (
            <>
              <div className="mt-10 grid gap-24">
                {activeMembers.map((member) => {
                  const image = member.avatarUrl || "/placeholder.svg";
                  const imageSrc =
                    image && image !== "/placeholder.svg"
                      ? image.includes("?")
                        ? `${image}&v=${cacheBust}`
                        : `${image}?v=${cacheBust}`
                      : "/placeholder.svg";
                  const socials = (member.socials || []).filter((social) => social.href);
                  const linkTypeMap = new Map(linkTypes.map((item) => [item.id, item]));
                  const areas = (member.roles || []).filter((item) => item !== "Dono");
                  return (
                    <Card
                      key={member.id}
                      className="group overflow-visible border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                    >
                      <CardContent className="relative p-8 sm:p-9">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch">
                          <div className="relative sm:w-56 md:w-72 lg:w-80">
                            <div className="relative h-64 sm:h-full">
                              <img
                                src={imageSrc}
                                alt={member.name}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                onError={(event) => {
                                  const target = event.currentTarget;
                                  if (target.src.endsWith("/placeholder.svg")) {
                                    return;
                                  }
                                  target.src = "/placeholder.svg";
                                }}
                                className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full object-cover object-center drop-shadow-[0_22px_44px_rgba(0,0,0,0.55)] transition-transform duration-500 group-hover:scale-105 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80"
                              />
                            </div>
                          </div>

                          <div className="relative mt-10 flex flex-1 flex-col gap-5 rounded-2xl bg-secondary/60 p-7 sm:mt-0 sm:px-8 sm:py-8">
                            {socials.length > 0 && (
                              <div className="absolute right-6 top-6 flex items-center gap-2">
                                {socials.map((social) => {
                                  const type = linkTypeMap.get(social.label);
                                  const iconKey = type?.icon || social.label;
                                  const label = type?.label || social.label;
                                  const isCustomIcon = isIconUrl(iconKey);
                                  const Icon =
                                    !isCustomIcon
                                      ? socialIcons[iconKey?.toLowerCase?.() || iconKey] || Globe
                                      : null;
                                  return (
                                    <a
                                      key={`${member.id}-${social.href}`}
                                      href={social.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-background/70 text-primary/80 transition hover:border-primary/50 hover:text-primary"
                                      aria-label={label}
                                    >
                                      {isCustomIcon ? (
                                        <ThemedSvgLogo
                                          url={iconKey}
                                          label={label}
                                          className="h-4 w-4 text-primary"
                                        />
                                      ) : (
                                        <Icon className="h-4 w-4" />
                                      )}
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-base font-semibold text-foreground">{member.name}</h3>
                            </div>
                            <p className="text-xs italic text-muted-foreground/80">
                              {member.phrase ? `"${member.phrase}"` : "—"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.bio || "Sem biografia cadastrada."}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {(member.roles || []).includes("Dono") && (() => {
                                const RoleIcon = getRoleIcon("Dono");
                                return (
                                  <Badge variant="secondary" className="text-[10px] uppercase gap-1">
                                    {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
                                    Dono
                                  </Badge>
                                );
                              })()}
                              {!(member.roles || []).includes("Dono") && member.isAdmin && (() => {
                                const RoleIcon = getRoleIcon("Administrador");
                                return (
                                  <Badge variant="secondary" className="text-[10px] uppercase gap-1">
                                    {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
                                    Administrador
                                  </Badge>
                                );
                              })()}
                              {areas.length > 0 ? (
                                areas.map((area) => {
                                  const RoleIcon = getRoleIcon(area);
                                  return (
                                    <Badge key={area} variant="secondary" className="text-[10px] uppercase gap-1">
                                      {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
                                      {area}
                                    </Badge>
                                  );
                                })
                              ) : (
                                !(member.roles || []).includes("Dono") && !member.isAdmin && (() => {
                                  const RoleIcon = getRoleIcon("Membro");
                                  return (
                                    <Badge variant="secondary" className="text-[10px] uppercase gap-1">
                                      {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
                                      Membro
                                    </Badge>
                                  );
                                })()
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {retiredMembers.length > 0 && (
                <div className="mt-16 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{pageCopy.retiredTitle}</h2>
                    <p className="text-sm text-muted-foreground">{pageCopy.retiredSubtitle}</p>
                  </div>
                  <div className="mt-16 grid gap-24">
                    {retiredMembers.map((member, index) => {
                      const image = member.avatarUrl || "/placeholder.svg";
                      const imageSrc =
                        image && image !== "/placeholder.svg"
                          ? image.includes("?")
                            ? `${image}&v=${cacheBust}`
                            : `${image}?v=${cacheBust}`
                          : "/placeholder.svg";
                      const socials = (member.socials || []).filter((social) => social.href);
                      const linkTypeMap = new Map(linkTypes.map((item) => [item.id, item]));
                      const areas = (member.roles || []).filter((item) => item !== "Dono");
                      return (
                        <Card
                          key={member.id}
                          className={`group overflow-visible border-border/60 bg-card/80 shadow-lg grayscale ${
                            index === 0 ? "mt-20" : ""
                          }`}
                        >
                          <CardContent className="relative p-8 sm:p-9">
                            <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch">
                              <div className="relative sm:w-56 md:w-72 lg:w-80">
                                <div className="relative h-64 sm:h-full">
                                  <img
                                    src={imageSrc}
                                    alt={member.name}
                                    referrerPolicy="no-referrer"
                                    crossOrigin="anonymous"
                                    onError={(event) => {
                                      const target = event.currentTarget;
                                      if (target.src.endsWith("/placeholder.svg")) {
                                        return;
                                      }
                                      target.src = "/placeholder.svg";
                                    }}
                                    className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full object-cover object-center drop-shadow-[0_22px_44px_rgba(0,0,0,0.55)] transition-transform duration-500 group-hover:scale-105 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80"
                                  />
                                </div>
                              </div>

                              <div className="relative mt-10 flex flex-1 flex-col gap-5 rounded-2xl bg-secondary/60 p-7 sm:mt-0 sm:px-8 sm:py-8">
                                {socials.length > 0 && (
                                  <div className="absolute right-6 top-6 flex items-center gap-2">
                                    {socials.map((social) => {
                                      const type = linkTypeMap.get(social.label);
                                      const iconKey = type?.icon || social.label;
                                      const label = type?.label || social.label;
                                      const isCustomIcon = isIconUrl(iconKey);
                                      const Icon =
                                        !isCustomIcon
                                          ? socialIcons[iconKey?.toLowerCase?.() || iconKey] || Globe
                                          : null;
                                      return (
                                        <a
                                          key={`${member.id}-${social.href}`}
                                          href={social.href}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-background/70 text-primary/80 transition hover:border-primary/50 hover:text-primary"
                                          aria-label={label}
                                        >
                                          {isCustomIcon ? (
                                            <ThemedSvgLogo
                                              url={iconKey}
                                              label={label}
                                              className="h-4 w-4 text-primary"
                                            />
                                          ) : (
                                            <Icon className="h-4 w-4" />
                                          )}
                                        </a>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-base font-semibold text-foreground">{member.name}</h3>
                                </div>
                                <p className="text-xs italic text-muted-foreground/80">
                                  {member.phrase ? `"${member.phrase}"` : "—"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {member.bio || "Sem biografia cadastrada."}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {member.status === "retired" && (() => {
                                    const RoleIcon = getRoleIcon("Aposentado");
                                    return (
                                      <Badge variant="secondary" className="text-[10px] uppercase gap-1">
                                        {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
                                        Aposentado
                                      </Badge>
                                    );
                                  })()}
                                  {(member.roles || []).includes("Dono") && (() => {
                                    const RoleIcon = getRoleIcon("Dono");
                                    return (
                                      <Badge variant="secondary" className="text-[10px] uppercase gap-1">
                                        {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
                                        Dono
                                      </Badge>
                                    );
                                  })()}
                                  {!(member.roles || []).includes("Dono") && member.isAdmin && (() => {
                                    const RoleIcon = getRoleIcon("Administrador");
                                    return (
                                      <Badge variant="secondary" className="text-[10px] uppercase gap-1">
                                        {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
                                        Administrador
                                      </Badge>
                                    );
                                  })()}
                                  {areas.length > 0 ? (
                                    areas.map((area) => {
                                      const RoleIcon = getRoleIcon(area);
                                      return (
                                        <Badge key={area} variant="secondary" className="text-[10px] uppercase gap-1">
                                          {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
                                          {area}
                                        </Badge>
                                      );
                                    })
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default Team;




