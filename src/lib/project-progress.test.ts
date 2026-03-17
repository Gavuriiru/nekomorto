import { describe, expect, it } from "vitest";

import {
  getProjectProgressKindForEditor,
  getProjectProgressKindForPublicCard,
  getProjectProgressState,
  syncProjectProgress,
} from "@/lib/project-progress";

describe("project-progress", () => {
  it("calcula etapa atual, percentual e normaliza etapas concluídas", () => {
    const state = getProjectProgressState({
      kind: "manga",
      completedStages: ["traducao", "aguardando-raw", "limpeza", "traducao", "invalida"],
    });

    expect(state.completedStages).toEqual(["aguardando-raw", "traducao", "limpeza"]);
    expect(state.completedCount).toBe(3);
    expect(state.progress).toBe(43);
    expect(state.currentStageId).toBe("redrawing");
    expect(state.currentStage.label).toBe("Redrawing");
  });

  it("faz fallback para aguardando raw quando não há etapas concluídas", () => {
    const state = getProjectProgressState({
      kind: "manga",
      completedStages: [],
    });

    expect(state.completedCount).toBe(0);
    expect(state.progress).toBe(0);
    expect(state.currentStageId).toBe("aguardando-raw");
  });

  it("usa pipeline de mangá no editor dedicado de light novel e oculta o card público", () => {
    expect(getProjectProgressKindForEditor("Light Novel")).toBe("manga");
    expect(getProjectProgressKindForPublicCard("Light Novel")).toBeNull();
  });

  it("sincroniza completedStages e progressStage ao persistir", () => {
    const nextChapter = syncProjectProgress(
      {
        completedStages: ["typesetting", "aguardando-raw", "traducao"],
        progressStage: "qualquer-coisa",
      },
      "manga",
    );

    expect(nextChapter.completedStages).toEqual(["aguardando-raw", "traducao", "typesetting"]);
    expect(nextChapter.progressStage).toBe("limpeza");
  });
});
