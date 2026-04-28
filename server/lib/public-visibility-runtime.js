import { buildPublicInProgressItems } from "./public-projects.js";

export const PUBLIC_STATIC_PATHS = Object.freeze([
  "/",
  "/projetos",
  "/sobre",
  "/equipe",
  "/faq",
  "/recrutamento",
  "/doacoes",
  "/termos-de-uso",
  "/politica-de-privacidade",
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
      .filter((post) => {
        const publishTime = new Date(post.publishedAt).getTime();
        return publishTime <= now && (post.status === "published" || post.status === "scheduled");
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
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
        if (
          kind.toLowerCase().startsWith("lan") &&
          reason.toLowerCase().includes("novo link adicionado")
        ) {
          return { ...update, kind: "Ajuste" };
        }
        return update;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
