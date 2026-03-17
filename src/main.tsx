import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { primePublicBootstrapCache } from "@/hooks/use-public-bootstrap";
import { scheduleOnBrowserLoadIdle } from "@/lib/browser-idle";
import { asPublicBootstrapPayload } from "@/lib/public-bootstrap-global";
import { shouldRegisterPwaImmediately } from "@/lib/pwa-navigation";
import "./styles/fonts.css";
import "./index.css";

const HOME_HERO_READY_EVENT = "nekomata:hero-ready";

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
    [/^\/dashboard\/audit-log\/?$/, "Auditoria"],
    [/^\/dashboard\/paginas\/?$/, "Páginas"],
    [/^\/dashboard\/webhooks\/?$/, "Webhooks"],
    [/^\/dashboard\/configuracoes\/?$/, "Configurações"],
    [/^\/dashboard\/redirecionamentos\/?$/, "Redirecionamentos"],
    [/^\/dashboard\/?$/, "Painel"],
  ];
  const match = rules.find(([regex]) => regex.test(path));
  return match?.[1] || "";
};

const setBootstrapTitle = (siteName: string, separator: string) => {
  const path = window.location.pathname || "/";
  const pageTitle = titleForPath(path);
  const resolvedSeparator = separator || " | ";
  document.title = pageTitle ? `${pageTitle}${resolvedSeparator}${siteName}` : siteName;
};

const armHomeHeroShellCleanup = () => {
  const shell = document.getElementById("home-hero-shell");
  if (!shell) {
    return () => undefined;
  }

  let timeoutId = 0;
  let removed = false;

  const removeShell = () => {
    if (removed) {
      return;
    }
    removed = true;
    shell.remove();
    window.removeEventListener(HOME_HERO_READY_EVENT, removeShell);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  };

  window.addEventListener(HOME_HERO_READY_EVENT, removeShell, { once: true });
  timeoutId = window.setTimeout(removeShell, 7000);

  return () => {
    window.removeEventListener(HOME_HERO_READY_EVENT, removeShell);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  };
};

const bootstrap = async () => {
  const registerPwa = () => {
    void import("@/lib/pwa-register").then(({ registerPwa }) => registerPwa()).catch(() => null);
  };

  if (
    shouldRegisterPwaImmediately({
      pathname: window.location.pathname,
      hasServiceWorkerController: Boolean(window.navigator.serviceWorker?.controller),
    })
  ) {
    registerPwa();
  } else {
    scheduleOnBrowserLoadIdle(
      () => {
        registerPwa();
      },
      { delayMs: 15000 },
    );
  }

  const apiBase = getApiBase();
  const globalWindow = window as Window & {
    __BOOTSTRAP_SETTINGS__?: unknown;
    __BOOTSTRAP_PUBLIC__?: unknown;
    __BOOTSTRAP_PUBLIC_PROMISE__?: Promise<unknown>;
    __BOOTSTRAP_SKIP_PUBLIC_FETCH__?: boolean;
  };
  const shouldSkipPublicBootstrapFetch = globalWindow.__BOOTSTRAP_SKIP_PUBLIC_FETCH__ === true;
  let initialSettings: unknown = globalWindow.__BOOTSTRAP_SETTINGS__;
  let initialBootstrap = asPublicBootstrapPayload(globalWindow.__BOOTSTRAP_PUBLIC__);

  try {
    if (!initialBootstrap && !shouldSkipPublicBootstrapFetch) {
      const bootstrapPromise = globalWindow.__BOOTSTRAP_PUBLIC_PROMISE__;
      if (bootstrapPromise) {
        initialBootstrap = asPublicBootstrapPayload(await bootstrapPromise);
      }
    }
    if (!initialBootstrap && !shouldSkipPublicBootstrapFetch) {
      const response = await apiFetch(apiBase, "/api/public/bootstrap");
      if (response.ok) {
        initialBootstrap = asPublicBootstrapPayload(await response.json());
      }
    }
    if (initialBootstrap) {
      primePublicBootstrapCache(initialBootstrap);
      initialSettings = initialBootstrap.settings || initialSettings;
    }
  } catch {
    initialBootstrap = null;
    initialSettings = initialSettings || undefined;
  }

  if (initialBootstrap) {
    globalWindow.__BOOTSTRAP_PUBLIC__ = initialBootstrap;
  }

  const settings = (initialSettings as { site?: { name?: string; titleSeparator?: string } }) || {};
  const siteName =
    (settings.site?.name || "").trim() || (document.title || "NEKOMATA").trim() || "NEKOMATA";
  const separator = settings.site?.titleSeparator || " | ";
  if (
    !String(document.title || "").trim() ||
    String(document.title || "").trim() === "Carregando..."
  ) {
    setBootstrapTitle(siteName, separator);
  }

  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  const cleanupHomeHeroShell =
    window.location.pathname === "/" ? armHomeHeroShellCleanup() : () => undefined;

  createRoot(root).render(
    <App
      initialSettings={initialSettings as Parameters<typeof App>[0]["initialSettings"]}
      initiallyLoaded={!!initialSettings}
    />,
  );

  window.setTimeout(() => {
    cleanupHomeHeroShell();
  }, 8000);
};

bootstrap();
