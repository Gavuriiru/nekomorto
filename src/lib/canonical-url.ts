export const getCanonicalPageUrl = (input?: string | URL | Location | null): string => {
  if (!input) {
    return "";
  }
  try {
    const url =
      typeof input === "string"
        ? new URL(input)
        : input instanceof URL
          ? new URL(input.toString())
          : new URL(String(input.href || ""));
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
};

