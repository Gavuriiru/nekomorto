import type { LibraryImageItem } from "@/components/image-library/types";
import {
  escapeRegexPattern,
  getUploadRootSegment,
  normalizeComparableUploadUrl,
  parseUploadUrlPath,
  sanitizeUploadFolderForComparison,
  sanitizeUploadSlotForComparison,
} from "@/components/image-library/utils";
import { toComparableSelectionKey } from "@/components/image-library/selection";

const AVATAR_UPLOAD_FILENAME_PATTERN = /^avatar-[a-z0-9-]+\.(png|jpe?g|gif|webp|svg)$/i;
const UPLOADER_TIMESTAMP_SUFFIX_PATTERN = /-\d{13}$/;

export const assignLibraryCardRef = (
  cardRefs: { current: Record<string, HTMLButtonElement | null> },
  url: string,
  node: HTMLButtonElement | null,
) => {
  const key = toComparableSelectionKey(url);
  if (!key) {
    return;
  }
  if (node) {
    cardRefs.current[key] = node;
    return;
  }
  delete cardRefs.current[key];
};

export const isLegacyGeneratedAvatarFileName = (value: string | null | undefined) => {
  const fileName = String(value || "").trim();
  if (!AVATAR_UPLOAD_FILENAME_PATTERN.test(fileName)) {
    return false;
  }
  const stem = fileName.replace(/\.[^.]+$/, "");
  return !UPLOADER_TIMESTAMP_SUFFIX_PATTERN.test(stem);
};

export const isAvatarGeneratedUsersUpload = (item: LibraryImageItem) => {
  const parsedPath = parseUploadUrlPath(item.url);
  const folder = sanitizeUploadFolderForComparison(item.folder) || parsedPath.folder;
  if (getUploadRootSegment(folder) !== "users") {
    return false;
  }
  if (typeof item.slotManaged === "boolean") {
    return item.slotManaged;
  }
  const fileName = String(item.fileName || "").trim() || parsedPath.fileName;
  return isLegacyGeneratedAvatarFileName(fileName);
};

export const isAvatarSlotSelection = ({
  url,
  folder,
  slot,
}: {
  url: string;
  folder: string;
  slot: string;
}) => {
  const normalizedUrl = normalizeComparableUploadUrl(url);
  if (!normalizedUrl.startsWith("/uploads/")) {
    return false;
  }
  const safeSlot = sanitizeUploadSlotForComparison(slot);
  if (!safeSlot) {
    return false;
  }
  const safeFolder = sanitizeUploadFolderForComparison(folder);
  const relativePrefix = safeFolder ? `${safeFolder}/` : "";
  const pattern = new RegExp(
    `^/uploads/${escapeRegexPattern(relativePrefix)}${escapeRegexPattern(safeSlot)}\\.[a-z0-9]+$`,
    "i",
  );
  return pattern.test(normalizedUrl);
};
