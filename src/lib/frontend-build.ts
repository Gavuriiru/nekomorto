import type { ApiContractBuildMetadata } from "@/types/api-contract";

const normalizeBuildField = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

export const getFrontendBuildMetadata = (): ApiContractBuildMetadata => ({
  commitSha: normalizeBuildField(import.meta.env.VITE_APP_COMMIT_SHA),
  builtAt: normalizeBuildField(import.meta.env.VITE_APP_BUILD_TIME),
});

export const formatBuildMetadataLabel = (build: ApiContractBuildMetadata | null) => {
  if (!build?.commitSha && !build?.builtAt) {
    return "";
  }
  const parts: string[] = [];
  if (build?.commitSha) {
    parts.push(`commit ${build.commitSha.slice(0, 12)}`);
  }
  if (build?.builtAt) {
    parts.push(`build ${build.builtAt}`);
  }
  return parts.join(" | ");
};
