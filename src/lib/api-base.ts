const LOCAL_API_BASE = "http://127.0.0.1:8080";

export const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE;
  if (typeof envBase === "string" && envBase.trim()) {
    return envBase;
  }
  if (import.meta.env.PROD && typeof window !== "undefined") {
    return window.location.origin;
  }
  return LOCAL_API_BASE;
};
