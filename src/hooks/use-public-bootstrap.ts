import { useQuery } from "@tanstack/react-query";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import {
  emptyPublicBootstrapPayload,
  type PublicBootstrapPayload,
} from "@/types/public-bootstrap";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";

export const PUBLIC_BOOTSTRAP_QUERY_KEY = ["public-bootstrap"] as const;

const fetchPublicBootstrap = async (apiBase: string): Promise<PublicBootstrapPayload> => {
  const response = await apiFetch(apiBase, "/api/public/bootstrap");
  if (!response.ok) {
    throw new Error(`public_bootstrap_${response.status}`);
  }
  const data = (await response.json()) as Partial<PublicBootstrapPayload>;
  return {
    ...emptyPublicBootstrapPayload,
    ...data,
    settings: data?.settings || emptyPublicBootstrapPayload.settings,
    projects: Array.isArray(data?.projects) ? data.projects : [],
    posts: Array.isArray(data?.posts) ? data.posts : [],
    updates: Array.isArray(data?.updates) ? data.updates : [],
    mediaVariants:
      data?.mediaVariants && typeof data.mediaVariants === "object"
        ? (data.mediaVariants as UploadMediaVariantsMap)
        : {},
    tagTranslations: {
      tags: data?.tagTranslations?.tags || {},
      genres: data?.tagTranslations?.genres || {},
      staffRoles: data?.tagTranslations?.staffRoles || {},
    },
    generatedAt: String(data?.generatedAt || ""),
  };
};

export const usePublicBootstrap = () => {
  const apiBase = getApiBase();
  return useQuery({
    queryKey: PUBLIC_BOOTSTRAP_QUERY_KEY,
    queryFn: () => fetchPublicBootstrap(apiBase),
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  });
};
