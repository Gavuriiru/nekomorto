import { useEffect, useMemo, useState } from "react";

import PublicPageHero from "@/components/PublicPageHero";
import PublicUserProfileCard from "@/components/PublicUserProfileCard";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import {
  normalizeUploadVariantUrlKey,
  type UploadMediaVariantsMap,
} from "@/lib/upload-variants";
import type { PublicTeamLinkType, PublicTeamMember } from "@/types/public-team";

const TEAM_AVATAR_IMAGE_SIZES = "(max-width: 639px) 224px, (max-width: 767px) 240px, 256px";

const Team = () => {
  const apiBase = getApiBase();
  const bootstrap = readWindowPublicBootstrap();
  const hasFullBootstrap = Boolean(bootstrap && bootstrap.payloadMode !== "critical-home");
  const bootstrapHasTeamSnapshot =
    typeof window !== "undefined" &&
    (() => {
      const rawBootstrap = (
        window as Window & {
          __BOOTSTRAP_PUBLIC__?: { teamMembers?: unknown; teamLinkTypes?: unknown };
        }
      ).__BOOTSTRAP_PUBLIC__;
      return Boolean(
        rawBootstrap &&
          typeof rawBootstrap === "object" &&
          (Array.isArray(rawBootstrap.teamMembers) || Array.isArray(rawBootstrap.teamLinkTypes)),
      );
    })();
  const hasTeamBootstrapSnapshot = hasFullBootstrap && bootstrapHasTeamSnapshot;
  const bootstrapMembers = hasTeamBootstrapSnapshot ? bootstrap?.teamMembers || [] : [];
  const bootstrapLinkTypes = hasTeamBootstrapSnapshot ? bootstrap?.teamLinkTypes || [] : [];
  const bootstrapMediaVariants = hasTeamBootstrapSnapshot ? bootstrap?.mediaVariants || {} : {};
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
      heroTitle: "Conheça quem faz o projeto acontecer",
      heroSubtitle:
        "Os perfis e redes sociais serão gerenciados pela dashboard. Este layout antecipa como a equipe aparecerá para o público.",
      retiredTitle: "Membros aposentados",
      retiredSubtitle: "Agradecemos por todas as contribuições.",
      ...(bootstrap?.pages.team || {}),
    }),
    [bootstrap],
  );
  const pageMediaVariants = bootstrap?.mediaVariants || {};

  usePageMeta({
    title: "Equipe",
    image: pageCopy.shareImage || undefined,
    imageAlt: pageCopy.shareImageAlt || undefined,
    mediaVariants: pageMediaVariants,
  });

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
              data?.mediaVariants && typeof data.mediaVariants === "object" ? data.mediaVariants : {},
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

  const getMemberImageSrc = (member: PublicTeamMember) => {
    const image = String(member.avatarUrl || "").trim();
    if (!image || image === "/placeholder.svg") {
      return "/placeholder.svg";
    }
    const variantKey = normalizeUploadVariantUrlKey(image);
    const variantsVersion = Number(memberMediaVariants?.[variantKey]?.variantsVersion);
    if (!Number.isFinite(variantsVersion) || variantsVersion <= 0) {
      return image;
    }
    const normalizedVersion = Math.floor(variantsVersion);
    return image.includes("?") ? `${image}&v=${normalizedVersion}` : `${image}?v=${normalizedVersion}`;
  };

  const prioritizedMemberId = activeMembers[0]?.id || retiredMembers[0]?.id || "";

  const renderMemberCard = (
    member: PublicTeamMember,
    options?: { retired?: boolean; prioritizeImage?: boolean },
  ) => {
    const isRetiredCard = options?.retired ?? false;
    const shouldPrioritizeImage = options?.prioritizeImage ?? false;
    return (
      <PublicUserProfileCard
        key={member.id}
        member={member}
        linkTypes={linkTypes}
        mediaVariants={memberMediaVariants}
        retired={isRetiredCard}
        imageSrc={getMemberImageSrc(member)}
        imageLoading={shouldPrioritizeImage ? "eager" : "lazy"}
        imageFetchPriority={shouldPrioritizeImage ? "high" : "auto"}
        imageSizes={TEAM_AVATAR_IMAGE_SIZES}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <PublicPageHero
          badge={pageCopy.heroBadge}
          title={pageCopy.heroTitle}
          subtitle={pageCopy.heroSubtitle}
        />

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
              {activeMembers.length > 0 ? (
                <section className="mt-10" aria-labelledby="team-active-members-heading">
                  <h2 id="team-active-members-heading" className="sr-only">
                    Membros ativos
                  </h2>
                  <div className="grid gap-8 md:gap-10">
                    {activeMembers.map((member) =>
                      renderMemberCard(member, {
                        prioritizeImage: member.id === prioritizedMemberId,
                      }),
                    )}
                  </div>
                </section>
              ) : null}

              {retiredMembers.length > 0 ? (
                <section className="mt-16 space-y-6" aria-labelledby="team-retired-members-heading">
                  <div>
                    <h2
                      id="team-retired-members-heading"
                      className="text-lg font-semibold text-foreground"
                    >
                      {pageCopy.retiredTitle}
                    </h2>
                    <p className="text-sm text-muted-foreground">{pageCopy.retiredSubtitle}</p>
                  </div>
                  <div className="mt-8 grid gap-8 md:gap-10">
                    {retiredMembers.map((member) =>
                      renderMemberCard(member, {
                        retired: true,
                        prioritizeImage: member.id === prioritizedMemberId,
                      }),
                    )}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default Team;
