import {
  type Dispatch,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ProjectVolumeEntry } from "@/data/projects";
import { generateEpisodeEditorLocalId } from "@/lib/project-anime-episodes";
import { resolveNextMainEpisodeNumber } from "@/lib/project-episode-key";
import { buildVolumeCoverKey } from "@/lib/project-volume-cover-key";
import type {
  EditorProjectEpisode,
  EpisodeVolumeGroup,
  ProjectForm,
  SortedEpisodeItem,
} from "./dashboard-projects-editor-types";
import {
  buildProjectEpisodeGroupsForRender,
  buildProjectEpisodeVolumeGroups,
  resolveProjectVolumeEntryIndexByVolume,
} from "./project-editor-form";
import { getEpisodeAccordionValue } from "./useDashboardProjectsEditorAnimeBatch";

type UseProjectEditorEpisodeSectionStateOptions = {
  editorAccordionValue: string[];
  formState: ProjectForm;
  getEpisodeEntryKind: (
    episode: Partial<EditorProjectEpisode> | null | undefined,
  ) => "main" | "extra";
  isChapterBased: boolean;
  setFormState: Dispatch<SetStateAction<ProjectForm>>;
  shouldSkipEpisodeHeaderToggle: (target: Element | null | undefined) => boolean;
  supportsVolumeEntries: boolean;
};

export type UseProjectEditorEpisodeSectionStateResult = {
  addVolumeEntry: () => void;
  collapsedEpisodes: Record<number, boolean>;
  collapsedVolumeGroups: Record<string, boolean>;
  contentSectionRef: MutableRefObject<HTMLDivElement | null>;
  episodeGroupsForRender: EpisodeVolumeGroup[];
  episodeOpenValues: string[];
  handleAddEpisodeDownload: () => void;
  handleEpisodeAccordionChange: (values: string[]) => void;
  handleEpisodeHeaderClick: (index: number, event: ReactMouseEvent<HTMLDivElement>) => void;
  handleVolumeGroupAccordionChange: (values: string[]) => void;
  pendingEpisodeToScrollRef: MutableRefObject<EditorProjectEpisode | null>;
  registerEpisodeCardNode: (episode: EditorProjectEpisode, node: HTMLDivElement | null) => void;
  registerVolumeGroupNode: (groupKey: string, node: HTMLDivElement | null) => void;
  removeVolumeEntryByVolume: (volume: number | undefined) => void;
  resetPendingContentNavigation: () => void;
  revealEpisodeAtIndex: (index: number) => void;
  setCollapsedEpisodes: Dispatch<SetStateAction<Record<number, boolean>>>;
  setCollapsedVolumeGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  sortedEpisodeDownloads: SortedEpisodeItem[];
  updateVolumeEntryByVolume: (
    volume: number | undefined,
    updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry,
  ) => void;
  volumeGroupOpenValues: string[];
};

const compareEpisodeOrdering = (left: EditorProjectEpisode, right: EditorProjectEpisode) => {
  const leftReadingOrder = Number(left?.readingOrder);
  const rightReadingOrder = Number(right?.readingOrder);
  const hasLeftReadingOrder = Number.isFinite(leftReadingOrder);
  const hasRightReadingOrder = Number.isFinite(rightReadingOrder);
  if (hasLeftReadingOrder || hasRightReadingOrder) {
    if (!hasLeftReadingOrder) {
      return 1;
    }
    if (!hasRightReadingOrder) {
      return -1;
    }
    if (leftReadingOrder !== rightReadingOrder) {
      return leftReadingOrder - rightReadingOrder;
    }
  }
  const numberDelta = (left.number || 0) - (right.number || 0);
  if (numberDelta !== 0) {
    return numberDelta;
  }
  return (left.volume || 0) - (right.volume || 0);
};

export const useProjectEditorEpisodeSectionState = ({
  editorAccordionValue,
  formState,
  getEpisodeEntryKind,
  isChapterBased,
  setFormState,
  shouldSkipEpisodeHeaderToggle,
  supportsVolumeEntries,
}: UseProjectEditorEpisodeSectionStateOptions): UseProjectEditorEpisodeSectionStateResult => {
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<Record<number, boolean>>({});
  const [collapsedVolumeGroups, setCollapsedVolumeGroups] = useState<Record<string, boolean>>({});
  const pendingAddAutoScrollRef = useRef(false);
  const pendingVolumeGroupToExpandRef = useRef<string | null>(null);
  const pendingVolumeGroupToScrollRef = useRef<string | null>(null);
  const pendingContentSectionScrollRef = useRef(false);
  const pendingEpisodeToScrollRef = useRef<EditorProjectEpisode | null>(null);
  const previousEpisodeCountRef = useRef(0);
  const episodeCardNodeMapRef = useRef<WeakMap<EditorProjectEpisode, HTMLDivElement>>(
    new WeakMap(),
  );
  const volumeGroupNodeMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const contentSectionRef = useRef<HTMLDivElement | null>(null);

  const sortedEpisodeDownloads = useMemo<SortedEpisodeItem[]>(() => {
    if (!isChapterBased) {
      return formState.episodeDownloads.map((episode, index) => ({ episode, index }));
    }
    return formState.episodeDownloads
      .map((episode, index) => ({ episode, index }))
      .sort((left, right) => compareEpisodeOrdering(left.episode, right.episode));
  }, [formState.episodeDownloads, isChapterBased]);

  const addVolumeEntry = useCallback(() => {
    setFormState((previousForm) => {
      const nextVolume =
        previousForm.volumeEntries.reduce(
          (maxValue, entry) => Math.max(maxValue, Number(entry.volume) || 0),
          0,
        ) + 1;
      const nextGroupKey = buildVolumeCoverKey(nextVolume);
      pendingVolumeGroupToExpandRef.current = nextGroupKey;
      setCollapsedVolumeGroups((previousFlags) => ({
        ...previousFlags,
        [nextGroupKey]: false,
      }));
      return {
        ...previousForm,
        volumeEntries: [
          ...previousForm.volumeEntries,
          {
            volume: nextVolume,
            synopsis: "",
            coverImageUrl: "",
            coverImageAlt: "",
          },
        ],
      };
    });
  }, [setFormState]);

  const updateVolumeEntryByVolume = useCallback(
    (volume: number | undefined, updater: (entry: ProjectVolumeEntry) => ProjectVolumeEntry) => {
      if (!Number.isFinite(Number(volume))) {
        return;
      }
      const normalizedVolume = Number(volume);
      setFormState((previousForm) => {
        const nextVolumeEntries = [...previousForm.volumeEntries];
        const entryIndex = resolveProjectVolumeEntryIndexByVolume(
          nextVolumeEntries,
          normalizedVolume,
        );
        if (entryIndex >= 0) {
          nextVolumeEntries[entryIndex] = updater({
            ...nextVolumeEntries[entryIndex],
            volume: normalizedVolume,
          });
        } else {
          nextVolumeEntries.push(
            updater({
              volume: normalizedVolume,
              synopsis: "",
              coverImageUrl: "",
              coverImageAlt: "",
            }),
          );
        }
        nextVolumeEntries.sort((left, right) => left.volume - right.volume);
        return {
          ...previousForm,
          volumeEntries: nextVolumeEntries,
        };
      });
    },
    [setFormState],
  );

  const removeVolumeEntryByVolume = useCallback(
    (volume: number | undefined) => {
      if (!Number.isFinite(Number(volume))) {
        return;
      }
      const normalizedVolume = Number(volume);
      const removedKey = buildVolumeCoverKey(normalizedVolume);
      setCollapsedVolumeGroups((previousFlags) => {
        if (!Object.prototype.hasOwnProperty.call(previousFlags, removedKey)) {
          return previousFlags;
        }
        const nextFlags = { ...previousFlags };
        delete nextFlags[removedKey];
        return nextFlags;
      });
      setFormState((previousForm) => ({
        ...previousForm,
        volumeEntries: previousForm.volumeEntries.filter(
          (entry) => buildVolumeCoverKey(entry?.volume) !== buildVolumeCoverKey(normalizedVolume),
        ),
      }));
    },
    [setFormState],
  );

  const volumeGroups = useMemo(
    () =>
      buildProjectEpisodeVolumeGroups({
        isChapterBased,
        sortedEpisodeDownloads,
        supportsVolumeEntries,
        volumeEntries: formState.volumeEntries,
      }),
    [formState.volumeEntries, isChapterBased, sortedEpisodeDownloads, supportsVolumeEntries],
  );

  const episodeGroupsForRender = useMemo(
    () =>
      buildProjectEpisodeGroupsForRender({
        isChapterBased,
        sortedEpisodeDownloads,
        supportsVolumeEntries,
        volumeGroups,
      }),
    [isChapterBased, sortedEpisodeDownloads, supportsVolumeEntries, volumeGroups],
  );

  const volumeGroupOpenValues = useMemo(() => {
    if (!(isChapterBased && supportsVolumeEntries)) {
      return episodeGroupsForRender.map((group) => group.key);
    }
    return episodeGroupsForRender
      .filter((group) => collapsedVolumeGroups[group.key] === false)
      .map((group) => group.key);
  }, [collapsedVolumeGroups, episodeGroupsForRender, isChapterBased, supportsVolumeEntries]);

  const handleVolumeGroupAccordionChange = useCallback(
    (values: string[]) => {
      const openValues = new Set(values);
      setCollapsedVolumeGroups((previousFlags) => {
        const nextFlags: Record<string, boolean> = {};
        let changed = false;
        episodeGroupsForRender.forEach((group) => {
          const nextValue = !openValues.has(group.key);
          nextFlags[group.key] = nextValue;
          if ((previousFlags[group.key] ?? true) !== nextValue) {
            changed = true;
          }
        });
        if (Object.keys(previousFlags).length !== Object.keys(nextFlags).length) {
          changed = true;
        }
        return changed ? nextFlags : previousFlags;
      });
    },
    [episodeGroupsForRender],
  );

  const episodeOpenValues = useMemo(
    () =>
      sortedEpisodeDownloads
        .filter(({ index }) => !collapsedEpisodes[index])
        .map(({ index }) => getEpisodeAccordionValue(index)),
    [collapsedEpisodes, sortedEpisodeDownloads],
  );

  const handleEpisodeAccordionChange = useCallback(
    (values: string[]) => {
      const openValues = new Set(values);
      const nextCollapsed: Record<number, boolean> = {};
      sortedEpisodeDownloads.forEach(({ index }) => {
        nextCollapsed[index] = !openValues.has(getEpisodeAccordionValue(index));
      });
      setCollapsedEpisodes(nextCollapsed);
    },
    [sortedEpisodeDownloads],
  );

  const toggleEpisodeCollapsed = useCallback((index: number) => {
    setCollapsedEpisodes((previousFlags) => ({
      ...previousFlags,
      [index]: !(previousFlags[index] ?? false),
    }));
  }, []);

  const handleEpisodeHeaderClick = useCallback(
    (index: number, event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-episode-accordion-trigger]")) {
        return;
      }
      if (shouldSkipEpisodeHeaderToggle(target)) {
        return;
      }
      toggleEpisodeCollapsed(index);
    },
    [shouldSkipEpisodeHeaderToggle, toggleEpisodeCollapsed],
  );

  useEffect(() => {
    if (!isChapterBased) {
      return;
    }
    const sortedEpisodes = [...sortedEpisodeDownloads].map((item) => item.episode);
    const currentEpisodes = formState.episodeDownloads;
    const changed = sortedEpisodes.some((episode, index) => currentEpisodes[index] !== episode);
    if (!changed) {
      return;
    }
    setFormState((previousForm) => ({ ...previousForm, episodeDownloads: sortedEpisodes }));
    setCollapsedEpisodes((previousFlags) => {
      const nextFlags: Record<number, boolean> = {};
      sortedEpisodeDownloads.forEach((item, nextIndex) => {
        nextFlags[nextIndex] = previousFlags[item.index] ?? false;
      });
      return nextFlags;
    });
  }, [formState.episodeDownloads, isChapterBased, setFormState, sortedEpisodeDownloads]);

  useEffect(() => {
    if (!(isChapterBased && supportsVolumeEntries)) {
      return;
    }
    setCollapsedVolumeGroups((previousFlags) => {
      const nextFlags: Record<string, boolean> = {};
      const nextKeys = new Set<string>();
      let changed = Object.keys(previousFlags).length !== episodeGroupsForRender.length;

      episodeGroupsForRender.forEach((group) => {
        nextKeys.add(group.key);
        if (Object.prototype.hasOwnProperty.call(previousFlags, group.key)) {
          nextFlags[group.key] = previousFlags[group.key];
        } else {
          nextFlags[group.key] = true;
          changed = true;
        }
      });

      Object.keys(previousFlags).forEach((key) => {
        if (!nextKeys.has(key)) {
          changed = true;
        }
      });

      const pendingKey = pendingVolumeGroupToExpandRef.current;
      if (pendingKey && nextKeys.has(pendingKey)) {
        if (nextFlags[pendingKey] !== false) {
          nextFlags[pendingKey] = false;
          changed = true;
        }
        pendingVolumeGroupToExpandRef.current = null;
      }

      return changed ? nextFlags : previousFlags;
    });
  }, [episodeGroupsForRender, isChapterBased, supportsVolumeEntries]);

  useEffect(() => {
    const currentCount = formState.episodeDownloads.length;
    const previousCount = previousEpisodeCountRef.current;
    if (pendingAddAutoScrollRef.current && currentCount > previousCount) {
      const latestEpisode = formState.episodeDownloads.at(-1) || null;
      pendingEpisodeToScrollRef.current = latestEpisode;
      pendingAddAutoScrollRef.current = false;

      if (latestEpisode) {
        const latestEpisodeIndex = currentCount - 1;
        setCollapsedEpisodes((previousFlags) => ({
          ...previousFlags,
          [latestEpisodeIndex]: false,
        }));
      }
    }
    previousEpisodeCountRef.current = currentCount;
  }, [formState.episodeDownloads]);

  useEffect(() => {
    const pendingEpisode = pendingEpisodeToScrollRef.current;
    if (!pendingEpisode) {
      return;
    }
    const episodeCardNode = episodeCardNodeMapRef.current.get(pendingEpisode);
    if (!episodeCardNode) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const latestNode = episodeCardNodeMapRef.current.get(pendingEpisode);
      if (!latestNode) {
        return;
      }
      latestNode.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      pendingEpisodeToScrollRef.current = null;
    });

    return () => cancelAnimationFrame(frameId);
  }, [sortedEpisodeDownloads]);

  useEffect(() => {
    if (!pendingContentSectionScrollRef.current) {
      return;
    }
    if (!editorAccordionValue.includes("episodios")) {
      return;
    }

    const pendingVolumeKey = pendingVolumeGroupToScrollRef.current;
    if (pendingVolumeKey && collapsedVolumeGroups[pendingVolumeKey] !== false) {
      return;
    }

    const scrollTarget = pendingVolumeKey
      ? volumeGroupNodeMapRef.current.get(pendingVolumeKey) || contentSectionRef.current
      : contentSectionRef.current;
    if (!scrollTarget) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const latestTarget = pendingVolumeKey
        ? volumeGroupNodeMapRef.current.get(pendingVolumeKey) || contentSectionRef.current
        : contentSectionRef.current;
      if (!latestTarget) {
        return;
      }
      latestTarget.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      pendingVolumeGroupToScrollRef.current = null;
      pendingContentSectionScrollRef.current = false;
    });

    return () => cancelAnimationFrame(frameId);
  }, [collapsedVolumeGroups, editorAccordionValue, episodeGroupsForRender]);

  const revealEpisodeAtIndex = useCallback(
    (index: number) => {
      const episode = formState.episodeDownloads[index];
      if (episode) {
        pendingEpisodeToScrollRef.current = episode;
      }
      setCollapsedEpisodes((previousFlags) => ({
        ...previousFlags,
        [index]: false,
      }));
    },
    [formState.episodeDownloads],
  );

  const handleAddEpisodeDownload = useCallback(() => {
    pendingAddAutoScrollRef.current = true;
    if (isChapterBased && supportsVolumeEntries) {
      const noVolumeKey = buildVolumeCoverKey(undefined);
      pendingVolumeGroupToExpandRef.current = noVolumeKey;
      setCollapsedVolumeGroups((previousFlags) => ({
        ...previousFlags,
        [noVolumeKey]: false,
      }));
    }
    setFormState((previousForm) => {
      const nextMainNumber = resolveNextMainEpisodeNumber(previousForm.episodeDownloads, {
        isExtra: (episode) =>
          getEpisodeEntryKind(episode as Partial<EditorProjectEpisode>) === "extra",
      });
      const newEpisode: EditorProjectEpisode = {
        _editorKey: generateEpisodeEditorLocalId(),
        number: nextMainNumber,
        volume: undefined,
        title: "",
        synopsis: "",
        entryKind: "main",
        entrySubtype: "chapter",
        readingOrder: undefined,
        displayLabel: undefined,
        releaseDate: "",
        duration: "",
        coverImageUrl: "",
        coverImageAlt: "",
        sourceType: "TV",
        sources: [],
        progressStage: "aguardando-raw",
        completedStages: [],
        content: "",
        contentFormat: "lexical",
        publicationStatus: "published",
      };
      return {
        ...previousForm,
        episodeDownloads: [...previousForm.episodeDownloads, newEpisode],
      };
    });
  }, [getEpisodeEntryKind, isChapterBased, setFormState, supportsVolumeEntries]);

  const resetPendingContentNavigation = useCallback(() => {
    pendingVolumeGroupToExpandRef.current = null;
    pendingVolumeGroupToScrollRef.current = null;
    pendingContentSectionScrollRef.current = false;
    volumeGroupNodeMapRef.current.clear();
  }, []);

  const registerEpisodeCardNode = useCallback(
    (episode: EditorProjectEpisode, node: HTMLDivElement | null) => {
      if (!node) {
        return;
      }
      episodeCardNodeMapRef.current.set(episode, node);
      if (pendingEpisodeToScrollRef.current !== episode) {
        return;
      }
      requestAnimationFrame(() => {
        const latestNode = episodeCardNodeMapRef.current.get(episode);
        if (!latestNode || pendingEpisodeToScrollRef.current !== episode) {
          return;
        }
        latestNode.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
        pendingEpisodeToScrollRef.current = null;
      });
    },
    [],
  );

  const registerVolumeGroupNode = useCallback((groupKey: string, node: HTMLDivElement | null) => {
    if (node) {
      volumeGroupNodeMapRef.current.set(groupKey, node);
      return;
    }
    volumeGroupNodeMapRef.current.delete(groupKey);
  }, []);

  return {
    addVolumeEntry,
    collapsedEpisodes,
    collapsedVolumeGroups,
    contentSectionRef,
    episodeGroupsForRender,
    episodeOpenValues,
    handleAddEpisodeDownload,
    handleEpisodeAccordionChange,
    handleEpisodeHeaderClick,
    handleVolumeGroupAccordionChange,
    pendingEpisodeToScrollRef,
    registerEpisodeCardNode,
    registerVolumeGroupNode,
    removeVolumeEntryByVolume,
    resetPendingContentNavigation,
    revealEpisodeAtIndex,
    setCollapsedEpisodes,
    setCollapsedVolumeGroups,
    sortedEpisodeDownloads,
    updateVolumeEntryByVolume,
    volumeGroupOpenValues,
  };
};

export default useProjectEditorEpisodeSectionState;
