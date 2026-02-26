import { apiFetch } from "@/lib/api-client";
import type {
  ContentVersionListResponse,
  EditorialCalendarResponse,
  RollbackResult,
} from "@/types/editorial";

type RollbackPostResponse<TPost = unknown> = {
  ok: boolean;
  post: TPost;
  rollback: RollbackResult;
};

type CreateContentVersionResponse = {
  ok: boolean;
  version: unknown;
};

const readJsonOrThrow = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`api_error_${response.status}`);
  }
  return (await response.json()) as T;
};

export const fetchPostVersions = async (
  apiBase: string,
  postId: string,
  params?: { limit?: number; cursor?: string | null },
) => {
  const search = new URLSearchParams();
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.cursor) {
    search.set("cursor", String(params.cursor));
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch(apiBase, `/api/admin/content/post/${encodeURIComponent(postId)}/versions${suffix}`, {
    auth: true,
  });
  return readJsonOrThrow<ContentVersionListResponse>(response);
};

export const createPostVersion = async (
  apiBase: string,
  postId: string,
  payload?: { label?: string },
) => {
  const response = await apiFetch(apiBase, `/api/admin/content/post/${encodeURIComponent(postId)}/version`, {
    method: "POST",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  return readJsonOrThrow<CreateContentVersionResponse>(response);
};

export const rollbackPostVersion = async <TPost = unknown>(
  apiBase: string,
  postId: string,
  versionId: string,
) => {
  const response = await apiFetch(apiBase, `/api/admin/content/post/${encodeURIComponent(postId)}/rollback`, {
    method: "POST",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionId }),
  });
  return readJsonOrThrow<RollbackPostResponse<TPost>>(response);
};

export const fetchEditorialCalendar = async (
  apiBase: string,
  params: { from: string; to: string; tz?: string },
) => {
  const search = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.tz) {
    search.set("tz", params.tz);
  }
  const response = await apiFetch(apiBase, `/api/admin/editorial/calendar?${search.toString()}`, {
    auth: true,
  });
  return readJsonOrThrow<EditorialCalendarResponse>(response);
};

