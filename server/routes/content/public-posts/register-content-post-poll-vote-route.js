import { resolveClientIp } from "./shared.js";

export const registerContentPostPollVoteRoute = ({
  app,
  canRegisterPollVote,
  loadPosts,
  normalizePosts,
  updateLexicalPollVotes,
  writePosts,
} = {}) => {
  app.post("/api/public/posts/:slug/polls/vote", async (req, res) => {
    const ip = resolveClientIp(req);
    if (!(await canRegisterPollVote(ip))) {
      return res.status(429).json({ error: "rate_limited" });
    }
    const slug = String(req.params.slug || "");
    const { optionUid, voterId, checked, question } = req.body || {};
    if (!optionUid || !voterId) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const posts = normalizePosts(loadPosts());
    const index = posts.findIndex((post) => post.slug === slug);
    if (index === -1) {
      return res.status(404).json({ error: "not_found" });
    }
    const post = posts[index];
    const result = updateLexicalPollVotes(post.content, {
      question,
      optionUid,
      voterId,
      checked,
    });
    if (!result.updated || !result.content) {
      return res.status(404).json({ error: "poll_not_found" });
    }
    posts[index] = {
      ...post,
      content: result.content,
    };
    writePosts(posts);
    return res.json({ ok: true });
  });
};

export default registerContentPostPollVoteRoute;
