import { buildPublicInProgressItems } from "./public-projects.js";

export const PUBLIC_STATIC_PATHS = Object.freeze([
  "/",
  "/projetos",
  "/sobre",
  "/equipe",
  "/faq",
  "/recrutamento",
  "/doacoes",
]);

const REQUIRED_DEPENDENCY_KEYS = [
  "buildPublicReadableProjects",
  "buildPublicVisibleProjects",
  "isEpisodePublic",
  "loadPosts",
  "loadProjects",
  "loadUpdates",
  "normalizePosts",
  "normalizeProjects",
  "resolveEpisodeLookup",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[public-visibility-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createPublicVisibilityRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    buildPublicReadableProjects,
    buildPublicVisibleProjects,
    isEpisodePublic,
    loadPosts,
    loadProjects,
    loadUpdates,
    normalizePosts,
    normalizeProjects,
    resolveEpisodeLookup,
  } = dependencies;

  const getPublicReadableProjects = () =>
    buildPublicReadableProjects(normalizeProjects(loadProjects()));

  const getPublicVisibleProjects = () =>
    buildPublicVisibleProjects(normalizeProjects(loadProjects()));

  const getPublicInProgressItems = () =>
    buildPublicInProgressItems(normalizeProjects(loadProjects()));

  const getPublicVisiblePosts = () => {
    const now = Date.now();
    return normalizePosts(loadPosts())
      .filter((post) => !post.deletedAt)
      .map((post) => ({ post, publishTs: new Date(post.publishedAt).getTime() }))
      .filter(({ post, publishTs }) => {
        return publishTs <= now && (post.status === "published" || post.status === "scheduled");
      })
      // ⚡ Bolt: Precomputing timestamp during map iteration instead of
      // parsing date string repeatedly inside the O(N log N) sort comparator.
      .sort((a, b) => b.publishTs - a.publishTs)
      .map(({ post }) => post);
  };

  const getPublicVisibleUpdates = () => {
    const rawProjects = normalizeProjects(loadProjects()).filter((project) => !project.deletedAt);
    const projectMap = new Map(rawProjects.map((project) => [String(project.id), project]));
    return loadUpdates()
      .filter((update) => {
        const projectId = String(update?.projectId || "").trim();
        if (!projectId) {
          return false;
        }
        const project = projectMap.get(projectId);
        if (!project) {
          return false;
        }
        const lookup = resolveEpisodeLookup(project, update?.episodeNumber, update?.volume, {
          requirePublished: true,
        });
        if (!lookup.ok) {
          return false;
        }
        return isEpisodePublic(project.type || "", lookup.episode);
      })
      .map((update) => {
        const reason = String(update?.reason || "");
        const kind = String(update?.kind || "");
        let adjustedUpdate = update;
        if (
          kind.toLowerCase().startsWith("lan") &&
          reason.toLowerCase().includes("novo link adicionado")
        ) {
          adjustedUpdate = { ...update, kind: "Ajuste" };
        }
        return {
          update: adjustedUpdate,
          updateTs: new Date(adjustedUpdate.updatedAt).getTime(),
        };
      })
      // ⚡ Bolt: Precomputing timestamp during map iteration instead of
      // parsing date string repeatedly inside the O(N log N) sort comparator.
      .sort((a, b) => b.updateTs - a.updateTs)
      .map(({ update }) => update);
  };

  return {
    getPublicInProgressItems,
    getPublicReadableProjects,
    getPublicVisiblePosts,
    getPublicVisibleProjects,
    getPublicVisibleUpdates,
  };
};

export default createPublicVisibilityRuntime;
