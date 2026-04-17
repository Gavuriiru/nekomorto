// Re-export from shared module so frontend imports via @/lib/anilist-media continue to work.
export {
  deriveAniListMediaOrganization,
  extractAniListStudioEntries,
} from "../../shared/anilist-media.js";
