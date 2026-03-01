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
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import ThemedSvgMaskIcon from "@/components/ThemedSvgMaskIcon";
import UploadPicture from "@/components/UploadPicture";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

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
  mediaVariants?: UploadMediaVariantsMap;
};

const TeamMemberAvatar = ({ imageSrc, name, mediaVariants }: TeamMemberAvatarProps) => {
  const [resolvedSrc, setResolvedSrc] = useState(imageSrc || "/placeholder.svg");

  useEffect(() => {
    setResolvedSrc(imageSrc || "/placeholder.svg");
  }, [imageSrc]);

  return (
    <div className="relative z-10 h-56 w-56 overflow-hidden rounded-full border border-white/10 ring-4 ring-background/70 shadow-[0_20px_46px_-24px_rgba(0,0,0,0.82)] transition-transform duration-500 group-hover:scale-105 sm:h-60 sm:w-60 md:h-64 md:w-64 lg:h-64 lg:w-64">
      <UploadPicture
        src={resolvedSrc}
        alt={name}
        preset="square"
        mediaVariants={mediaVariants}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className="block h-full w-full"
        imgClassName="h-full w-full object-cover"
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
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cacheBust, setCacheBust] = useState(Date.now());
  const [linkTypes, setLinkTypes] = useState<Array<{ id: string; label: string; icon: string }>>(
    [],
  );
  const [memberMediaVariants, setMemberMediaVariants] = useState<UploadMediaVariantsMap>({});
  const [pageCopy, setPageCopy] = useState({
    shareImage: "",
    shareImageAlt: "",
    heroBadge: "Equipe",
    heroTitle: "Conheça quem faz o projeto acontecer",
    heroSubtitle:
      "Os perfis e redes sociais serão gerenciados pela dashboard. Este layout antecipa como a equipe aparecerá para o público.",
    retiredTitle: "Membros aposentados",
    retiredSubtitle: "Agradecemos por todas as contribuições.",
  });
  const [pageMediaVariants, setPageMediaVariants] = useState<UploadMediaVariantsMap>({});
  usePageMeta({
    title: "Equipe",
    image: pageCopy.shareImage || undefined,
    imageAlt: pageCopy.shareImageAlt || undefined,
    mediaVariants: pageMediaVariants,
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
    return (
      <TeamMemberAvatar imageSrc={imageSrc} name={member.name} mediaVariants={memberMediaVariants} />
    );
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
            setMemberMediaVariants(
              data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {},
            );
            setCacheBust(Date.now());
          }
        } else if (isActive) {
          setMembers([]);
          setMemberMediaVariants({});
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
        if (isActive) {
          setPageMediaVariants(
            data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {},
          );
        }
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
        normalizedStatus(member.status) === "retired" ||
        normalizedStatus(member.status) === "aposentado",
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const activeMembers = members
    .filter(
      (member) =>
        normalizedStatus(member.status) !== "retired" &&
        normalizedStatus(member.status) !== "aposentado",
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const renderRoleBadge = (label: string, key: string, tone: "default" | "retired" = "default") => {
    const RoleIcon = getRoleIcon(label);
    return (
      <Badge
        key={key}
        variant="secondary"
        className={cn(
          "gap-1 border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]",
          tone === "retired"
            ? "border-primary/20 bg-primary/10 text-primary/90"
            : "border-white/5 bg-white/[0.04] text-foreground/80",
        )}
      >
        {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
        {label}
      </Badge>
    );
  };

  const renderMemberBadges = (member: PublicUser, isRetiredCard: boolean) => {
    const areas = (member.roles || []).filter((item) => item !== "Dono");
    const badges: Array<JSX.Element> = [];

    if (isRetiredCard) {
      badges.push(renderRoleBadge("Aposentado", `${member.id}-retired`, "retired"));
    }

    if ((member.roles || []).includes("Dono")) {
      badges.push(renderRoleBadge("Dono", `${member.id}-owner`));
    } else if (member.isAdmin) {
      badges.push(renderRoleBadge("Administrador", `${member.id}-admin`));
    }

    if (areas.length > 0) {
      for (const area of areas) {
        badges.push(renderRoleBadge(area, `${member.id}-${area}`));
      }
    } else if (!isRetiredCard && !(member.roles || []).includes("Dono") && !member.isAdmin) {
      badges.push(renderRoleBadge("Membro", `${member.id}-member`));
    }

    return <div className="flex flex-wrap gap-2 pt-1">{badges}</div>;
  };

  const getMemberImageSrc = (member: PublicUser) => {
    const image = member.avatarUrl || "/placeholder.svg";
    return image && image !== "/placeholder.svg"
      ? image.includes("?")
        ? `${image}&v=${cacheBust}`
        : `${image}?v=${cacheBust}`
      : "/placeholder.svg";
  };

  const renderMemberCard = (member: PublicUser, options?: { retired?: boolean }) => {
    const isRetiredCard = options?.retired ?? false;
    const imageSrc = getMemberImageSrc(member);
    const socials = (member.socials || []).filter((social) => social.href);
    const linkTypeMap = new Map(linkTypes.map((item) => [item.id, item]));

    return (
      <Card
        key={member.id}
        className={cn(
          "group overflow-hidden rounded-[28px] border shadow-[0_24px_70px_-36px_rgba(0,0,0,0.75)] transition-colors duration-300",
          isRetiredCard
            ? "border-border/35 bg-card/80 hover:border-primary/20 hover:bg-card/85"
            : "border-border/50 bg-card/85 hover:border-primary/30 hover:bg-card/90",
        )}
      >
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch">
            <div
              className={cn(
                "relative flex min-h-64 items-center justify-center py-2 sm:min-h-72 lg:min-h-[280px]",
                isRetiredCard ? "text-foreground/80" : "text-foreground",
              )}
            >
              {renderMemberAvatar(member, imageSrc)}
            </div>

            <div
              className={cn(
                "flex h-full flex-col gap-4 rounded-2xl border p-5 sm:p-6 lg:p-6",
                isRetiredCard
                  ? "border-white/[0.04] bg-black/10"
                  : "border-white/5 bg-black/15",
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-3 sm:pr-4">
                  <h3 className="break-words text-lg font-semibold text-foreground">{member.name}</h3>
                </div>
                {socials.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/15 bg-background/60 text-primary/80 transition hover:border-primary/35 hover:text-primary"
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
              </div>

              <p
                className={cn(
                  "rounded-2xl border px-3 py-2 text-xs italic leading-6",
                  isRetiredCard
                    ? "border-white/[0.04] bg-white/[0.02] text-muted-foreground/90"
                    : "border-primary/10 bg-primary/[0.06] text-muted-foreground/90",
                )}
              >
                {member.phrase ? `"${member.phrase}"` : "-"}
              </p>

              <p className="text-sm leading-7 text-muted-foreground">
                {member.bio || "Sem biografia cadastrada."}
              </p>

              {renderMemberBadges(member, isRetiredCard)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-primary/15 via-background to-background" />
          <div
            className={`${publicPageLayoutTokens.sectionBase} relative flex max-w-6xl flex-col gap-6 pb-12 pt-24 md:pt-28 reveal`}
            data-reveal
          >
            <div className="max-w-3xl space-y-4">
              <Badge
                variant="secondary"
                className="text-xs uppercase tracking-widest animate-fade-in"
              >
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

        <section
          className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-20 pt-6 reveal`}
          data-reveal
        >
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
              <div className="mt-10 grid gap-8 md:gap-10">
                {activeMembers.map((member) => renderMemberCard(member))}
              </div>

              {retiredMembers.length > 0 && (
                <div className="mt-16 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {pageCopy.retiredTitle}
                    </h2>
                    <p className="text-sm text-muted-foreground">{pageCopy.retiredSubtitle}</p>
                  </div>
                  <div className="mt-8 grid gap-8 md:gap-10">
                    {retiredMembers.map((member) => renderMemberCard(member, { retired: true }))}
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
