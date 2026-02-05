import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
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

const bootstrap = async () => {
  const apiBase = getApiBase();
  let initialSettings: unknown = (window as { __BOOTSTRAP_SETTINGS__?: unknown })
    .__BOOTSTRAP_SETTINGS__;
  try {
    if (!initialSettings) {
      const response = await apiFetch(apiBase, "/api/public/settings");
      if (response.ok) {
        const data = await response.json();
        initialSettings = data.settings || {};
      }
    }
  } catch {
    initialSettings = undefined;
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
    <App initialSettings={initialSettings as Parameters<typeof App>[0]["initialSettings"]} initiallyLoaded={!!initialSettings} />,
  );
};

bootstrap();
