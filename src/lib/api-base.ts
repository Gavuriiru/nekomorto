const LOCAL_API_BASE = "http://127.0.0.1:8080";

export const getApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE;
  if (typeof envBase === "string" && envBase.trim()) {
    return envBase;
  }
  if (typeof window !== "undefined") {
    if (import.meta.env.PROD) {
      return window.location.origin;
    }
    const { protocol, hostname } = window.location;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:8080`;
    }
  }
  return LOCAL_API_BASE;
};
