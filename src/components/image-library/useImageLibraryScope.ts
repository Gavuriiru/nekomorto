import { useMemo } from "react";

import {
  buildFolders,
  buildFoldersToRequest,
  buildProjectScopeFolders,
  buildScopedProjectRoots,
} from "@/components/image-library/groups";
import {
  parseStableFolderSignature,
  toStableFolderSignature,
  toStableProjectIdSignature,
} from "@/components/image-library/selection";
import {
  resolveContextProjectIdFromFolder,
  sanitizeUploadFolderForComparison,
} from "@/components/image-library/utils";

type UseImageLibraryScopeParams = {
  includeProjectImages: boolean;
  listAll: boolean;
  listFolders?: string[];
  projectImageProjectIds?: string[];
  uploadFolder?: string;
};

type UseImageLibraryScopeResult = {
  allowedProjectImageIdSet: Set<string>;
  foldersToRequest: string[];
  isBroadProjectLibraryContext: boolean;
  isProjectLibraryContext: boolean;
  normalizedListFolders: string[];
  resolvedContextProjectId: string;
  resolvedUploadFolderForFilter: string;
};

export const useImageLibraryScope = ({
  includeProjectImages,
  listAll,
  listFolders,
  projectImageProjectIds,
  uploadFolder,
}: UseImageLibraryScopeParams): UseImageLibraryScopeResult => {
  const resolvedUploadFolderForFilter = useMemo(
    () => sanitizeUploadFolderForComparison(uploadFolder),
    [uploadFolder],
  );
  const projectImageProjectIdsSignature = useMemo(
    () => toStableProjectIdSignature(projectImageProjectIds),
    [projectImageProjectIds],
  );
  const normalizedProjectImageProjectIds = useMemo(
    () => (projectImageProjectIdsSignature ? projectImageProjectIdsSignature.split("\u0001") : []),
    [projectImageProjectIdsSignature],
  );
  const resolvedContextProjectId = useMemo(() => {
    const preferredProjectId = String(normalizedProjectImageProjectIds[0] || "").trim();
    if (preferredProjectId) {
      return preferredProjectId;
    }
    return resolveContextProjectIdFromFolder(resolvedUploadFolderForFilter);
  }, [normalizedProjectImageProjectIds, resolvedUploadFolderForFilter]);
  const listFoldersSignature = useMemo(() => toStableFolderSignature(listFolders), [listFolders]);
  const normalizedListFolders = useMemo(
    () => parseStableFolderSignature(listFoldersSignature),
    [listFoldersSignature],
  );
  const projectScopeFolders = useMemo(
    () =>
      buildProjectScopeFolders({
        normalizedListFolders,
        resolvedUploadFolderForFilter,
      }),
    [normalizedListFolders, resolvedUploadFolderForFilter],
  );
  const includesProjectsRootInScope = useMemo(
    () => projectScopeFolders.includes("projects"),
    [projectScopeFolders],
  );
  const scopedProjectRoots = useMemo(
    () => buildScopedProjectRoots(projectScopeFolders),
    [projectScopeFolders],
  );
  const allowedProjectImageIdSet = useMemo(
    () => new Set(normalizedProjectImageProjectIds),
    [normalizedProjectImageProjectIds],
  );
  const isBroadProjectLibraryContext = useMemo(
    () => includeProjectImages && (includesProjectsRootInScope || scopedProjectRoots.length > 1),
    [includeProjectImages, includesProjectsRootInScope, scopedProjectRoots.length],
  );
  const isProjectLibraryContext = useMemo(
    () => includeProjectImages && (includesProjectsRootInScope || scopedProjectRoots.length > 0),
    [includeProjectImages, includesProjectsRootInScope, scopedProjectRoots.length],
  );
  const folders = useMemo(
    () =>
      buildFolders({
        listAll,
        normalizedListFolders,
        resolvedUploadFolderForFilter,
      }),
    [listAll, normalizedListFolders, resolvedUploadFolderForFilter],
  );
  const foldersToRequest = useMemo(() => buildFoldersToRequest(folders), [folders]);

  return {
    allowedProjectImageIdSet,
    foldersToRequest,
    isBroadProjectLibraryContext,
    isProjectLibraryContext,
    normalizedListFolders,
    resolvedContextProjectId,
    resolvedUploadFolderForFilter,
  };
};

export default useImageLibraryScope;
