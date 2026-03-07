import { resolveTeamAvatarPreload } from "./public-media-variants.js";

export const TEAM_AVATAR_PRELOAD_IMAGE_SIZES =
  "(max-width: 639px) 224px, (max-width: 767px) 240px, 256px";

export const resolveFirstPublicTeamMember = (teamMembers) => {
  const members = Array.isArray(teamMembers) ? teamMembers : [];
  if (members.length === 0) {
    return null;
  }
  return (
    members.find((member) => {
      const normalizedStatus = String(member?.status || "").trim().toLowerCase();
      return normalizedStatus !== "retired" && normalizedStatus !== "aposentado";
    }) || members[0]
  );
};

export const resolvePublicTeamAvatarPreload = ({
  teamMembers,
  mediaVariants,
  resolveVariantUrl,
  imagesizes = TEAM_AVATAR_PRELOAD_IMAGE_SIZES,
} = {}) => {
  const prioritizedMember = resolveFirstPublicTeamMember(teamMembers);
  if (!prioritizedMember?.avatarUrl) {
    return null;
  }
  return resolveTeamAvatarPreload({
    avatarUrl: prioritizedMember.avatarUrl,
    mediaVariants,
    resolveVariantUrl,
    imagesizes,
  });
};
