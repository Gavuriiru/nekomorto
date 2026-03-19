import { describe, expect, it } from "vitest";

import { selectRecentApprovedComments } from "../../server/lib/dashboard-recent-comments.js";

describe("selectRecentApprovedComments", () => {
  it("mantem apenas aprovados, ordena por data desc e limita a 3 itens", () => {
    const comments = [
      {
        id: "pending-newer",
        status: "pending",
        createdAt: "2026-03-01T14:00:00.000Z",
      },
      {
        id: "approved-older",
        status: "approved",
        createdAt: "2026-02-28T08:00:00.000Z",
      },
      {
        id: "approved-newest",
        status: "approved",
        createdAt: "2026-03-01T13:00:00.000Z",
      },
      {
        id: "approved-middle",
        status: "approved",
        createdAt: "2026-02-28T12:00:00.000Z",
      },
      {
        id: "approved-third",
        status: "approved",
        createdAt: "2026-02-28T10:00:00.000Z",
      },
      {
        id: "pending-older",
        status: "pending",
        createdAt: "2026-02-27T09:00:00.000Z",
      },
    ];

    const result = selectRecentApprovedComments(comments);

    expect(result.map((comment) => comment.id)).toEqual([
      "approved-newest",
      "approved-middle",
      "approved-third",
    ]);
    expect(result.every((comment) => comment.status === "approved")).toBe(true);
  });
});
