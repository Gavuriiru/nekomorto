export type ApiContractCapabilities = {
  project_epub_import: boolean;
  project_epub_export: boolean;
};

export type ApiContractBuildMetadata = {
  commitSha: string | null;
  builtAt: string | null;
};

export type ApiContractV1 = {
  version: string;
  generatedAt: string;
  capabilities?: Partial<ApiContractCapabilities>;
  build?: Partial<ApiContractBuildMetadata>;
  endpoints?: Array<{
    method?: string;
    path?: string;
  }>;
};
