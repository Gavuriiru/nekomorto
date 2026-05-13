const normalizePathname = (value) => {
  const pathname = String(value || "").trim();
  if (!pathname.startsWith("/")) {
    return "/";
  }
  return pathname.replace(/\/+$/, "") || "/";
};

export const PUBLIC_ROUTE_KIND_HOME = "home";
export const PUBLIC_ROUTE_KIND_POST = "post";
export const PUBLIC_ROUTE_KIND_TEAM = "team";
export const PUBLIC_ROUTE_KIND_ABOUT = "about";
export const PUBLIC_ROUTE_KIND_DONATIONS = "donations";
export const PUBLIC_ROUTE_KIND_FAQ = "faq";
export const PUBLIC_ROUTE_KIND_PROJECTS_LIST = "projects-list";
export const PUBLIC_ROUTE_KIND_PROJECT_DETAIL = "project-detail";
export const PUBLIC_ROUTE_KIND_PROJECT_READING = "project-reading";
export const PUBLIC_ROUTE_KIND_RECRUITMENT = "recruitment";
export const PUBLIC_ROUTE_KIND_TERMS = "terms";
export const PUBLIC_ROUTE_KIND_PRIVACY = "privacy";
export const PUBLIC_ROUTE_KIND_LOGIN = "login";
export const PUBLIC_ROUTE_KIND_NOT_FOUND = "not-found";

export const PUBLIC_ROUTE_MODULE_IDS = {
  [PUBLIC_ROUTE_KIND_HOME]: "src/pages/Index.tsx",
  [PUBLIC_ROUTE_KIND_POST]: "src/pages/Post.tsx",
  [PUBLIC_ROUTE_KIND_TEAM]: "src/pages/Team.tsx",
  [PUBLIC_ROUTE_KIND_ABOUT]: "src/pages/About.tsx",
  [PUBLIC_ROUTE_KIND_DONATIONS]: "src/pages/Donations.tsx",
  [PUBLIC_ROUTE_KIND_FAQ]: "src/pages/FAQ.tsx",
  [PUBLIC_ROUTE_KIND_PROJECTS_LIST]: "src/pages/Projects.tsx",
  [PUBLIC_ROUTE_KIND_PROJECT_DETAIL]: "src/pages/Project.tsx",
  [PUBLIC_ROUTE_KIND_PROJECT_READING]: "src/pages/ProjectReading.tsx",
  [PUBLIC_ROUTE_KIND_RECRUITMENT]: "src/pages/Recruitment.tsx",
  [PUBLIC_ROUTE_KIND_TERMS]: "src/pages/TermsOfService.tsx",
  [PUBLIC_ROUTE_KIND_PRIVACY]: "src/pages/PrivacyPolicy.tsx",
  [PUBLIC_ROUTE_KIND_LOGIN]: "src/pages/Login.tsx",
  [PUBLIC_ROUTE_KIND_NOT_FOUND]: "src/pages/NotFound.tsx",
};

const PUBLIC_ROUTE_MATCHERS = [
  { kind: PUBLIC_ROUTE_KIND_HOME, pattern: /^\/$/ },
  { kind: PUBLIC_ROUTE_KIND_POST, pattern: /^\/postagem\/[^/]+$/ },
  { kind: PUBLIC_ROUTE_KIND_TEAM, pattern: /^\/equipe$/ },
  { kind: PUBLIC_ROUTE_KIND_ABOUT, pattern: /^\/sobre$/ },
  { kind: PUBLIC_ROUTE_KIND_DONATIONS, pattern: /^\/doacoes$/ },
  { kind: PUBLIC_ROUTE_KIND_FAQ, pattern: /^\/faq$/ },
  { kind: PUBLIC_ROUTE_KIND_PROJECTS_LIST, pattern: /^\/projetos$/ },
  { kind: PUBLIC_ROUTE_KIND_PROJECT_READING, pattern: /^\/projeto\/[^/]+\/leitura\/[^/]+$/ },
  { kind: PUBLIC_ROUTE_KIND_PROJECT_READING, pattern: /^\/projetos\/[^/]+\/leitura\/[^/]+$/ },
  { kind: PUBLIC_ROUTE_KIND_PROJECT_DETAIL, pattern: /^\/projeto\/[^/]+$/ },
  { kind: PUBLIC_ROUTE_KIND_PROJECT_DETAIL, pattern: /^\/projetos\/[^/]+$/ },
  { kind: PUBLIC_ROUTE_KIND_RECRUITMENT, pattern: /^\/recrutamento$/ },
  { kind: PUBLIC_ROUTE_KIND_TERMS, pattern: /^\/termos-de-uso$/ },
  { kind: PUBLIC_ROUTE_KIND_PRIVACY, pattern: /^\/politica-de-privacidade$/ },
  { kind: PUBLIC_ROUTE_KIND_LOGIN, pattern: /^\/login$/ },
];

export const resolvePublicRouteKind = (value) => {
  const pathname = normalizePathname(value);
  const match = PUBLIC_ROUTE_MATCHERS.find((entry) => entry.pattern.test(pathname));
  return match?.kind || PUBLIC_ROUTE_KIND_NOT_FOUND;
};

export const isShellOnlyPublicRouteKind = (kind) =>
  [
    PUBLIC_ROUTE_KIND_ABOUT,
    PUBLIC_ROUTE_KIND_DONATIONS,
    PUBLIC_ROUTE_KIND_FAQ,
    PUBLIC_ROUTE_KIND_LOGIN,
    PUBLIC_ROUTE_KIND_PRIVACY,
    PUBLIC_ROUTE_KIND_PROJECTS_LIST,
    PUBLIC_ROUTE_KIND_PROJECT_DETAIL,
    PUBLIC_ROUTE_KIND_RECRUITMENT,
    PUBLIC_ROUTE_KIND_TEAM,
    PUBLIC_ROUTE_KIND_TERMS,
  ].includes(kind);
