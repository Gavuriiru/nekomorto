import { createSlug } from "@/lib/post-content";

type ChapterFolderEpisode = {
  number?: unknown;
  volume?: unknown;
};

export const resolveProjectImageFolders = (projectId: string, projectTitle: string) => {
  const normalizedId = String(projectId || "").trim();
  const normalizedSlug = createSlug(String(projectTitle || "").trim());
  const projectKey = normalizedId || normalizedSlug || "draft";
  const projectRootFolder = `projects/${projectKey}`;
  return {
    projectRootFolder,
    projectEpisodesFolder: `${projectRootFolder}/episodes`,
    projectVolumeCoversFolder: `${projectRootFolder}/volumes`,
    projectChaptersFolder: `${projectRootFolder}/capitulos`,
  };
};

export const buildChapterFolder = ({
  projectChaptersFolder,
  episode,
  index,
}: {
  projectChaptersFolder: string;
  episode: ChapterFolderEpisode;
  index: number;
}) => {
  const parsedNumber = Number(episode?.number);
  const chapterNumber =
    Number.isFinite(parsedNumber) && parsedNumber > 0 ? Math.floor(parsedNumber) : index + 1;
  const parsedVolume = Number(episode?.volume);
  const volumeSegment =
    Number.isFinite(parsedVolume) && parsedVolume > 0
      ? `volume-${Math.floor(parsedVolume)}`
      : "volume-sem-volume";
  return `${projectChaptersFolder}/${volumeSegment}/capitulo-${chapterNumber}`;
};
