import { primePublicBootstrapCache } from "@/hooks/use-public-bootstrap";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { armHomeHeroShellCleanup } from "@/lib/home-hero";
import { asPublicBootstrapPayload } from "@/lib/public-bootstrap-global";
import { startPublicFreshnessCoordinator } from "@/lib/public-freshness";
import { installPwaCleanupReloadBridge, runPwaCleanup } from "@/lib/pwa-cleanup";
import { installVitePreloadRecovery } from "@/lib/vite-preload-recovery";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/fonts.css";

installVitePreloadRecovery();

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
    [/^\/termos-de-uso\/?$/, "Termos de Uso"],
    [/^\/politica-de-privacidade\/?$/, "Política de Privacidade"],
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

const bootstrap = async () => {
  installPwaCleanupReloadBridge();
  void runPwaCleanup().catch(() => undefined);

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

  // If the server already injected data synchronously, use it right away.
  if (initialBootstrap) {
    primePublicBootstrapCache(initialBootstrap);
    initialSettings = initialBootstrap.settings || initialSettings;
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

  if (window.location.pathname === "/") {
    armHomeHeroShellCleanup();
  }

  // Mount React immediately — don't wait for the network fetch.
  createRoot(root).render(
    <App
      initialSettings={initialSettings as Parameters<typeof App>[0]["initialSettings"]}
      initiallyLoaded={!!initialSettings}
    />,
  );

  const dismissLoader = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const loader = document.getElementById("vite-app-loader");
        if (!loader) {
          return;
        }
        loader.style.opacity = "0";
        loader.addEventListener("transitionend", () => loader.remove(), { once: true });
        // Safety: remove even if the transition event never fires
        globalWindow.setTimeout(() => loader.remove(), 500);
      });
    });
  };

  startPublicFreshnessCoordinator({
    globalWindow: window,
    apiBase,
  });

  // When the hero shell is present (home page via Express), the CSS already
  // hides the spinner — just remove it from the DOM immediately.
  const hasHeroShell = document.getElementById("home-hero-shell") !== null;
  if (hasHeroShell) {
    document.getElementById("vite-app-loader")?.remove();
  }

  // When server-injected data was present, React already has content — dismiss
  // the loader after the first painted frame.
  if (!hasHeroShell && (initialBootstrap || shouldSkipPublicBootstrapFetch)) {
    dismissLoader();
  } else {
    // No data yet — keep the spinner visible while we fetch in the background,
    // then dismiss after React has had a frame to re-render with real content.
    void (async () => {
      try {
        const fetchTimeoutMs = 4000;

        const bootstrapPromise = globalWindow.__BOOTSTRAP_PUBLIC_PROMISE__;
        if (bootstrapPromise) {
          const resolved = asPublicBootstrapPayload(
            await Promise.race([
              bootstrapPromise,
              new Promise((_, reject) =>
                globalWindow.setTimeout(
                  () => reject(new Error("Bootstrap promise timeout")),
                  fetchTimeoutMs,
                ),
              ),
            ]),
          );
          if (resolved) {
            primePublicBootstrapCache(resolved);
            globalWindow.__BOOTSTRAP_PUBLIC__ = resolved;
            dismissLoader();
            return;
          }
        }

        const abortController = new AbortController();
        const timeoutId = globalWindow.setTimeout(() => abortController.abort(), fetchTimeoutMs);
        try {
          const response = await apiFetch(apiBase, "/api/public/bootstrap", {
            signal: abortController.signal,
          });
          if (response.ok) {
            const payload = asPublicBootstrapPayload(await response.json());
            if (payload) {
              primePublicBootstrapCache(payload);
              globalWindow.__BOOTSTRAP_PUBLIC__ = payload;
            }
          }
        } finally {
          globalWindow.clearTimeout(timeoutId);
        }
      } catch {
        // Best-effort — the app's hooks will retry on their own schedule.
      }
      // Dismiss regardless — even if the fetch failed, we don't block forever.
      dismissLoader();
    })();
  }
};

bootstrap();
