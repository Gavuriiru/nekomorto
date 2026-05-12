import crypto from "node:crypto";

const normalizeBuildField = (value) => String(value || "").trim();

const hashIndexHtml = (value) => {
  const normalized = String(value || "");
  if (!normalized) {
    return "";
  }
  return crypto.createHash("sha1").update(normalized).digest("hex");
};

export const buildPublicPrerenderBuildFingerprint = ({
  apiContractVersion = "",
  buildMetadata,
  indexHtml = "",
} = {}) => {
  const normalizedApiContractVersion = normalizeBuildField(apiContractVersion);
  const normalizedCommitSha = normalizeBuildField(buildMetadata?.commitSha);
  const normalizedBuiltAt = normalizeBuildField(buildMetadata?.builtAt);
  const indexHtmlHash = hashIndexHtml(indexHtml);

  return (
    [
      normalizedApiContractVersion,
      normalizedCommitSha,
      normalizedBuiltAt,
      indexHtmlHash ? `index:${indexHtmlHash}` : "",
    ]
      .filter(Boolean)
      .join("::") || "api"
  );
};

export default buildPublicPrerenderBuildFingerprint;
