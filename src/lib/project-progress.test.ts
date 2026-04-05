import { describe, expect, it } from "vitest";

import {
  getProjectProgressKindForEditor,
  getProjectProgressKindForPublicCard,
  getProjectProgressState,
  getProjectProgressStateForPublicCard,
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

  it("usa progressStage como etapa visual principal no card público", () => {
    const state = getProjectProgressStateForPublicCard(
      "Anime",
      ["aguardando-raw", "traducao"],
      "typesetting",
    );

    expect(state).not.toBeNull();
    expect(state?.currentStageId).toBe("typesetting");
    expect(state?.currentStage.label).toBe("Typesetting");
    expect(state?.visualCompletedStages).toEqual([
      "aguardando-raw",
      "traducao",
      "typesetting",
    ]);
    expect(state?.progress).toBe(43);
    expect(state?.isInProgress).toBe(true);
  });

  it("esconde o item do card público quando progressStage chega na etapa final", () => {
    const state = getProjectProgressStateForPublicCard(
      "Anime",
      [
        "aguardando-raw",
        "traducao",
        "revisao",
        "timing",
        "typesetting",
        "quality-check",
      ],
      "encode",
    );

    expect(state).not.toBeNull();
    expect(state?.currentStageId).toBe("encode");
    expect(state?.progress).toBe(100);
    expect(state?.isInProgress).toBe(false);
  });

  it("faz fallback para a primeira etapa pendente quando progressStage do card público é inválido", () => {
    const state = getProjectProgressStateForPublicCard(
      "Manga",
      ["aguardando-raw", "traducao", "limpeza"],
      "etapa-inexistente",
    );

    expect(state).not.toBeNull();
    expect(state?.currentStageId).toBe("redrawing");
    expect(state?.progress).toBe(57);
    expect(state?.isInProgress).toBe(true);
  });

  it("usa pipeline de mangá no editor dedicado e no card público de light novel", () => {
    expect(getProjectProgressKindForEditor("Light Novel")).toBe("manga");
    expect(getProjectProgressKindForPublicCard("Light Novel")).toBe("manga");
    expect(
      getProjectProgressStateForPublicCard(
        "Light Novel",
        ["aguardando-raw", "traducao"],
        "limpeza",
      ),
    ).toEqual(
      expect.objectContaining({
        currentStageId: "limpeza",
        progress: 43,
        isInProgress: true,
      }),
    );
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
