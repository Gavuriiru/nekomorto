import { createSlug } from "@/lib/post-content";
import {
  buildProjectChapterFolder,
  buildProjectFolderSet,
} from "../../shared/project-upload-folders.js";

type ChapterFolderEpisode = {
  number?: unknown;
  volume?: unknown;
};

export const resolveProjectImageFolders = (projectId: string, projectTitle: string) => {
  return buildProjectFolderSet({
    createSlug,
    projectId,
    projectTitle,
  });
};

export const buildChapterFolder = ({
  projectChaptersFolder,
  episode,
  index,
}: {
  projectChaptersFolder: string;
  episode: ChapterFolderEpisode;
  index: number;
}) =>
  buildProjectChapterFolder({
    projectChaptersFolder,
    episode,
    index,
  });
