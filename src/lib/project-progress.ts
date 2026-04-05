import { isChapterBasedType } from "@/lib/project-utils";

export type ProjectProgressKind = "anime" | "manga";

export type ProjectProgressStage = {
  id: string;
  label: string;
  badgeClassName?: string;
  indicatorClassName?: string;
};

export type ProjectProgressState = {
  stages: readonly ProjectProgressStage[];
  completedStages: string[];
  completedCount: number;
  progress: number;
  currentStageId: string;
  currentStage: ProjectProgressStage;
};

export type ProjectPublicCardProgressState = {
  stages: readonly ProjectProgressStage[];
  completedStages: string[];
  visualCompletedStages: string[];
  completedCount: number;
  progress: number;
  currentStageId: string;
  currentStage: ProjectProgressStage;
  isInProgress: boolean;
};

export const ANIME_PROGRESS_STAGES = [
  {
    id: "aguardando-raw",
    label: "Aguardando Raw",
    indicatorClassName: "bg-slate-500",
    badgeClassName: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
  {
    id: "traducao",
    label: "Tradução",
    indicatorClassName: "bg-blue-500",
    badgeClassName: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    id: "revisao",
    label: "Revisão",
    indicatorClassName: "bg-yellow-500",
    badgeClassName: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  {
    id: "timing",
    label: "Timing",
    indicatorClassName: "bg-pink-500",
    badgeClassName: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  },
  {
    id: "typesetting",
    label: "Typesetting",
    indicatorClassName: "bg-indigo-500",
    badgeClassName: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  },
  {
    id: "quality-check",
    label: "Quality Check",
    indicatorClassName: "bg-orange-500",
    badgeClassName: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  {
    id: "encode",
    label: "Encode",
    indicatorClassName: "bg-purple-500",
    badgeClassName: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
] as const satisfies readonly ProjectProgressStage[];

export const MANGA_PROGRESS_STAGES = [
  {
    id: "aguardando-raw",
    label: "Aguardando Raw",
    indicatorClassName: "bg-slate-500",
    badgeClassName: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
  {
    id: "traducao",
    label: "Tradução",
    indicatorClassName: "bg-blue-500",
    badgeClassName: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    id: "limpeza",
    label: "Limpeza",
    indicatorClassName: "bg-emerald-500",
    badgeClassName: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    id: "redrawing",
    label: "Redrawing",
    indicatorClassName: "bg-cyan-500",
    badgeClassName: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  },
  {
    id: "revisao",
    label: "Revisão",
    indicatorClassName: "bg-yellow-500",
    badgeClassName: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  {
    id: "typesetting",
    label: "Typesetting",
    indicatorClassName: "bg-indigo-500",
    badgeClassName: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  },
  {
    id: "quality-check",
    label: "Quality Check",
    indicatorClassName: "bg-orange-500",
    badgeClassName: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
] as const satisfies readonly ProjectProgressStage[];

const PROJECT_PROGRESS_STAGES: Record<ProjectProgressKind, readonly ProjectProgressStage[]> = {
  anime: ANIME_PROGRESS_STAGES,
  manga: MANGA_PROGRESS_STAGES,
};

const DEFAULT_STAGE_ID = "aguardando-raw";

const normalizeStageId = (value: unknown) => String(value || "").trim();

export const getProjectProgressStages = (kind: ProjectProgressKind) => PROJECT_PROGRESS_STAGES[kind];

export const getProjectProgressKindForEditor = (projectType: string): ProjectProgressKind =>
  isChapterBasedType(projectType) ? "manga" : "anime";

export const getProjectProgressStagesForEditor = (projectType: string) =>
  getProjectProgressStages(getProjectProgressKindForEditor(projectType));

export const getProjectProgressKindForPublicCard = (
  projectType: string,
): ProjectProgressKind => (isChapterBasedType(projectType) ? "manga" : "anime");

export const normalizeCompletedStages = (
  completedStages: string[] | null | undefined,
  kind: ProjectProgressKind,
) => {
  const stages = getProjectProgressStages(kind);
  const completedSet = new Set(
    (Array.isArray(completedStages) ? completedStages : [])
      .map((stageId) => normalizeStageId(stageId))
      .filter(Boolean),
  );
  return stages.filter((stage) => completedSet.has(stage.id)).map((stage) => stage.id);
};

export const getProjectProgressState = ({
  kind,
  completedStages,
}: {
  kind: ProjectProgressKind;
  completedStages?: string[] | null;
}): ProjectProgressState => {
  const stages = getProjectProgressStages(kind);
  const normalizedCompletedStages = normalizeCompletedStages(completedStages, kind);
  const completedSet = new Set(normalizedCompletedStages);
  const currentStage =
    stages.find((stage) => !completedSet.has(stage.id)) ??
    stages[stages.length - 1] ?? {
      id: DEFAULT_STAGE_ID,
      label: "Aguardando Raw",
    };
  const completedCount = stages.filter((stage) => completedSet.has(stage.id)).length;
  const progress = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  return {
    stages,
    completedStages: normalizedCompletedStages,
    completedCount,
    progress,
    currentStageId: currentStage.id,
    currentStage,
  };
};

export const getProjectProgressStateForEditor = (
  projectType: string,
  completedStages?: string[] | null,
) =>
  getProjectProgressState({
    kind: getProjectProgressKindForEditor(projectType),
    completedStages,
  });

export const getProjectProgressStateForPublicCard = (
  projectType: string,
  completedStages?: string[] | null,
  progressStage?: string | null,
): ProjectPublicCardProgressState | null => {
  const kind = getProjectProgressKindForPublicCard(projectType);
  const stages = getProjectProgressStages(kind);
  const normalizedCompletedStages = normalizeCompletedStages(completedStages, kind);
  const completedSet = new Set(normalizedCompletedStages);
  const normalizedProgressStage = normalizeStageId(progressStage);
  const currentStage =
    stages.find((stage) => stage.id === normalizedProgressStage) ??
    stages.find((stage) => !completedSet.has(stage.id)) ??
    stages[stages.length - 1] ?? {
      id: DEFAULT_STAGE_ID,
      label: "Aguardando Raw",
    };
  const visualCompletedSet = new Set(normalizedCompletedStages);
  if (stages.some((stage) => stage.id === currentStage.id)) {
    visualCompletedSet.add(currentStage.id);
  }
  const visualCompletedStages = stages
    .filter((stage) => visualCompletedSet.has(stage.id))
    .map((stage) => stage.id);
  const completedCount = visualCompletedStages.length;
  const progress = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;
  const finalStageId = stages[stages.length - 1]?.id || DEFAULT_STAGE_ID;

  return {
    stages,
    completedStages: normalizedCompletedStages,
    visualCompletedStages,
    completedCount,
    progress,
    currentStageId: currentStage.id,
    currentStage,
    isInProgress: !visualCompletedSet.has(finalStageId),
  };
};

export const syncProjectProgress = <T extends { completedStages?: string[]; progressStage?: string }>(
  value: T,
  kind: ProjectProgressKind,
): T => {
  const state = getProjectProgressState({
    kind,
    completedStages: value.completedStages,
  });
  return {
    ...value,
    completedStages: state.completedStages,
    progressStage: state.currentStageId,
  };
};
