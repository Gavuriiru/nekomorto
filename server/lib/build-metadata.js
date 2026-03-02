const getFirstNonEmptyEnv = (...keys) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) {
      return value;
    }
  }
  return null;
};

const resolveCommitShaFromImageTag = () => {
  const imageTag = String(process.env.APP_IMAGE_TAG || "").trim();
  if (!imageTag) {
    return null;
  }
  const shaMatch = imageTag.match(/^sha-([0-9a-f]{7,40})$/i);
  return shaMatch?.[1] || null;
};

export const getBuildMetadata = () => ({
  commitSha:
    getFirstNonEmptyEnv("APP_COMMIT_SHA", "COMMIT_SHA", "GIT_COMMIT_SHA", "GITHUB_SHA") ||
    resolveCommitShaFromImageTag(),
  builtAt: getFirstNonEmptyEnv(
    "APP_BUILD_TIME",
    "BUILD_TIME",
    "BUILT_AT",
    "BUILD_TIMESTAMP",
    "GITHUB_BUILD_TIME",
  ),
});
