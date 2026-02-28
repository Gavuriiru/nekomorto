type ApiOptions = RequestInit & {
  auth?: boolean;
  json?: unknown;
};

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const isPublicApiPath = (path: string) => {
  if (typeof path !== "string" || !path) {
    return false;
  }
  if (path.startsWith("/api/public/")) {
    return true;
  }
  if (!isAbsoluteUrl(path)) {
    return false;
  }
  try {
    return new URL(path).pathname.startsWith("/api/public/");
  } catch {
    return false;
  }
};

export const apiFetch = (apiBase: string, path: string, options: ApiOptions = {}) => {
  const url = isAbsoluteUrl(path) ? path : `${apiBase}${path}`;
  const { auth, json, headers, ...rest } = options;
  const nextHeaders: HeadersInit = { ...(headers || {}) };
  if (json !== undefined) {
    nextHeaders["Content-Type"] = "application/json";
  }
  const requestInit: RequestInit = {
    credentials: auth ? "include" : rest.credentials,
    ...rest,
    headers: nextHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  };
  if (requestInit.cache === undefined && isPublicApiPath(path)) {
    requestInit.cache = "no-store";
  }
  return fetch(url, requestInit);
};

export const apiJson = async <T = unknown>(
  apiBase: string,
  path: string,
  options: ApiOptions = {},
): Promise<T> => {
  const response = await apiFetch(apiBase, path, options);
  if (!response.ok) {
    throw new Error(`api_error_${response.status}`);
  }
  return (await response.json()) as T;
};
