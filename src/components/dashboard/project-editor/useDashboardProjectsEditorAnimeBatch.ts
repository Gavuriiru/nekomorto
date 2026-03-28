import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildDuplicatedAnimeEpisode,
  cloneEpisodeSources,
  generateEpisodeEditorLocalId,
  getAnimeEpisodeCompletionIssues,
  getAnimeEpisodeCompletionLabel,
  matchesAnimeEpisodeQuickFilter,
  shiftIsoDateByDays,
  type AnimeEpisodeQuickFilter,
} from "@/lib/project-anime-episodes";
import { displayTimeToCanonical } from "@/lib/dashboard-date-time";
import { toast } from "@/components/ui/use-toast";

import type {
  EditorProjectEpisode,
  ProjectForm,
  SortedEpisodeItem,
} from "@/components/dashboard/project-editor/dashboard-projects-editor-types";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

export const getEpisodeAccordionValue = (index: number) => `episode-${index}`;

export const episodeHeaderNoToggleSelector = [
  "[data-no-toggle]",
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  '[role="link"]',
  '[contenteditable="true"]',
].join(", ");

export const shouldSkipEpisodeHeaderToggle = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(episodeHeaderNoToggleSelector));
};

export const shiftDraftAfterRemoval = (draft: Record<number, string>, removedIndex: number) => {
  const next: Record<number, string> = {};
  Object.entries(draft).forEach(([key, value]) => {
    const index = Number(key);
    if (!Number.isFinite(index) || index === removedIndex) {
      return;
    }
    next[index > removedIndex ? index - 1 : index] = value;
  });
  return next;
};

export const shiftCollapsedEpisodesAfterRemoval = (
  collapsed: Record<number, boolean>,
  removedIndex: number,
) => {
  const next: Record<number, boolean> = {};
  Object.entries(collapsed).forEach(([key, value]) => {
    const index = Number(key);
    if (!Number.isFinite(index) || index === removedIndex) {
      return;
    }
    next[index > removedIndex ? index - 1 : index] = Boolean(value);
  });
  return next;
};

export const moveIndexedItem = <T,>(items: T[], from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (typeof moved === "undefined") {
    return items;
  }
  next.splice(to, 0, moved);
  return next;
};

export const buildCompletionBadges = (episode: Partial<EditorProjectEpisode> | null | undefined) =>
  getAnimeEpisodeCompletionIssues(episode).map((issue) => ({
    issue,
    label: getAnimeEpisodeCompletionLabel(issue),
  }));

type RemovedAnimeEpisode = {
  episode: EditorProjectEpisode;
  index: number;
} | null;

type UseDashboardProjectsEditorAnimeBatchParams = {
  formState: ProjectForm;
  isChapterBased: boolean;
  pendingEpisodeToScrollRef: MutableRefObject<EditorProjectEpisode | null>;
  setCollapsedEpisodes: Dispatch<SetStateAction<Record<number, boolean>>>;
  setEpisodeDateDraft: Dispatch<SetStateAction<Record<number, string>>>;
  setEpisodeSizeDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  setEpisodeSizeErrors: Dispatch<SetStateAction<Record<number, string>>>;
  setEpisodeTimeDraft: Dispatch<SetStateAction<Record<number, string>>>;
  setFormState: Dispatch<SetStateAction<ProjectForm>>;
  sortedEpisodeDownloads: SortedEpisodeItem[];
};

type UseDashboardProjectsEditorAnimeBatchResult = {
  animeBatchCadenceDays: string;
  animeBatchCreateOpen: boolean;
  animeBatchDurationInput: string;
  animeBatchOperationCompletedStages: string[];
  animeBatchOperationDuration: string;
  animeBatchOperationPublicationStatus: "draft" | "published";
  animeBatchOperationShiftDays: string;
  animeBatchOperationSourceType: EditorProjectEpisode["sourceType"];
  animeBatchPublicationStatus: "draft" | "published";
  animeBatchQuantity: string;
  animeBatchSourceType: EditorProjectEpisode["sourceType"];
  animeBatchStartNumber: string;
  animeEpisodeFilter: AnimeEpisodeQuickFilter;
  applyAnimeBatchCompletedStages: () => void;
  applyAnimeBatchDuration: () => void;
  applyAnimeBatchPublicationStatus: () => void;
  applyAnimeBatchReplicateSources: () => void;
  applyAnimeBatchShiftReleaseDates: () => void;
  applyAnimeBatchSourceType: () => void;
  clearSelectedAnimeEpisodes: () => void;
  clearRemovedAnimeEpisode: () => void;
  createAnimeEpisodeBatch: () => void;
  duplicateAnimeEpisode: (episode: EditorProjectEpisode) => void;
  filteredAnimeEpisodeItems: SortedEpisodeItem[];
  removedAnimeEpisode: RemovedAnimeEpisode;
  selectAllFilteredAnimeEpisodes: () => void;
  selectedAnimeEpisodeKeys: string[];
  selectedAnimeEpisodeKeySet: Set<string>;
  setAnimeBatchCadenceDays: Dispatch<SetStateAction<string>>;
  setAnimeBatchCreateOpen: Dispatch<SetStateAction<boolean>>;
  setAnimeBatchDurationInput: Dispatch<SetStateAction<string>>;
  setAnimeBatchOperationCompletedStages: Dispatch<SetStateAction<string[]>>;
  setAnimeBatchOperationDuration: Dispatch<SetStateAction<string>>;
  setAnimeBatchOperationPublicationStatus: Dispatch<SetStateAction<"draft" | "published">>;
  setAnimeBatchOperationShiftDays: Dispatch<SetStateAction<string>>;
  setAnimeBatchOperationSourceType: Dispatch<
    SetStateAction<EditorProjectEpisode["sourceType"]>
  >;
  setAnimeBatchPublicationStatus: Dispatch<SetStateAction<"draft" | "published">>;
  setAnimeBatchQuantity: Dispatch<SetStateAction<string>>;
  setAnimeBatchSourceType: Dispatch<SetStateAction<EditorProjectEpisode["sourceType"]>>;
  setAnimeBatchStartNumber: Dispatch<SetStateAction<string>>;
  setAnimeEpisodeFilter: Dispatch<SetStateAction<AnimeEpisodeQuickFilter>>;
  toggleSelectedAnimeEpisode: (episodeKey: string) => void;
  undoRemoveAnimeEpisode: () => void;
};

export function useDashboardProjectsEditorAnimeBatch({
  formState,
  isChapterBased,
  pendingEpisodeToScrollRef,
  setCollapsedEpisodes,
  setEpisodeDateDraft,
  setEpisodeSizeDrafts,
  setEpisodeSizeErrors,
  setEpisodeTimeDraft,
  setFormState,
  sortedEpisodeDownloads,
}: UseDashboardProjectsEditorAnimeBatchParams): UseDashboardProjectsEditorAnimeBatchResult {
  const [selectedAnimeEpisodeKeys, setSelectedAnimeEpisodeKeys] = useState<string[]>([]);
  const [removedAnimeEpisode, setRemovedAnimeEpisode] = useState<RemovedAnimeEpisode>(null);
  const [animeEpisodeFilter, setAnimeEpisodeFilter] =
    useState<AnimeEpisodeQuickFilter>("all");
  const [animeBatchCreateOpen, setAnimeBatchCreateOpen] = useState(false);
  const [animeBatchStartNumber, setAnimeBatchStartNumber] = useState("");
  const [animeBatchQuantity, setAnimeBatchQuantity] = useState("3");
  const [animeBatchCadenceDays, setAnimeBatchCadenceDays] = useState("");
  const [animeBatchDurationInput, setAnimeBatchDurationInput] = useState("");
  const [animeBatchSourceType, setAnimeBatchSourceType] =
    useState<EditorProjectEpisode["sourceType"]>("TV");
  const [animeBatchPublicationStatus, setAnimeBatchPublicationStatus] = useState<
    "draft" | "published"
  >("draft");
  const [animeBatchOperationDuration, setAnimeBatchOperationDuration] = useState("");
  const [animeBatchOperationSourceType, setAnimeBatchOperationSourceType] =
    useState<EditorProjectEpisode["sourceType"]>("TV");
  const [animeBatchOperationPublicationStatus, setAnimeBatchOperationPublicationStatus] = useState<
    "draft" | "published"
  >("draft");
  const [animeBatchOperationShiftDays, setAnimeBatchOperationShiftDays] = useState("");
  const [animeBatchOperationCompletedStages, setAnimeBatchOperationCompletedStages] = useState<
    string[]
  >([]);

  const filteredAnimeEpisodeItems = useMemo(
    () =>
      isChapterBased
        ? []
        : sortedEpisodeDownloads.filter(({ episode }) =>
            matchesAnimeEpisodeQuickFilter(episode, animeEpisodeFilter),
          ),
    [animeEpisodeFilter, isChapterBased, sortedEpisodeDownloads],
  );

  const selectedAnimeEpisodeKeySet = useMemo(
    () => new Set(selectedAnimeEpisodeKeys),
    [selectedAnimeEpisodeKeys],
  );

  useEffect(() => {
    if (isChapterBased) {
      setSelectedAnimeEpisodeKeys([]);
      setRemovedAnimeEpisode(null);
      return;
    }
    const availableKeys = new Set(
      formState.episodeDownloads.map((episode) => String(episode._editorKey || "")),
    );
    setSelectedAnimeEpisodeKeys((current) => current.filter((key) => availableKeys.has(key)));
  }, [formState.episodeDownloads, isChapterBased]);

  const toggleSelectedAnimeEpisode = useCallback((episodeKey: string) => {
    if (!episodeKey) {
      return;
    }
    setSelectedAnimeEpisodeKeys((current) =>
      current.includes(episodeKey)
        ? current.filter((item) => item !== episodeKey)
        : [...current, episodeKey],
    );
  }, []);

  const selectAllFilteredAnimeEpisodes = useCallback(() => {
    setSelectedAnimeEpisodeKeys(
      filteredAnimeEpisodeItems
        .map(({ episode }) => String(episode._editorKey || ""))
        .filter(Boolean),
    );
  }, [filteredAnimeEpisodeItems]);

  const clearSelectedAnimeEpisodes = useCallback(() => {
    setSelectedAnimeEpisodeKeys([]);
  }, []);

  const clearRemovedAnimeEpisode = useCallback(() => {
    setRemovedAnimeEpisode(null);
  }, []);

  const applyAnimeBatchUpdate = useCallback(
    (updater: (episode: EditorProjectEpisode) => EditorProjectEpisode) => {
      if (!selectedAnimeEpisodeKeys.length) {
        return;
      }
      const selectedSet = new Set(selectedAnimeEpisodeKeys);
      setFormState((prev) => ({
        ...prev,
        episodeDownloads: prev.episodeDownloads.map((episode) =>
          selectedSet.has(String(episode._editorKey || "")) ? updater(episode) : episode,
        ),
      }));
    },
    [selectedAnimeEpisodeKeys, setFormState],
  );

  const removeAnimeEpisodeAtIndex = useCallback(
    (index: number) => {
      setFormState((prev) => {
        const removed = prev.episodeDownloads[index];
        if (!removed) {
          return prev;
        }
        const nextEpisodes = prev.episodeDownloads.filter((_, idx) => idx !== index);
        setRemovedAnimeEpisode({
          episode: {
            ...removed,
            _editorKey: removed._editorKey || generateEpisodeEditorLocalId(),
          },
          index,
        });
        setSelectedAnimeEpisodeKeys((current) =>
          current.filter((key) => key !== String(removed._editorKey || "")),
        );
        return {
          ...prev,
          episodeDownloads: nextEpisodes,
        };
      });
      setEpisodeDateDraft((prev) => shiftDraftAfterRemoval(prev, index));
      setEpisodeTimeDraft((prev) => shiftDraftAfterRemoval(prev, index));
      setEpisodeSizeDrafts((prev) => shiftDraftAfterRemoval(prev, index));
      setEpisodeSizeErrors((prev) => shiftDraftAfterRemoval(prev, index));
      setCollapsedEpisodes((prev) => shiftCollapsedEpisodesAfterRemoval(prev, index));
    },
    [setCollapsedEpisodes, setEpisodeDateDraft, setEpisodeSizeDrafts, setEpisodeSizeErrors, setEpisodeTimeDraft, setFormState],
  );

  const undoRemoveAnimeEpisode = useCallback(() => {
    if (!removedAnimeEpisode) {
      return;
    }
    const { episode, index } = removedAnimeEpisode;
    pendingEpisodeToScrollRef.current = episode;
    setFormState((prev) => {
      const nextEpisodes = [...prev.episodeDownloads];
      nextEpisodes.splice(Math.min(index, nextEpisodes.length), 0, episode);
      return {
        ...prev,
        episodeDownloads: nextEpisodes,
      };
    });
    setCollapsedEpisodes((prev) => ({
      ...prev,
      [index]: false,
    }));
    setRemovedAnimeEpisode(null);
  }, [pendingEpisodeToScrollRef, removedAnimeEpisode, setCollapsedEpisodes, setFormState]);

  const duplicateAnimeEpisode = useCallback(
    (episode: EditorProjectEpisode) => {
      const duplicatedEpisode = buildDuplicatedAnimeEpisode(episode, formState.episodeDownloads);
      pendingEpisodeToScrollRef.current = duplicatedEpisode;
      setFormState((prev) => ({
        ...prev,
        episodeDownloads: [...prev.episodeDownloads, duplicatedEpisode],
      }));
      setCollapsedEpisodes((prev) => ({
        ...prev,
        [formState.episodeDownloads.length]: false,
      }));
    },
    [formState.episodeDownloads.length, formState.episodeDownloads, pendingEpisodeToScrollRef, setCollapsedEpisodes, setFormState],
  );

  const createAnimeEpisodeBatch = useCallback(() => {
    const startNumber = Math.max(1, Number(animeBatchStartNumber) || 0);
    const quantity = Math.max(1, Number(animeBatchQuantity) || 0);
    if (!startNumber || !quantity) {
      toast({
        title: "Parametros invalidos",
        description: "Informe episodio inicial e quantidade validos.",
        variant: "destructive",
      });
      return;
    }
    const durationValue = displayTimeToCanonical(animeBatchDurationInput);
    const cadenceDays = Math.max(0, Number(animeBatchCadenceDays) || 0);
    const existingNumbers = new Set(
      formState.episodeDownloads.map((episode) => Number(episode.number)),
    );
    const duplicatedNumbers = Array.from(
      { length: quantity },
      (_, index) => startNumber + index,
    ).filter((value) => existingNumbers.has(value));
    if (duplicatedNumbers.length > 0) {
      toast({
        title: "Faixa ocupada",
        description: "A faixa escolhida conflita com episodios ja existentes.",
        variant: "destructive",
      });
      return;
    }
    const latestDatedEpisode = [...sortedEpisodeDownloads]
      .map(({ episode }) => episode)
      .reverse()
      .find((episode) => String(episode.releaseDate || "").trim());
    const initialDate = latestDatedEpisode?.releaseDate || "";
    const createdEpisodes = Array.from({ length: quantity }, (_, index) => {
      const episodeNumber = startNumber + index;
      const releaseDate =
        cadenceDays > 0 && initialDate
          ? shiftIsoDateByDays(initialDate, cadenceDays * (index + 1))
          : "";
      return {
        _editorKey: generateEpisodeEditorLocalId(),
        number: episodeNumber,
        title: "",
        synopsis: "",
        releaseDate,
        duration: durationValue,
        sourceType: animeBatchSourceType,
        sources: [],
        progressStage: "aguardando-raw",
        completedStages: [],
        content: "",
        contentFormat: "lexical" as const,
        publicationStatus: animeBatchPublicationStatus,
        coverImageUrl: "",
        coverImageAlt: "",
      } satisfies EditorProjectEpisode;
    });
    const lastCreatedEpisode = createdEpisodes[createdEpisodes.length - 1] || null;
    if (lastCreatedEpisode) {
      pendingEpisodeToScrollRef.current = lastCreatedEpisode;
    }
    setFormState((prev) => ({
      ...prev,
      episodeDownloads: [...prev.episodeDownloads, ...createdEpisodes],
    }));
    setCollapsedEpisodes((prev) => {
      const next = { ...prev };
      createdEpisodes.forEach((_, offset) => {
        next[formState.episodeDownloads.length + offset] = false;
      });
      return next;
    });
    setAnimeBatchCreateOpen(false);
    setAnimeBatchQuantity("3");
    setAnimeBatchCadenceDays("");
    setAnimeBatchDurationInput("");
    setAnimeBatchPublicationStatus("draft");
    setAnimeBatchSourceType("TV");
    toast({
      title: "Episodios criados",
      description: `${createdEpisodes.length} episodio(s) adicionados ao formulario.`,
      intent: "success",
    });
  }, [
    animeBatchCadenceDays,
    animeBatchDurationInput,
    animeBatchPublicationStatus,
    animeBatchQuantity,
    animeBatchSourceType,
    animeBatchStartNumber,
    formState.episodeDownloads,
    pendingEpisodeToScrollRef,
    setAnimeBatchCreateOpen,
    setAnimeBatchCadenceDays,
    setAnimeBatchDurationInput,
    setAnimeBatchPublicationStatus,
    setAnimeBatchQuantity,
    setAnimeBatchSourceType,
    setCollapsedEpisodes,
    setFormState,
    sortedEpisodeDownloads,
  ]);

  const applyAnimeBatchDuration = useCallback(() => {
    const canonicalDuration = displayTimeToCanonical(animeBatchOperationDuration);
    if (!canonicalDuration) {
      toast({
        title: "Duracao invalida",
        description: "Use MM:SS ou H:MM:SS para aplicar a duracao em lote.",
        variant: "destructive",
      });
      return;
    }
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      duration: canonicalDuration,
    }));
  }, [animeBatchOperationDuration, applyAnimeBatchUpdate]);

  const applyAnimeBatchSourceType = useCallback(() => {
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      sourceType: animeBatchOperationSourceType,
    }));
  }, [animeBatchOperationSourceType, applyAnimeBatchUpdate]);

  const applyAnimeBatchPublicationStatus = useCallback(() => {
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      publicationStatus: animeBatchOperationPublicationStatus,
    }));
  }, [animeBatchOperationPublicationStatus, applyAnimeBatchUpdate]);

  const applyAnimeBatchCompletedStages = useCallback(() => {
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      completedStages: [...animeBatchOperationCompletedStages],
    }));
  }, [animeBatchOperationCompletedStages, applyAnimeBatchUpdate]);

  const applyAnimeBatchShiftReleaseDates = useCallback(() => {
    const dayOffset = Number(animeBatchOperationShiftDays);
    if (!Number.isFinite(dayOffset) || dayOffset === 0) {
      toast({
        title: "Deslocamento invalido",
        description: "Informe um numero inteiro de dias para deslocar as datas.",
        variant: "destructive",
      });
      return;
    }
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      releaseDate: shiftIsoDateByDays(episode.releaseDate, dayOffset),
    }));
  }, [animeBatchOperationShiftDays, applyAnimeBatchUpdate]);

  const applyAnimeBatchReplicateSources = useCallback(() => {
    const sourceEpisode =
      sortedEpisodeDownloads.find(({ episode }) =>
        selectedAnimeEpisodeKeySet.has(String(episode._editorKey || "")),
      )?.episode || null;
    if (!sourceEpisode) {
      return;
    }
    const nextSources = cloneEpisodeSources(sourceEpisode.sources);
    applyAnimeBatchUpdate((episode) => ({
      ...episode,
      sources: cloneEpisodeSources(nextSources),
    }));
  }, [applyAnimeBatchUpdate, selectedAnimeEpisodeKeySet, sortedEpisodeDownloads]);

  return {
    animeBatchCadenceDays,
    animeBatchCreateOpen,
    animeBatchDurationInput,
    animeBatchOperationCompletedStages,
    animeBatchOperationDuration,
    animeBatchOperationPublicationStatus,
    animeBatchOperationShiftDays,
    animeBatchOperationSourceType,
    animeBatchPublicationStatus,
    animeBatchQuantity,
    animeBatchSourceType,
    animeBatchStartNumber,
    animeEpisodeFilter,
    applyAnimeBatchCompletedStages,
    applyAnimeBatchDuration,
    applyAnimeBatchPublicationStatus,
    applyAnimeBatchReplicateSources,
    applyAnimeBatchShiftReleaseDates,
    applyAnimeBatchSourceType,
    clearSelectedAnimeEpisodes,
    clearRemovedAnimeEpisode,
    createAnimeEpisodeBatch,
    duplicateAnimeEpisode,
    filteredAnimeEpisodeItems,
    removedAnimeEpisode,
    selectAllFilteredAnimeEpisodes,
    selectedAnimeEpisodeKeys,
    selectedAnimeEpisodeKeySet,
    setAnimeBatchCadenceDays,
    setAnimeBatchCreateOpen,
    setAnimeBatchDurationInput,
    setAnimeBatchOperationCompletedStages,
    setAnimeBatchOperationDuration,
    setAnimeBatchOperationPublicationStatus,
    setAnimeBatchOperationShiftDays,
    setAnimeBatchOperationSourceType,
    setAnimeBatchPublicationStatus,
    setAnimeBatchQuantity,
    setAnimeBatchSourceType,
    setAnimeBatchStartNumber,
    setAnimeEpisodeFilter,
    toggleSelectedAnimeEpisode,
    undoRemoveAnimeEpisode,
  };
}
