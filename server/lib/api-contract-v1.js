export const API_CONTRACT_VERSION = "v1";

const CONTRACT_BASE = Object.freeze({
  version: API_CONTRACT_VERSION,
  compatibility: {
    backwardCompatibleWith: ["v1"],
    deprecates: [],
  },
  notes: [
    "Endpoints de escrita aceitam Idempotency-Key opcional para deduplicacao segura.",
    "Rate limit usa backend Redis quando configurado (fallback local em memoria).",
  ],
  endpoints: [
    {
      method: "GET",
      path: "/api/public/bootstrap",
      auth: "public",
      cache: "public-read",
    },
    {
      method: "GET",
      path: "/api/public/search/suggest",
      auth: "public",
      cache: "public-read",
    },
    {
      method: "GET",
      path: "/api/public/projects",
      auth: "public",
      cache: "public-read",
    },
    {
      method: "GET",
      path: "/api/public/posts",
      auth: "public",
      cache: "public-read",
    },
    {
      method: "POST",
      path: "/api/public/comments",
      auth: "public",
      idempotent: "optional_by_header",
    },
    {
      method: "POST",
      path: "/api/uploads/image",
      auth: "session",
      idempotent: "optional_by_header",
    },
    {
      method: "POST",
      path: "/api/uploads/image-from-url",
      auth: "session",
      idempotent: "optional_by_header",
    },
  ],
});

export const buildApiContractV1 = () => ({
  ...CONTRACT_BASE,
  generatedAt: new Date().toISOString(),
});
