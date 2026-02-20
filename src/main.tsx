import { createRoot } from "react-dom/client";
import App, { queryClient } from "./App.tsx";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { PUBLIC_BOOTSTRAP_QUERY_KEY } from "@/hooks/use-public-bootstrap";
import type { PublicBootstrapPayload } from "@/types/public-bootstrap";
import "./index.css";

const titleForPath = (path: string) => {
  const rules: Array<[RegExp, string]> = [
    [/^\/$/, "Início"],
    [/^\/postagem\/.+/, "Postagem"],
    [/^\/equipe\/?$/, "Equipe"],
    [/^\/sobre\/?$/, "Sobre"],
    [/^\/doacoes\/?$/, "Doações"],
    [/^\/faq\/?$/, "FAQ"],
    [/^\/projetos\/?$/, "Projetos"],
    [/^\/projeto\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projeto\/.+/, "Projeto"],
    [/^\/projetos\/.+\/leitura\/.+/, "Leitura"],
    [/^\/projetos\/.+/, "Projeto"],
    [/^\/recrutamento\/?$/, "Recrutamento"],
    [/^\/login\/?$/, "Login"],
    [/^\/dashboard\/usuarios\/?$/, "Usuários"],
    [/^\/dashboard\/posts\/?$/, "Posts"],
    [/^\/dashboard\/projetos\/?$/, "Projetos"],
    [/^\/dashboard\/comentarios\/?$/, "Comentários"],
    [/^\/dashboard\/audit-log\/?$/, "Audit Log"],
    [/^\/dashboard\/paginas\/?$/, "Páginas"],
    [/^\/dashboard\/configuracoes\/?$/, "Configurações"],
    [/^\/dashboard\/?$/, "Dashboard"],
  ];
  const match = rules.find(([regex]) => regex.test(path));
  return match?.[1] || "";
};

const setBootstrapTitle = (siteName: string, separator: string) => {
  const path = window.location.pathname || "/";
  const pageTitle = titleForPath(path);
  document.title = pageTitle ? `${pageTitle}${separator}${siteName}` : siteName;
};

const asBootstrapPayload = (value: unknown): PublicBootstrapPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<PublicBootstrapPayload>;
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.posts)) {
    return null;
  }
  return candidate as PublicBootstrapPayload;
};

const bootstrap = async () => {
  const apiBase = getApiBase();
  const globalWindow = window as Window & {
    __BOOTSTRAP_SETTINGS__?: unknown;
    __BOOTSTRAP_PUBLIC__?: unknown;
  };
  let initialSettings: unknown = globalWindow.__BOOTSTRAP_SETTINGS__;
  let initialBootstrap = asBootstrapPayload(globalWindow.__BOOTSTRAP_PUBLIC__);

  try {
    if (!initialBootstrap) {
      const response = await apiFetch(apiBase, "/api/public/bootstrap");
      if (response.ok) {
        initialBootstrap = asBootstrapPayload(await response.json());
      }
    }
    if (initialBootstrap) {
      queryClient.setQueryData(PUBLIC_BOOTSTRAP_QUERY_KEY, initialBootstrap);
      initialSettings = initialBootstrap.settings || initialSettings;
    } else if (!initialSettings) {
      const response = await apiFetch(apiBase, "/api/public/settings");
      if (response.ok) {
        const data = await response.json();
        initialSettings = data.settings || {};
      }
    }
  } catch {
    initialBootstrap = null;
    initialSettings = initialSettings || undefined;
  }

  const settings = (initialSettings as { site?: { name?: string; titleSeparator?: string } }) || {};
  const siteName =
    (settings.site?.name || "").trim() || (document.title || "NEKOMATA").trim() || "NEKOMATA";
  const separator = settings.site?.titleSeparator ?? "";
  setBootstrapTitle(siteName, separator);

  const root = document.getElementById("root");
  if (!root) {
    return;
  }
  createRoot(root).render(
    <App
      initialSettings={initialSettings as Parameters<typeof App>[0]["initialSettings"]}
      initiallyLoaded={!!initialSettings}
    />,
  );
};

bootstrap();
