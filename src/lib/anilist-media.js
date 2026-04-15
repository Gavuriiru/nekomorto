// Re-export from shared module so frontend imports via @/lib/anilist-media continue to work.
export {
  extractAniListStudioEntries,
  deriveAniListMediaOrganization,
} from "../../shared/anilist-media.js";
