import type { UploadFocalCrops, UploadFocalPoints } from "@/lib/upload-focal-points";

export type LibraryImageSource = "upload" | "project";

export type LibraryImageItem = {
  id?: string | null;
  name: string;
  url: string;
  source: LibraryImageSource;
  label?: string;
  folder?: string;
  fileName?: string;
  mime?: string;
  size?: number;
  createdAt?: string;
  width?: number | null;
  height?: number | null;
  inUse?: boolean;
  canDelete?: boolean;
  projectId?: string;
  projectTitle?: string;
  kind?: string;
  hashSha256?: string;
  focalCrops?: UploadFocalCrops;
  focalPoints?: UploadFocalPoints;
  focalPoint?: { x: number; y: number };
  variantsVersion?: number;
  variants?: Record<string, unknown>;
  variantBytes?: number;
  area?: string;
  altText?: string;
  slot?: string;
  slotManaged?: boolean;
};

export type ImageLibrarySavePayload = {
  urls: string[];
  items: LibraryImageItem[];
};

export type ImageLibraryOptions = {
  uploadFolder?: string;
  listFolders?: string[];
  listAll?: boolean;
  includeProjectImages?: boolean;
  projectImageProjectIds?: string[];
  projectImagesView?: "flat" | "by-project";
  currentSelectionUrls?: string[];
  scopeUserId?: string;
  onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
};

export type ImageLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  title?: string;
  description?: string;
  uploadFolder?: string;
  listFolders?: string[];
  listAll?: boolean;
  includeProjectImages?: boolean;
  projectImageProjectIds?: string[];
  mode?: "single" | "multiple";
  allowDeselect?: boolean;
  showUrlImport?: boolean;
  currentSelectionUrls?: string[];
  currentSelectionUrl?: string;
  projectImagesView?: "flat" | "by-project";
  cropAvatar?: boolean;
  cropTargetFolder?: string;
  cropSlot?: string;
  scopeUserId?: string;
  allowUploadManagementActions?: boolean;
  onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
  onSave: (payload: ImageLibrarySavePayload) => void;
};

export type ProjectImageFolderGroup = {
  key: string;
  folder: string;
  title: string;
  items: LibraryImageItem[];
};

export type ProjectImageGroup = {
  key: string;
  projectId: string;
  title: string;
  items: LibraryImageItem[];
  folders: ProjectImageFolderGroup[];
};

export type UploadFolderGroup = {
  key: string;
  folder: string;
  title: string;
  items: LibraryImageItem[];
  folders: ProjectImageFolderGroup[];
};
