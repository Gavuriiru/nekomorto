const BULK_COMMENT_ACTIONS = new Set(["approve_all", "delete_all"]);

const normalizeCommentsArray = (comments) => (Array.isArray(comments) ? comments : []);

export const bulkModeratePendingComments = (comments, options = {}) => {
  const source = normalizeCommentsArray(comments);
  const action = String(options.action || "").trim();
  const confirmText = typeof options.confirmText === "string" ? options.confirmText : "";
  const nowIso = typeof options.nowIso === "string" && options.nowIso ? options.nowIso : new Date().toISOString();

  if (!BULK_COMMENT_ACTIONS.has(action)) {
    return { ok: false, error: "invalid_action" };
  }

  if (action === "delete_all" && confirmText !== "EXCLUIR") {
    return { ok: false, error: "confirmation_required" };
  }

  const pendingComments = source.filter((comment) => comment?.status === "pending");
  const totalPendingBefore = pendingComments.length;

  if (action === "approve_all") {
    const pendingIds = new Set(pendingComments.map((comment) => String(comment.id || "")));
    const nextComments = source.map((comment) => {
      if (!pendingIds.has(String(comment?.id || ""))) {
        return comment;
      }
      return {
        ...comment,
        status: "approved",
        approvedAt: nowIso,
      };
    });

    return {
      ok: true,
      action,
      comments: nextComments,
      processedComments: pendingComments,
      totalPendingBefore,
      processedCount: totalPendingBefore,
      remainingPending: 0,
    };
  }

  const pendingIds = new Set(pendingComments.map((comment) => String(comment.id || "")));
  const nextComments = source.filter((comment) => !pendingIds.has(String(comment?.id || "")));

  return {
    ok: true,
    action,
    comments: nextComments,
    processedComments: pendingComments,
    totalPendingBefore,
    processedCount: totalPendingBefore,
    remainingPending: 0,
  };
};

