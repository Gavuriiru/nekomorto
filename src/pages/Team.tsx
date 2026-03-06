import { useEffect, useMemo, useState } from "react";

import PublicPageHero from "@/components/PublicPageHero";
import PublicUserProfileCard, {
  type PublicUserProfileLinkType,
  type PublicUserProfileMember,
} from "@/components/PublicUserProfileCard";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

const Team = () => {
  const apiBase = getApiBase();
  const [members, setMembers] = useState<PublicUserProfileMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cacheBust, setCacheBust] = useState(Date.now());
  const [linkTypes, setLinkTypes] = useState<PublicUserProfileLinkType[]>([]);
  const [memberMediaVariants, setMemberMediaVariants] = useState<UploadMediaVariantsMap>({});
  const bootstrap = readWindowPublicBootstrap();
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

  const getMemberImageSrc = (member: PublicUserProfileMember) => {
    const image = member.avatarUrl || "/placeholder.svg";
    return image && image !== "/placeholder.svg"
      ? image.includes("?")
        ? `${image}&v=${cacheBust}`
        : `${image}?v=${cacheBust}`
      : "/placeholder.svg";
  };

  const renderMemberCard = (member: PublicUserProfileMember, options?: { retired?: boolean }) => {
    const isRetiredCard = options?.retired ?? false;
    return (
      <PublicUserProfileCard
        key={member.id}
        member={member}
        linkTypes={linkTypes}
        mediaVariants={memberMediaVariants}
        retired={isRetiredCard}
        imageSrc={getMemberImageSrc(member)}
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
              <div className="mt-10 grid gap-8 md:gap-10">
                {activeMembers.map((member) => renderMemberCard(member))}
              </div>

              {retiredMembers.length > 0 ? (
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
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default Team;
