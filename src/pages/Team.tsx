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
import { isIconUrlSource, sanitizeIconSource, sanitizePublicHref } from "@/lib/url-safety";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import ThemedSvgMaskIcon from "@/components/ThemedSvgMaskIcon";

type PublicUser = {
  id: string;
  name: string;
  phrase: string;
  bio: string;
  avatarUrl?: string | null;
  socials?: Array<{ label: string; href: string }>;
  permissions?: string[];
  roles?: string[];
  isAdmin?: boolean;
  status?: "active" | "retired";
  order?: number;
};

type TeamMemberAvatarProps = {
  imageSrc: string;
  name: string;
};

const TeamMemberAvatar = ({ imageSrc, name }: TeamMemberAvatarProps) => {
  const [resolvedSrc, setResolvedSrc] = useState(imageSrc || "/placeholder.svg");

  useEffect(() => {
    setResolvedSrc(imageSrc || "/placeholder.svg");
  }, [imageSrc]);

  return (
    <div
      className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 overflow-hidden rounded-full transition-transform duration-500 group-hover:scale-105 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80"
    >
      <img
        src={resolvedSrc}
        alt={name}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className="h-full w-full object-cover"
        onError={() => {
          if (resolvedSrc === "/placeholder.svg") {
            return;
          }
          setResolvedSrc("/placeholder.svg");
        }}
      />
    </div>
  );
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

  const renderMemberAvatar = (member: PublicUser, imageSrc: string) => {
    return <TeamMemberAvatar imageSrc={imageSrc} name={member.name} />;
  };

  const resolveSocialLink = (
    social: { label?: string; href?: string },
    linkTypeMap: Map<string, { id: string; label: string; icon: string }>,
  ) => {
    const safeHref = sanitizePublicHref(social?.href);
    if (!safeHref) {
      return null;
    }
    const type = linkTypeMap.get(String(social?.label || ""));
    const label = String(type?.label || social?.label || "").trim() || "Link";
    const safeIconSource = sanitizeIconSource(type?.icon || "");
    const customIcon = isIconUrlSource(safeIconSource);
    const iconKey = customIcon ? "" : String(safeIconSource || "").toLowerCase();
    const Icon = socialIcons[iconKey] || Globe;
    return {
      href: safeHref,
      label,
      customIcon,
      iconSource: safeIconSource || "",
      Icon,
    };
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
          <div className="absolute inset-0 bg-linear-to-b from-primary/15 via-background to-background" />
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
            <div className="mt-10 rounded-2xl border border-border/60 bg-card/60 px-6 py-10 text-sm text-muted-foreground">
              Carregando equipe...
            </div>
          ) : members.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-border/60 bg-card/60 px-6 py-10 text-sm text-muted-foreground">
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
                      className="group overflow-visible border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg"
                    >
                      <CardContent className="relative p-8 sm:p-9">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                          <div className="relative lg:w-80">
                            <div className="relative h-64 sm:h-72 md:h-80 lg:h-full">
                              {renderMemberAvatar(member, imageSrc)}
                            </div>
                          </div>

                          <div className="relative mt-10 flex flex-1 flex-col gap-5 rounded-2xl bg-secondary/60 p-7 lg:mt-0 lg:px-8 lg:py-8">
                            <div className="min-w-0 flex items-center justify-between gap-2 lg:pr-44">
                              <h3 className="break-words text-base font-semibold text-foreground">
                                {member.name}
                              </h3>
                            </div>
                            {socials.length > 0 && (
                              <div className="flex flex-wrap items-center justify-start gap-3 lg:absolute lg:right-6 lg:top-6 lg:mt-0 lg:justify-end">
                                {socials.map((social) => {
                                  const resolved = resolveSocialLink(social, linkTypeMap);
                                  if (!resolved) {
                                    return null;
                                  }
                                  return (
                                    <a
                                      key={`${member.id}-${social.href}`}
                                      href={resolved.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-background/70 text-primary/80 transition hover:border-primary/50 hover:text-primary"
                                      aria-label={resolved.label}
                                    >
                                      {resolved.customIcon ? (
                                        <ThemedSvgMaskIcon
                                          url={resolved.iconSource}
                                          label={resolved.label}
                                          className="h-4 w-4"
                                        />
                                      ) : (
                                        <resolved.Icon className="h-4 w-4" />
                                      )}
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                            <p className="text-xs italic text-muted-foreground/80">
                              {member.phrase ? `"${member.phrase}"` : "-"}
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
                          className={`group overflow-visible border-border/60 bg-card/80 shadow-lg grayscale transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg ${
                            index === 0 ? "mt-20" : ""
                          }`}
                        >
                          <CardContent className="relative p-8 sm:p-9">
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                              <div className="relative lg:w-80">
                                <div className="relative h-64 sm:h-72 md:h-80 lg:h-full">
                                  {renderMemberAvatar(member, imageSrc)}
                                </div>
                              </div>

                              <div className="relative mt-10 flex flex-1 flex-col gap-5 rounded-2xl bg-secondary/60 p-7 lg:mt-0 lg:px-8 lg:py-8">
                                <div className="min-w-0 flex items-center justify-between gap-2 lg:pr-44">
                                  <h3 className="break-words text-base font-semibold text-foreground">
                                    {member.name}
                                  </h3>
                                </div>
                                {socials.length > 0 && (
                                  <div className="flex flex-wrap items-center justify-start gap-3 lg:absolute lg:right-6 lg:top-6 lg:mt-0 lg:justify-end">
                                    {socials.map((social) => {
                                      const resolved = resolveSocialLink(social, linkTypeMap);
                                      if (!resolved) {
                                        return null;
                                      }
                                      return (
                                        <a
                                          key={`${member.id}-${social.href}`}
                                          href={resolved.href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-background/70 text-primary/80 transition hover:border-primary/50 hover:text-primary"
                                          aria-label={resolved.label}
                                        >
                                          {resolved.customIcon ? (
                                            <ThemedSvgMaskIcon
                                              url={resolved.iconSource}
                                              label={resolved.label}
                                              className="h-4 w-4"
                                            />
                                          ) : (
                                            <resolved.Icon className="h-4 w-4" />
                                          )}
                                        </a>
                                      );
                                    })}
                                  </div>
                                )}
                                <p className="text-xs italic text-muted-foreground/80">
                                  {member.phrase ? `"${member.phrase}"` : "-"}
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




