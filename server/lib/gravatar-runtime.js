const REQUIRED_DEPENDENCY_KEYS = ["crypto"];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(`[gravatar-runtime] missing required dependencies: ${missing.sort().join(", ")}`);
};

export const createGravatarRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    crypto,
    fetch: fetchFn = globalThis.fetch?.bind(globalThis),
    gravatarApiKey = process.env.GRAVATAR_API_KEY,
  } = dependencies;

  const normalizeEmail = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const createGravatarHash = (email) =>
    crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");

  const buildGravatarUrl = (hash, size = 96) =>
    `https://gravatar.com/avatar/${hash}?d=identicon&s=${size}`;

  const resolveGravatarAvatarUrl = async (hash) => {
    if (!gravatarApiKey || typeof fetchFn !== "function") {
      return buildGravatarUrl(hash);
    }
    try {
      const response = await fetchFn(`https://api.gravatar.com/v3/profiles/${hash}`, {
        headers: {
          Authorization: `Bearer ${gravatarApiKey}`,
        },
      });
      if (!response?.ok) {
        return buildGravatarUrl(hash);
      }
      const data = await response.json();
      if (data?.avatar_url) {
        return String(data.avatar_url);
      }
    } catch {
      // ignore
    }
    return buildGravatarUrl(hash);
  };

  return {
    buildGravatarUrl,
    createGravatarHash,
    normalizeEmail,
    resolveGravatarAvatarUrl,
  };
};

export default createGravatarRuntime;
