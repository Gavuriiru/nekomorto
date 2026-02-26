import { describe, expect, it } from "vitest";

import { bulkModeratePendingComments } from "../../server/lib/comments-bulk-moderation.js";

const baseComments = [
  {
    id: "c1",
    targetType: "post",
    targetId: "post-1",
    name: "Visitante 1",
    content: "Pendente 1",
    status: "pending",
    createdAt: "2026-02-26T10:00:00.000Z",
    approvedAt: null,
  },
  {
    id: "c2",
    targetType: "post",
    targetId: "post-1",
    name: "Visitante 2",
    content: "Aprovado",
    status: "approved",
    createdAt: "2026-02-26T10:01:00.000Z",
    approvedAt: "2026-02-26T10:02:00.000Z",
  },
  {
    id: "c3",
    targetType: "project",
    targetId: "project-1",
    name: "Visitante 3",
    content: "Pendente 2",
    status: "pending",
    createdAt: "2026-02-26T10:03:00.000Z",
    approvedAt: null,
  },
];

describe("comments bulk moderation helper", () => {
  it("approve_all aprova apenas pendentes e preserva aprovados", () => {
    const result = bulkModeratePendingComments(baseComments, {
      action: "approve_all",
      nowIso: "2026-02-26T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe("approve_all");
    expect(result.totalPendingBefore).toBe(2);
    expect(result.processedCount).toBe(2);
    expect(result.remainingPending).toBe(0);
    expect(result.comments).toHaveLength(3);
    expect(result.comments.filter((comment) => comment.status === "pending")).toHaveLength(0);
    expect(result.comments.find((comment) => comment.id === "c1")?.approvedAt).toBe("2026-02-26T12:00:00.000Z");
    expect(result.comments.find((comment) => comment.id === "c2")?.approvedAt).toBe("2026-02-26T10:02:00.000Z");
  });

  it("delete_all remove apenas pendentes e exige confirmação", () => {
    const denied = bulkModeratePendingComments(baseComments, {
      action: "delete_all",
      confirmText: "ERRADO",
    });
    expect(denied).toEqual({ ok: false, error: "confirmation_required" });

    const result = bulkModeratePendingComments(baseComments, {
      action: "delete_all",
      confirmText: "EXCLUIR",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe("delete_all");
    expect(result.totalPendingBefore).toBe(2);
    expect(result.processedCount).toBe(2);
    expect(result.remainingPending).toBe(0);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.id).toBe("c2");
  });

  it("retorna erro para action inválida e sucesso com 0 quando não há pendentes", () => {
    expect(bulkModeratePendingComments(baseComments, { action: "unknown" })).toEqual({
      ok: false,
      error: "invalid_action",
    });

    const noPending = bulkModeratePendingComments(
      baseComments.map((comment) => ({ ...comment, status: "approved", approvedAt: comment.approvedAt || "x" })),
      { action: "approve_all", nowIso: "2026-02-26T12:00:00.000Z" },
    );
    expect(noPending.ok).toBe(true);
    if (!noPending.ok) return;
    expect(noPending.processedCount).toBe(0);
    expect(noPending.totalPendingBefore).toBe(0);
    expect(noPending.remainingPending).toBe(0);
  });
});

