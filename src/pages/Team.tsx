import { useEffect, useMemo, useState } from "react";

import PublicTeamPageContent from "@/components/public-pages/PublicTeamPageContent";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  useResolvedPublicBootstrap,
  useResolvedPublicRoutePayload,
} from "@/hooks/public-bootstrap-provider";
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

const Team = () => {
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const windowBootstrap = useResolvedPublicBootstrap();
  const { data: bootstrapData } = usePublicBootstrap();
  const bootstrap = bootstrapData || windowBootstrap;
  const routePayload = useResolvedPublicRoutePayload();
  const hasFullBootstrap = Boolean(bootstrap && bootstrap.payloadMode !== "critical-home");
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
      shareImage: "",
      shareImageAlt: "",
      heroBadge: "Equipe",
      heroTitle: "ConheÃ§a quem faz o projeto acontecer",
      heroSubtitle:
        "Os perfis e redes sociais serÃ£o gerenciados pela dashboard. Este layout antecipa como a equipe aparecerÃ¡ para o pÃºblico.",
      retiredTitle: "Membros aposentados",
      retiredSubtitle: "Agradecemos por todas as contribuiÃ§Ãµes.",
      ...(bootstrap?.pages.team || {}),
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

  return (
    <PublicTeamPageContent
      isLoading={isLoading}
      linkTypes={linkTypes}
      mediaVariants={memberMediaVariants}
      members={members}
      pageCopy={pageCopy}
      siteSettings={settings}
    />
  );
};

export default Team;
