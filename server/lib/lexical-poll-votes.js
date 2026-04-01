export const updateLexicalPollVotes = (content, { question, optionUid, voterId, checked }) => {
  if (!content || typeof content !== "string") {
    return { updated: false };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { updated: false };
  }

  if (!parsed || typeof parsed !== "object") {
    return { updated: false };
  }

  const safeQuestion = typeof question === "string" ? question : null;
  const safeOptionUid = String(optionUid || "").trim();
  const safeVoterId = String(voterId || "").trim();
  if (!safeOptionUid || !safeVoterId) {
    return { updated: false };
  }

  let updated = false;

  const updateNode = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.type === "poll" && Array.isArray(node.options)) {
      if (safeQuestion && node.question !== safeQuestion) {
        // Continue searching the remaining nodes for the target poll.
      } else {
        const option = node.options.find((entry) => entry && entry.uid === safeOptionUid);
        if (option) {
          const votes = Array.isArray(option.votes)
            ? option.votes.filter((vote) => typeof vote === "string")
            : [];
          const hasVote = votes.includes(safeVoterId);
          const shouldCheck = typeof checked === "boolean" ? checked : !hasVote;
          if (shouldCheck && !hasVote) {
            votes.push(safeVoterId);
            option.votes = votes;
            updated = true;
          } else if (!shouldCheck && hasVote) {
            option.votes = votes.filter((vote) => vote !== safeVoterId);
            updated = true;
          }
          return;
        }
      }
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(updateNode);
    }
  };

  updateNode(parsed.root || parsed);

  if (!updated) {
    return { updated: false };
  }

  return { updated: true, content: JSON.stringify(parsed) };
};

export default {
  updateLexicalPollVotes,
};
