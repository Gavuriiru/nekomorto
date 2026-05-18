import { useEffect, useMemo, useState } from "react";

import PublicPageHero from "@/components/PublicPageHero";
import PublicTeamPageContent from "@/components/public-pages/PublicTeamPageContent";
import {
  usePublishResolvedPublicSnapshots,
  useResolvedPublicBootstrap,
  useResolvedPublicRoutePayload,
} from "@/hooks/public-bootstrap-provider";
import { usePageMeta } from "@/hooks/use-page-meta";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import type { PublicTeamLinkType, PublicTeamMember } from "@/types/public-team";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
  resolveInstitutionalOgSupportText,
} from "../../shared/institutional-og-seo.js";

const resolveTextOrFallback = (value: unknown, fallback: string) =>
  String(value || "").trim() || fallback;

const Team = () => {
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const windowBootstrap = useResolvedPublicBootstrap();
  const { publishPublicRoutePayload } = usePublishResolvedPublicSnapshots();
  const { data: bootstrapData } = usePublicBootstrap();
  const bootstrap = bootstrapData || windowBootstrap;
  const routePayload = useResolvedPublicRoutePayload();
  const hasFullBootstrap = bootstrap?.payloadMode === "full";
  const teamRoutePayload = routePayload?.kind === "team" ? routePayload : null;
  const bootstrapHasTeamSnapshot = Boolean(
    bootstrap &&
      (Array.isArray(bootstrap.teamMembers) ||
        Array.isArray(bootstrap.teamLinkTypes) ||
        (bootstrap.mediaVariants && typeof bootstrap.mediaVariants === "object")),
  );
  const hasTeamBootstrapSnapshot =
    Boolean(teamRoutePayload) || (hasFullBootstrap && bootstrapHasTeamSnapshot);
  const bootstrapMembers = teamRoutePayload
    ? teamRoutePayload.teamMembers
    : hasTeamBootstrapSnapshot
      ? bootstrap?.teamMembers || []
      : [];
  const bootstrapLinkTypes = teamRoutePayload
    ? teamRoutePayload.teamLinkTypes
    : hasTeamBootstrapSnapshot
      ? bootstrap?.teamLinkTypes || []
      : [];
  const bootstrapMediaVariants = teamRoutePayload
    ? teamRoutePayload.mediaVariants || {}
    : hasTeamBootstrapSnapshot
      ? bootstrap?.mediaVariants || {}
      : {};
  const [members, setMembers] = useState<PublicTeamMember[]>(() => bootstrapMembers);
  const [isLoading, setIsLoading] = useState(() => !hasTeamBootstrapSnapshot);
  const [linkTypes, setLinkTypes] = useState<PublicTeamLinkType[]>(() => bootstrapLinkTypes);
  const [memberMediaVariants, setMemberMediaVariants] = useState<UploadMediaVariantsMap>(
    () => bootstrapMediaVariants,
  );
  const pageCopy = useMemo(
    () => ({
      shareImage: String(bootstrap?.pages.team?.shareImage || "").trim(),
      shareImageAlt: String(bootstrap?.pages.team?.shareImageAlt || "").trim(),
      heroBadge: resolveTextOrFallback(bootstrap?.pages.team?.heroBadge, "Equipe"),
      heroTitle: resolveTextOrFallback(
        bootstrap?.pages.team?.heroTitle,
        "ConheÃ§a quem faz o projeto acontecer",
      ),
      heroSubtitle: resolveTextOrFallback(
        bootstrap?.pages.team?.heroSubtitle,
        "Os perfis e redes sociais serÃ£o gerenciados pela dashboard. Este layout antecipa como a equipe aparecerÃ¡ para o pÃºblico.",
      ),
      retiredTitle: resolveTextOrFallback(
        bootstrap?.pages.team?.retiredTitle,
        "Membros aposentados",
      ),
      retiredSubtitle: resolveTextOrFallback(
        bootstrap?.pages.team?.retiredSubtitle,
        "Agradecemos por todas as contribuiÃ§Ãµes.",
      ),
    }),
    [bootstrap],
  );
  const pageMediaVariants = bootstrap?.mediaVariants || {};

  usePageMeta({
    title: "Equipe",
    description: resolveInstitutionalOgSupportText({
      pageKey: "team",
      pages: bootstrap?.pages,
      settings: bootstrap?.settings,
    }),
    image: buildVersionedInstitutionalOgImagePath({
      pageKey: "team",
      revision: buildInstitutionalOgRevision({
        pageKey: "team",
        pages: bootstrap?.pages,
        settings: bootstrap?.settings,
      }),
    }),
    imageAlt: buildInstitutionalOgImageAlt("team"),
    mediaVariants: pageMediaVariants,
  });

  useEffect(() => {
    if (teamRoutePayload) {
      setMembers(teamRoutePayload.teamMembers || []);
      setLinkTypes(teamRoutePayload.teamLinkTypes || []);
      setMemberMediaVariants(teamRoutePayload.mediaVariants || {});
      setIsLoading(false);
      return;
    }
    if (hasFullBootstrap && bootstrapHasTeamSnapshot) {
      setMembers(bootstrap?.teamMembers || []);
      setLinkTypes(bootstrap?.teamLinkTypes || []);
      setMemberMediaVariants(bootstrap?.mediaVariants || {});
      setIsLoading(false);
      return;
    }
  }, [bootstrap, bootstrapHasTeamSnapshot, hasFullBootstrap, teamRoutePayload]);

  useEffect(() => {
    if (hasTeamBootstrapSnapshot) {
      return;
    }
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
              data?.mediaVariants && typeof data.mediaVariants === "object"
                ? data.mediaVariants
                : {},
            );
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

    void load();
    return () => {
      isActive = false;
    };
  }, [apiBase, hasTeamBootstrapSnapshot]);

  useEffect(() => {
    publishPublicRoutePayload({
      kind: "team",
      generatedAt: teamRoutePayload?.generatedAt || bootstrap?.generatedAt || "",
      teamMembers: members,
      teamLinkTypes: linkTypes,
      mediaVariants: memberMediaVariants,
    });
  }, [
    bootstrap?.generatedAt,
    linkTypes,
    memberMediaVariants,
    members,
    publishPublicRoutePayload,
    teamRoutePayload?.generatedAt,
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicPageHero
        badge={pageCopy.heroBadge}
        title={pageCopy.heroTitle}
        subtitle={pageCopy.heroSubtitle}
      />
      <PublicTeamPageContent
        isLoading={isLoading}
        linkTypes={linkTypes}
        mediaVariants={memberMediaVariants}
        members={members}
        pageCopy={pageCopy}
        siteSettings={settings}
      />
    </div>
  );
};

export default Team;
