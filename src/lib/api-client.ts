type ApiOptions = RequestInit & {
  auth?: boolean;
  json?: unknown;
};

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

export const apiFetch = (apiBase: string, path: string, options: ApiOptions = {}) => {
  const url = isAbsoluteUrl(path) ? path : `${apiBase}${path}`;
  const { auth, json, headers, ...rest } = options;
  const nextHeaders: HeadersInit = { ...(headers || {}) };
  if (json !== undefined) {
    nextHeaders["Content-Type"] = "application/json";
  }
  return fetch(url, {
    credentials: auth ? "include" : rest.credentials,
    ...rest,
    headers: nextHeaders,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
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
