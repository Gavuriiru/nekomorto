import { describe, expect, it } from "vitest";

import { buildCommentTargetInfo } from "../../server/lib/comment-target-info.js";

describe("buildCommentTargetInfo", () => {
  it("gera link de comentario para capitulo com origem explicita", () => {
    const result = buildCommentTargetInfo(
      {
        id: "comment-42",
        targetType: "chapter",
        targetId: "project-7",
        targetMeta: {
          chapterNumber: 12,
          volume: 3,
        },
      },
      [],
      [
        {
          id: "project-7",
          title: "Nekomata",
        },
      ],
      "https://dev.nekomata.moe",
    );

    expect(result).toEqual({
      label: "Nekomata \u2022 Cap\u00edtulo 12",
      url: "https://dev.nekomata.moe/projeto/project-7/leitura/12?volume=3#comment-comment-42",
    });
  });

  it("faz fallback seguro quando o alvo nao existe", () => {
    const result = buildCommentTargetInfo(
      {
        id: "comment-9",
        targetType: "project",
        targetId: "missing-project",
      },
      [],
      [],
      "https://dev.nekomata.moe",
    );

    expect(result).toEqual({
      label: "Projeto",
      url: "https://dev.nekomata.moe",
    });
  });
});
