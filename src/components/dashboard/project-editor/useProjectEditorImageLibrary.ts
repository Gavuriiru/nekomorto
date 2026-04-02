import type {
  ImageLibraryOptions,
  ImageLibrarySavePayload,
} from "@/components/ImageLibraryDialog";
import type { ProjectEpisode, ProjectVolumeEntry } from "@/data/projects";
import {
  buildProjectAssetLibraryOptions,
  buildProjectEpisodeAssetLibraryOptions,
  buildProjectVolumeAssetLibraryOptions,
  resolveProjectAssetAltText,
  resolveProjectEpisodeAssetAltText,
  resolveProjectVolumeAssetAltText,
} from "@/lib/dashboard-image-library";
import { resolveProjectImageFolders } from "@/lib/project-image-folders";
import { isChapterBasedType } from "@/lib/project-utils";
import { resolveProjectVolumeEntryIndexByVolume } from "./project-editor-form";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type ProjectImageLibraryTarget =
  | "cover"
  | "banner"
  | "hero"
  | "episode-cover"
  | "volume-cover";

type ProjectEditorLibraryEpisode = Pick<
  ProjectEpisode,
  "number" | "volume" | "coverImageUrl" | "coverImageAlt"
> &
  Partial<ProjectEpisode>;

type ProjectEditorLibraryForm<
  TEpisode extends ProjectEditorLibraryEpisode = ProjectEditorLibraryEpisode,
  TVolumeEntry extends ProjectVolumeEntry = ProjectVolumeEntry,
> = {
  id: string;
  title: string;
  type: string;
  cover: string;
  coverAlt: string;
  banner: string;
  bannerAlt: string;
  heroImageUrl?: string;
  heroImageAlt: string;
  episodeDownloads: TEpisode[];
  volumeEntries: TVolumeEntry[];
};

type UseProjectEditorImageLibraryParams<
  TForm extends ProjectEditorLibraryForm = ProjectEditorLibraryForm,
> = {
  canManageProjects: boolean;
  formState: TForm;
  setFormState: Dispatch<SetStateAction<TForm>>;
};

type UseProjectEditorImageLibraryResult<
  TForm extends ProjectEditorLibraryForm = ProjectEditorLibraryForm,
> = {
  activeLibraryOptions: ImageLibraryOptions;
  buildEpisodeLibraryOptions: (
    episode: TForm["episodeDownloads"][number],
    index: number,
  ) => ImageLibraryOptions;
  currentLibrarySelection: string;
  handleLibrarySave: (payload: ImageLibrarySavePayload) => void;
  isLibraryOpen: boolean;
  openLibraryForEpisodeCover: (index: number) => void;
  openLibraryForProjectImage: (target: "cover" | "banner" | "hero") => void;
  openLibraryForVolumeCover: (volume?: number) => void;
  setIsLibraryOpen: Dispatch<SetStateAction<boolean>>;
};

export function useProjectEditorImageLibrary<
  TForm extends ProjectEditorLibraryForm = ProjectEditorLibraryForm,
>({
  canManageProjects,
  formState,
  setFormState,
}: UseProjectEditorImageLibraryParams<TForm>): UseProjectEditorImageLibraryResult<TForm> {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<ProjectImageLibraryTarget>("cover");
  const [episodeCoverIndex, setEpisodeCoverIndex] = useState<number | null>(null);
  const [volumeCoverTargetVolume, setVolumeCoverTargetVolume] = useState<number | null>(null);

  const projectImageFolders = useMemo(
    () => resolveProjectImageFolders(formState.id, formState.title),
    [formState.id, formState.title],
  );

  const projectAssetLibraryOptions = useMemo(
    () =>
      buildProjectAssetLibraryOptions({
        projectFolders: projectImageFolders,
        projectId: formState.id,
        canManageProjects,
      }),
    [canManageProjects, formState.id, projectImageFolders],
  );

  const buildEpisodeLibraryOptions = useCallback(
    (episode: TForm["episodeDownloads"][number], index: number): ImageLibraryOptions =>
      buildProjectEpisodeAssetLibraryOptions({
        projectFolders: projectImageFolders,
        projectId: formState.id,
        canManageProjects,
        isChapterBased: isChapterBasedType(formState.type || ""),
        episode,
        index,
      }),
    [canManageProjects, formState.id, formState.type, projectImageFolders],
  );

  const episodeAssetLibraryOptions = useMemo(() => {
    if (episodeCoverIndex !== null && formState.episodeDownloads[episodeCoverIndex]) {
      return buildEpisodeLibraryOptions(
        formState.episodeDownloads[episodeCoverIndex],
        episodeCoverIndex,
      );
    }
    return buildProjectEpisodeAssetLibraryOptions({
      projectFolders: projectImageFolders,
      projectId: formState.id,
      canManageProjects,
    });
  }, [
    buildEpisodeLibraryOptions,
    canManageProjects,
    episodeCoverIndex,
    formState.episodeDownloads,
    formState.id,
    projectImageFolders,
  ]);

  const volumeCoverAssetLibraryOptions = useMemo(
    () =>
      buildProjectVolumeAssetLibraryOptions({
        projectFolders: projectImageFolders,
        projectId: formState.id,
        canManageProjects,
      }),
    [canManageProjects, formState.id, projectImageFolders],
  );

  const activeLibraryOptions = useMemo(() => {
    if (libraryTarget === "episode-cover") {
      return episodeAssetLibraryOptions;
    }
    if (libraryTarget === "volume-cover") {
      return volumeCoverAssetLibraryOptions;
    }
    return projectAssetLibraryOptions;
  }, [
    episodeAssetLibraryOptions,
    libraryTarget,
    projectAssetLibraryOptions,
    volumeCoverAssetLibraryOptions,
  ]);

  const applyLibraryImage = useCallback(
    (url: string, altText?: string) => {
      const nextUrl = String(url || "").trim();
      setFormState((prev) => {
        const next = { ...prev };
        if (libraryTarget === "cover") {
          next.cover = nextUrl;
          next.coverAlt = nextUrl ? resolveProjectAssetAltText("cover", altText) : "";
        } else if (libraryTarget === "banner") {
          next.banner = nextUrl;
          next.bannerAlt = nextUrl ? resolveProjectAssetAltText("banner", altText) : "";
        } else if (libraryTarget === "hero") {
          next.heroImageUrl = nextUrl;
          next.heroImageAlt = nextUrl ? resolveProjectAssetAltText("hero", altText) : "";
        } else if (libraryTarget === "episode-cover") {
          if (episodeCoverIndex === null) {
            return prev;
          }
          const nextEpisodes = [...prev.episodeDownloads];
          if (!nextEpisodes[episodeCoverIndex]) {
            return prev;
          }
          nextEpisodes[episodeCoverIndex] = {
            ...nextEpisodes[episodeCoverIndex],
            coverImageUrl: nextUrl,
            coverImageAlt: nextUrl
              ? resolveProjectEpisodeAssetAltText({
                  altText,
                  isChapterBased: isChapterBasedType(prev.type || ""),
                })
              : "",
          };
          return { ...prev, episodeDownloads: nextEpisodes };
        } else if (libraryTarget === "volume-cover") {
          if (volumeCoverTargetVolume === null) {
            return prev;
          }
          const nextVolumeEntries = [...prev.volumeEntries];
          const targetIndex = resolveProjectVolumeEntryIndexByVolume(
            nextVolumeEntries as TForm["volumeEntries"],
            volumeCoverTargetVolume,
          );
          if (targetIndex < 0) {
            nextVolumeEntries.push({
              volume: volumeCoverTargetVolume,
              synopsis: "",
              coverImageUrl: "",
              coverImageAlt: "",
            } as TForm["volumeEntries"][number]);
          }
          const resolvedIndex = resolveProjectVolumeEntryIndexByVolume(
            nextVolumeEntries as TForm["volumeEntries"],
            volumeCoverTargetVolume,
          );
          if (resolvedIndex < 0) {
            return prev;
          }
          const targetEntry = nextVolumeEntries[resolvedIndex];
          nextVolumeEntries[resolvedIndex] = {
            ...targetEntry,
            coverImageUrl: nextUrl,
            coverImageAlt: nextUrl
              ? resolveProjectVolumeAssetAltText(targetEntry.volume, altText)
              : "",
          };
          nextVolumeEntries.sort((left, right) => left.volume - right.volume);
          return {
            ...prev,
            volumeEntries: nextVolumeEntries as TForm["volumeEntries"],
          };
        }
        return next;
      });
    },
    [
      episodeCoverIndex,
      libraryTarget,
      setFormState,
      volumeCoverTargetVolume,
    ],
  );

  const openLibraryForProjectImage = useCallback((target: "cover" | "banner" | "hero") => {
    setLibraryTarget(target);
    setIsLibraryOpen(true);
  }, []);

  const openLibraryForEpisodeCover = useCallback((index: number) => {
    setEpisodeCoverIndex(index);
    setLibraryTarget("episode-cover");
    setIsLibraryOpen(true);
  }, []);

  const openLibraryForVolumeCover = useCallback((volume?: number) => {
    if (!Number.isFinite(Number(volume))) {
      return;
    }
    setVolumeCoverTargetVolume(Number(volume));
    setLibraryTarget("volume-cover");
    setIsLibraryOpen(true);
  }, []);

  useEffect(() => {
    if (!isLibraryOpen) {
      setLibraryTarget("cover");
      setEpisodeCoverIndex(null);
      setVolumeCoverTargetVolume(null);
    }
  }, [isLibraryOpen]);

  const currentLibrarySelection = useMemo(() => {
    if (libraryTarget === "cover") {
      return formState.cover || "";
    }
    if (libraryTarget === "banner") {
      return formState.banner || "";
    }
    if (libraryTarget === "hero") {
      return formState.heroImageUrl || "";
    }
    if (libraryTarget === "episode-cover" && episodeCoverIndex !== null) {
      return formState.episodeDownloads[episodeCoverIndex]?.coverImageUrl || "";
    }
    if (libraryTarget === "volume-cover" && volumeCoverTargetVolume !== null) {
      const resolvedIndex = resolveProjectVolumeEntryIndexByVolume(
        formState.volumeEntries,
        volumeCoverTargetVolume,
      );
      return resolvedIndex >= 0 ? formState.volumeEntries[resolvedIndex]?.coverImageUrl || "" : "";
    }
    return "";
  }, [
    episodeCoverIndex,
    formState.banner,
    formState.cover,
    formState.episodeDownloads,
    formState.heroImageUrl,
    formState.volumeEntries,
    libraryTarget,
    volumeCoverTargetVolume,
  ]);

  const handleLibrarySave = useCallback(
    ({ urls, items }: ImageLibrarySavePayload) => {
      applyLibraryImage(urls[0] || "", items[0]?.altText);
    },
    [applyLibraryImage],
  );

  return {
    activeLibraryOptions,
    buildEpisodeLibraryOptions,
    currentLibrarySelection,
    handleLibrarySave,
    isLibraryOpen,
    openLibraryForEpisodeCover,
    openLibraryForProjectImage,
    openLibraryForVolumeCover,
    setIsLibraryOpen,
  };
}
