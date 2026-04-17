import {
  BadgeCheck,
  Camera,
  Check,
  Clock,
  Code,
  Globe,
  Languages,
  Layers,
  MessageCircle,
  Paintbrush,
  Palette,
  PenTool,
  Play,
  Shield,
  Sparkles,
  User,
  Video,
  X,
} from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useState } from "react";

import ThemedSvgMaskIcon from "@/components/ThemedSvgMaskIcon";
import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PillButton } from "@/components/ui/pill-button";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { resolveDiscordAvatarRenderUrl } from "@/lib/discord-avatar";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import "@/styles/public-user-profile-card.css";
import { isIconUrlSource, sanitizeIconSource, sanitizePublicHref } from "@/lib/url-safety";
import { cn } from "@/lib/utils";
import type {
  FavoriteWorkCategory,
  FavoriteWorksByCategory,
  PublicTeamLinkType,
  PublicTeamMember,
} from "@/types/public-team";

const FAVORITE_WORK_CATEGORIES = ["manga", "anime"] as const;
const FAVORITES_HINT_TEXT = "Clique para ver as obras favoritas";
const FAVORITES_TOGGLE_IGNORE_SELECTOR = "a,button";

type PublicUserProfileCardProps = {
  member: PublicTeamMember;
  linkTypes?: PublicTeamLinkType[];
  mediaVariants?: UploadMediaVariantsMap;
  retired?: boolean;
  imageSrc?: string;
  imageLoading?: "eager" | "lazy";
  imageFetchPriority?: "high" | "low" | "auto";
  imageSizes?: string;
  testId?: string;
};

type PublicUserProfileAvatarProps = {
  imageSrc: string;
  name: string;
  mediaVariants?: UploadMediaVariantsMap;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
};

const MAX_FAVORITE_WORKS = 3;
const MAX_FAVORITE_WORK_LENGTH = 80;

const SOCIAL_ICONS = {
  instagram: Camera,
  twitter: X,
  x: X,
  youtube: Play,
  discord: MessageCircle,
  "message-circle": MessageCircle,
  site: Globe,
  website: Globe,
  portfolio: Globe,
  globe: Globe,
} as const;

const ROLE_ICON_REGISTRY = {
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
} as const;

const normalizeFavoriteWorksList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const dedupe = new Set<string>();
  const output: string[] = [];
  for (const item of value) {
    const title = String(item || "")
      .trim()
      .slice(0, MAX_FAVORITE_WORK_LENGTH);
    if (!title) {
      continue;
    }
    const dedupeKey = title.toLowerCase();
    if (dedupe.has(dedupeKey)) {
      continue;
    }
    dedupe.add(dedupeKey);
    output.push(title);
    if (output.length >= MAX_FAVORITE_WORKS) {
      break;
    }
  }
  return output;
};

const normalizeFavoriteWorksByCategory = (value: unknown): FavoriteWorksByCategory => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      manga: [],
      anime: [],
    };
  }
  const source = value as Partial<Record<FavoriteWorkCategory, unknown>>;
  return {
    manga: normalizeFavoriteWorksList(source.manga),
    anime: normalizeFavoriteWorksList(source.anime),
  };
};

const PublicUserProfileAvatar = ({
  imageSrc,
  name,
  mediaVariants,
  loading,
  fetchPriority,
  sizes,
}: PublicUserProfileAvatarProps) => {
  const normalizedImageSrc =
    resolveDiscordAvatarRenderUrl(imageSrc || "/placeholder.svg", 256) || "/placeholder.svg";
  const [resolvedSrc, setResolvedSrc] = useState(normalizedImageSrc);

  useEffect(() => {
    setResolvedSrc(normalizedImageSrc);
  }, [normalizedImageSrc]);

  return (
    <div className="team-member-avatar-shell relative z-10 h-56 w-56 rounded-full shadow-profile-avatar transition-transform duration-500 group-hover:scale-105 sm:h-60 sm:w-60 md:h-64 md:w-64 lg:h-64 lg:w-64">
      <div className="team-member-avatar-frame h-full w-full overflow-hidden rounded-full border border-white/10 bg-background ring-4 ring-background/70">
        <UploadPicture
          src={resolvedSrc}
          alt={name}
          preset="square"
          mediaVariants={mediaVariants}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          className="block h-full w-full"
          imgClassName="h-full w-full object-cover"
          loading={loading}
          fetchPriority={fetchPriority}
          sizes={sizes}
          onError={() => {
            if (resolvedSrc === "/placeholder.svg") {
              return;
            }
            setResolvedSrc("/placeholder.svg");
          }}
        />
      </div>
    </div>
  );
};

const resolveSocialLink = (
  social: { label?: string; href?: string },
  linkTypeMap: Map<string, PublicTeamLinkType>,
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
  const Icon = SOCIAL_ICONS[iconKey as keyof typeof SOCIAL_ICONS] || Globe;
  return {
    href: safeHref,
    label,
    customIcon,
    iconSource: safeIconSource || "",
    Icon,
  };
};

const shouldIgnoreFavoritePanelToggle = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(FAVORITES_TOGGLE_IGNORE_SELECTOR));

const PublicUserProfileCard = ({
  member,
  linkTypes = [],
  mediaVariants,
  retired = false,
  imageSrc,
  imageLoading,
  imageFetchPriority,
  imageSizes,
  testId,
}: PublicUserProfileCardProps) => {
  const { settings } = useSiteSettings();
  const [isFavoritePanelOpen, setFavoritePanelOpen] = useState(false);

  const roleIconMap = useMemo(
    () => new Map((settings?.teamRoles || []).map((role) => [role.label, role.icon])),
    [settings?.teamRoles],
  );

  const getRoleIcon = (role: string) => {
    const key = roleIconMap.get(role);
    if (key) {
      return (
        ROLE_ICON_REGISTRY[String(key).toLowerCase() as keyof typeof ROLE_ICON_REGISTRY] || null
      );
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

  const favoriteWorks = normalizeFavoriteWorksByCategory(member.favoriteWorks);
  const hasFavoriteWorks = favoriteWorks.manga.length > 0 || favoriteWorks.anime.length > 0;
  const isFavoritesOpen = hasFavoriteWorks && isFavoritePanelOpen;
  const linkTypeMap = useMemo(
    () => new Map((linkTypes || []).map((item) => [item.id, item])),
    [linkTypes],
  );
  const resolvedImageSrc = String(imageSrc || member.avatarUrl || "").trim() || "/placeholder.svg";
  const socials = (member.socials || []).filter((social) => social.href);

  const toggleFavoritePanel = () => {
    if (!hasFavoriteWorks) {
      return;
    }
    setFavoritePanelOpen((current) => !current);
  };

  const handleFavoriteCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!hasFavoriteWorks || shouldIgnoreFavoritePanelToggle(event.target)) {
      return;
    }
    toggleFavoritePanel();
  };

  const handleFavoriteCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!hasFavoriteWorks || event.target !== event.currentTarget) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
      return;
    }
    event.preventDefault();
    toggleFavoritePanel();
  };

  const renderRoleBadge = (label: string, key: string, tone: "default" | "retired" = "default") => {
    const RoleIcon = getRoleIcon(label);
    return (
      <Badge
        key={key}
        variant="secondary"
        className={cn(
          "team-member-role-badge gap-1 border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]",
          tone === "retired"
            ? "team-member-role-badge--retired border-primary/25 bg-primary/10 text-primary/90"
            : "border-border/60 bg-secondary/85 text-secondary-foreground",
        )}
      >
        {RoleIcon ? <RoleIcon className="h-3 w-3" /> : null}
        {label}
      </Badge>
    );
  };

  const renderMemberBadges = () => {
    const areas = (member.roles || []).filter((item) => item !== "Dono");
    const badges: Array<JSX.Element> = [];

    if (retired) {
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
    } else if (!retired && !(member.roles || []).includes("Dono") && !member.isAdmin) {
      badges.push(renderRoleBadge("Membro", `${member.id}-member`));
    }

    return <div className="flex flex-wrap gap-2 pt-1">{badges}</div>;
  };

  return (
    <Card
      data-testid={testId}
      className={cn(
        "group overflow-hidden rounded-[28px] border shadow-profile-card transition-colors duration-300",
        hasFavoriteWorks && "team-member-card--interactive",
        retired
          ? "border-border/35 bg-card/80 hover:border-primary/60 hover:bg-card/85"
          : "border-border/50 bg-card/85 hover:border-primary/60 hover:bg-card/90",
      )}
      tabIndex={hasFavoriteWorks ? 0 : undefined}
      onClick={hasFavoriteWorks ? handleFavoriteCardClick : undefined}
      onKeyDown={hasFavoriteWorks ? handleFavoriteCardKeyDown : undefined}
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch">
          <div
            className={cn(
              "relative flex min-h-64 items-center justify-center py-2 sm:min-h-72 lg:min-h-[280px]",
              retired ? "text-foreground/80" : "text-foreground",
            )}
          >
            <PublicUserProfileAvatar
              imageSrc={resolvedImageSrc}
              name={member.name}
              mediaVariants={mediaVariants}
              loading={imageLoading}
              fetchPriority={imageFetchPriority}
              sizes={imageSizes}
            />
          </div>

          <div
            className={cn(
              "team-member-frame flex h-full flex-col gap-4 rounded-2xl border p-5 sm:p-6 lg:p-6",
              hasFavoriteWorks && "team-member-frame--has-favorites",
              retired && "team-member-frame--retired",
            )}
            data-favorites-open={isFavoritesOpen ? "true" : "false"}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-3 sm:pr-4">
                <h3 className="break-words text-lg font-semibold text-foreground">{member.name}</h3>
              </div>
              {socials.length > 0 ? (
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
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/15 bg-background/60 text-primary/80 transition hover:border-primary/60 hover:text-primary"
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
              ) : null}
            </div>

            {hasFavoriteWorks ? (
              <PillButton
                tone="primary"
                className="team-member-favorites-toggle w-fit gap-0 px-3 py-1 text-[11px] uppercase tracking-[0.12em] md:hidden"
                aria-pressed={isFavoritesOpen}
                aria-label={isFavoritesOpen ? "Ver bio" : "Ver obras favoritas"}
                onClick={toggleFavoritePanel}
              >
                {isFavoritesOpen ? "Ver bio" : "Ver obras favoritas"}
              </PillButton>
            ) : null}

            <div className="team-member-panel-shell flex flex-col gap-4">
              <div className="team-member-panel team-member-panel--bio flex-col gap-4">
                <p
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs italic leading-6",
                    retired
                      ? "border-white/[0.04] bg-white/[0.02] text-muted-foreground/90"
                      : "border-primary/10 bg-primary/[0.06] text-muted-foreground/90",
                  )}
                >
                  {member.phrase ? `"${member.phrase}"` : "-"}
                </p>

                <p className="text-sm leading-7 text-muted-foreground">
                  {member.bio || "Sem biografia cadastrada."}
                </p>

                {renderMemberBadges()}
              </div>

              {hasFavoriteWorks ? (
                <div className="team-member-panel team-member-panel--favorites flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/90">
                    Obras favoritas
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {FAVORITE_WORK_CATEGORIES.map((category) => {
                      const categoryLabel = category === "manga" ? "Mangá" : "Anime";
                      const items = favoriteWorks[category];
                      return (
                        <div
                          key={`${member.id}-${category}`}
                          className="space-y-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-3"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">
                            {categoryLabel}
                          </p>
                          {items.length > 0 ? (
                            <ul className="space-y-2">
                              {items.map((work, index) => (
                                <li
                                  key={`${member.id}-${category}-${work}-${index}`}
                                  className="rounded-xl border border-primary/15 bg-primary/[0.06] px-3 py-2 text-sm text-foreground/90"
                                >
                                  {work}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Nenhuma obra cadastrada.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {hasFavoriteWorks ? (
                <p className="team-member-favorites-hint" aria-hidden="true">
                  {FAVORITES_HINT_TEXT}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PublicUserProfileCard;
