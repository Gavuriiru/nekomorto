import {
  ABOUT_PAGE_DEFAULTS,
  FAQ_PAGE_DEFAULTS,
  RECRUITMENT_PAGE_DEFAULTS,
} from "../../shared/public-page-content.js";

const normalizeText = (value) => String(value || "").trim();

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeAttribute = (value) =>
  escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const truncateText = (value, maxLength = 240) => {
  const normalized = normalizeText(value).replace(/\s+/g, " ");
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

const buildLinkListMarkup = (links = []) => {
  const items = links.filter((entry) => entry?.href && entry?.label);
  if (items.length === 0) {
    return "";
  }
  return [
    '<nav aria-label="Navegação pública do site">',
    "  <ul>",
    ...items.map(
      (entry) =>
        `    <li><a href="${escapeAttribute(entry.href)}">${escapeHtml(entry.label)}</a></li>`,
    ),
    "  </ul>",
    "</nav>",
  ].join("\n");
};

const buildProjectLinksMarkup = (projects = [], maxItems = 8) => {
  const items = (Array.isArray(projects) ? projects : [])
    .filter((project) => normalizeText(project?.id) && normalizeText(project?.title))
    .slice(0, maxItems);
  if (items.length === 0) {
    return "";
  }
  return [
    "<section>",
    "  <h2>Projetos em destaque</h2>",
    "  <ul>",
    ...items.map((project) => {
      const title = normalizeText(project?.title) || "Projeto";
      const description = truncateText(project?.synopsis || project?.description, 180);
      return [
        "    <li>",
        `      <a href="/projeto/${escapeAttribute(project.id)}">${escapeHtml(title)}</a>`,
        description ? `      <p>${escapeHtml(description)}</p>` : "",
        "    </li>",
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "  </ul>",
    "</section>",
  ].join("\n");
};

const buildPostLinksMarkup = (posts = [], maxItems = 5) => {
  const items = (Array.isArray(posts) ? posts : [])
    .filter((post) => normalizeText(post?.slug) && normalizeText(post?.title))
    .slice(0, maxItems);
  if (items.length === 0) {
    return "";
  }
  return [
    "<section>",
    "  <h2>Postagens recentes</h2>",
    "  <ul>",
    ...items.map((post) => {
      const excerpt = truncateText(post?.excerpt, 160);
      return [
        "    <li>",
        `      <a href="/postagem/${escapeAttribute(post.slug)}">${escapeHtml(post.title)}</a>`,
        excerpt ? `      <p>${escapeHtml(excerpt)}</p>` : "",
        "    </li>",
      ]
        .filter(Boolean)
        .join("\n");
    }),
    "  </ul>",
    "</section>",
  ].join("\n");
};

const buildPageShell = ({ title, description, sections = [], links = [] }) => {
  return [
    '<div id="seo-snapshot" data-seo-snapshot="public">',
    '  <style data-seo-snapshot-style>',
    "    #seo-snapshot {",
    "      position: absolute;",
    "      width: 1px;",
    "      height: 1px;",
    "      margin: -1px;",
    "      padding: 0;",
    "      overflow: hidden;",
    "      border: 0;",
    "      clip: rect(0 0 0 0);",
    "      clip-path: inset(50%);",
    "      white-space: normal;",
    "      pointer-events: none;",
    "    }",
    "    #seo-snapshot main { max-width: 960px; margin: 0 auto; }",
    "    #seo-snapshot nav ul, #seo-snapshot section ul { padding-left: 1.25rem; }",
    "    #seo-snapshot h1, #seo-snapshot h2, #seo-snapshot h3 { line-height: 1.25; }",
    "    #seo-snapshot p { line-height: 1.6; }",
    "    #seo-snapshot a { color: inherit; text-decoration: underline; }",
    "  </style>",
    "  <main>",
    `    <h1>${escapeHtml(title)}</h1>`,
    description ? `    <p>${escapeHtml(description)}</p>` : "",
    buildLinkListMarkup(links)
      .split("\n")
      .map((line) => (line ? `    ${line}` : line))
      .join("\n"),
    ...sections
      .filter(Boolean)
      .map((section) =>
        String(section)
          .split("\n")
          .map((line) => (line ? `    ${line}` : line))
          .join("\n"),
      ),
    "  </main>",
    "</div>",
  ]
    .filter(Boolean)
    .join("\n");
};

const buildHomeSnapshot = ({ settings, publicBootstrap }) => {
  const siteName = normalizeText(settings?.site?.name) || "Nekomata";
  const description =
    truncateText(
      settings?.site?.description ||
        "Acompanhe projetos, lançamentos e novidades da Nekomata em um catálogo público com leitura, equipe e páginas institucionais.",
      220,
    ) || "";
  return buildPageShell({
    title: siteName,
    description,
    links: [
      { href: "/projetos", label: "Ver projetos" },
      { href: "/sobre", label: "Conhecer a Nekomata" },
      { href: "/faq", label: "Ler o FAQ" },
      { href: "/recrutamento", label: "Participar da equipe" },
    ],
    sections: [
      buildProjectLinksMarkup(publicBootstrap?.projects, 6),
      buildPostLinksMarkup(publicBootstrap?.posts, 4),
    ],
  });
};

const buildProjectsSnapshot = ({ settings, publicBootstrap }) =>
  buildPageShell({
    title: "Projetos",
    description:
      truncateText(
        settings?.site?.description ||
          "Veja a lista pública de projetos da Nekomata com sinopses, atualizações e acesso rápido às páginas de cada obra.",
        220,
      ) || "",
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/sobre", label: "Sobre a equipe" },
      { href: "/faq", label: "Perguntas frequentes" },
    ],
    sections: [buildProjectLinksMarkup(publicBootstrap?.projects, 16)],
  });

const buildProjectSnapshot = ({ project, publicBootstrap, stripHtml }) => {
  const title = normalizeText(project?.title) || "Projeto";
  const description =
    truncateText(
      project?.synopsis || project?.description || stripHtml(project?.content || ""),
      260,
    ) || "";
  const metaLines = [
    normalizeText(project?.type) ? `Formato: ${normalizeText(project.type)}` : "",
    normalizeText(project?.status) ? `Status: ${normalizeText(project.status)}` : "",
  ].filter(Boolean);
  return buildPageShell({
    title,
    description,
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/projetos", label: "Todos os projetos" },
      { href: "/faq", label: "FAQ" },
    ],
    sections: [
      metaLines.length > 0
        ? [
            "<section>",
            "  <h2>Informações do projeto</h2>",
            "  <ul>",
            ...metaLines.map((line) => `    <li>${escapeHtml(line)}</li>`),
            "  </ul>",
            "</section>",
          ].join("\n")
        : "",
      buildProjectLinksMarkup(
        (Array.isArray(publicBootstrap?.projects) ? publicBootstrap.projects : []).filter(
          (candidate) => String(candidate?.id || "") !== String(project?.id || ""),
        ),
        6,
      ),
    ],
  });
};

const buildPostSnapshot = ({ post, publicBootstrap, stripHtml }) => {
  const title = normalizeText(post?.title) || "Postagem";
  const description =
    truncateText(post?.excerpt || post?.seoDescription || stripHtml(post?.content || ""), 280) ||
    "";
  const relatedProject = (Array.isArray(publicBootstrap?.projects) ? publicBootstrap.projects : []).find(
    (candidate) => String(candidate?.id || "") === String(post?.projectId || ""),
  );
  return buildPageShell({
    title,
    description,
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/projetos", label: "Projetos" },
      ...(relatedProject ? [{ href: `/projeto/${relatedProject.id}`, label: relatedProject.title }] : []),
    ],
    sections: [buildPostLinksMarkup(publicBootstrap?.posts, 5)],
  });
};

const buildAboutSnapshot = ({ pages }) => {
  const about = pages?.about || ABOUT_PAGE_DEFAULTS;
  return buildPageShell({
    title: normalizeText(about.heroTitle) || ABOUT_PAGE_DEFAULTS.heroTitle,
    description: normalizeText(about.heroSubtitle) || ABOUT_PAGE_DEFAULTS.heroSubtitle,
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/projetos", label: "Projetos" },
      { href: "/recrutamento", label: "Recrutamento" },
    ],
    sections: [
      about.highlights?.length
        ? [
            "<section>",
            "  <h2>Destaques</h2>",
            "  <ul>",
            ...about.highlights
              .slice(0, 6)
              .map(
                (item) =>
                  `    <li><strong>${escapeHtml(item.label)}</strong>${item.text ? `: ${escapeHtml(item.text)}` : ""}</li>`,
              ),
            "  </ul>",
            "</section>",
          ].join("\n")
        : "",
      about.manifestoParagraphs?.length
        ? [
            "<section>",
            `  <h2>${escapeHtml(about.manifestoTitle || "Manifesto")}</h2>`,
            ...about.manifestoParagraphs
              .slice(0, 3)
              .map((paragraph) => `  <p>${escapeHtml(paragraph)}</p>`),
            "</section>",
          ].join("\n")
        : "",
    ],
  });
};

const buildFaqSnapshot = ({ pages }) => {
  const faq = pages?.faq || FAQ_PAGE_DEFAULTS;
  return buildPageShell({
    title: normalizeText(faq.heroTitle) || FAQ_PAGE_DEFAULTS.heroTitle,
    description: normalizeText(faq.heroSubtitle) || FAQ_PAGE_DEFAULTS.heroSubtitle,
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/sobre", label: "Sobre" },
      { href: "/recrutamento", label: "Recrutamento" },
    ],
    sections: (Array.isArray(faq.groups) ? faq.groups : [])
      .slice(0, 6)
      .map((group) =>
        [
          "<section>",
          `  <h2>${escapeHtml(group.title || "Perguntas")}</h2>`,
          "  <ul>",
          ...(Array.isArray(group.items) ? group.items : []).slice(0, 8).map((item) =>
            [
              "    <li>",
              `      <h3>${escapeHtml(item.question || "Pergunta")}</h3>`,
              item.answer ? `      <p>${escapeHtml(item.answer)}</p>` : "",
              "    </li>",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
          "  </ul>",
          "</section>",
        ].join("\n"),
      ),
  });
};

const buildRecruitmentSnapshot = ({ pages, settings }) => {
  const recruitment = pages?.recruitment || RECRUITMENT_PAGE_DEFAULTS;
  const discordUrl = normalizeText(settings?.community?.discordUrl);
  return buildPageShell({
    title: normalizeText(recruitment.heroTitle) || RECRUITMENT_PAGE_DEFAULTS.heroTitle,
    description:
      normalizeText(recruitment.heroSubtitle) || RECRUITMENT_PAGE_DEFAULTS.heroSubtitle,
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/sobre", label: "Sobre" },
      { href: "/faq", label: "FAQ" },
      ...(discordUrl ? [{ href: discordUrl, label: recruitment.ctaButtonLabel || "Discord" }] : []),
    ],
    sections: [
      recruitment.roles?.length
        ? [
            "<section>",
            "  <h2>Funções abertas</h2>",
            "  <ul>",
            ...recruitment.roles
              .slice(0, 12)
              .map(
                (role) =>
                  `    <li><strong>${escapeHtml(role.title)}</strong>${role.description ? `: ${escapeHtml(role.description)}` : ""}</li>`,
              ),
            "  </ul>",
            "</section>",
          ].join("\n")
        : "",
    ],
  });
};

const buildTeamSnapshot = ({ pages, publicBootstrap }) => {
  const team = pages?.team || {};
  const title = normalizeText(team.heroTitle) || "Equipe";
  const description =
    normalizeText(team.heroSubtitle) ||
    "Conheça a equipe da Nekomata e as pessoas responsáveis por tradução, revisão, edição e produção.";
  const members = (Array.isArray(publicBootstrap?.teamMembers) ? publicBootstrap.teamMembers : [])
    .filter((member) => normalizeText(member?.displayName || member?.name))
    .slice(0, 12);
  return buildPageShell({
    title,
    description,
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/sobre", label: "Sobre" },
      { href: "/recrutamento", label: "Recrutamento" },
    ],
    sections: [
      members.length > 0
        ? [
            "<section>",
            "  <h2>Membros</h2>",
            "  <ul>",
            ...members.map((member) => {
              const memberName = normalizeText(member.displayName || member.name);
              const memberRole = Array.isArray(member.roles)
                ? member.roles.map((role) => normalizeText(role)).filter(Boolean).join(", ")
                : "";
              return `    <li><strong>${escapeHtml(memberName)}</strong>${memberRole ? `: ${escapeHtml(memberRole)}` : ""}</li>`;
            }),
            "  </ul>",
            "</section>",
          ].join("\n")
        : "",
    ],
  });
};

const buildDonationsSnapshot = ({ pages }) => {
  const donations = pages?.donations || {};
  return buildPageShell({
    title: normalizeText(donations.heroTitle) || "Doações",
    description:
      normalizeText(donations.heroSubtitle) ||
      "Veja como apoiar a manutenção da Nekomata, incluindo custos recorrentes e formas públicas de contribuição.",
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/sobre", label: "Sobre" },
      { href: "/faq", label: "FAQ" },
    ],
    sections: [
      normalizeText(donations.reasonText)
        ? [
            "<section>",
            "  <h2>Por que apoiar</h2>",
            `  <p>${escapeHtml(truncateText(donations.reasonText, 260))}</p>`,
            "</section>",
          ].join("\n")
        : "",
    ],
  });
};

const buildTermsSnapshot = () =>
  buildPageShell({
    title: "Termos de Uso",
    description:
      "Resumo das regras aplicáveis ao uso do site, comentários públicos e acesso às áreas restritas da plataforma.",
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/politica-de-privacidade", label: "Política de Privacidade" },
    ],
    sections: [
      [
        "<section>",
        "  <h2>Principais pontos</h2>",
        "  <ul>",
        "    <li>O uso do site deve respeitar autenticação, moderação, segurança e rate limiting.</li>",
        "    <li>Comentários públicos podem passar por moderação antes de aparecer no site.</li>",
        "    <li>Áreas restritas dependem de autenticação e autorização específicas.</li>",
        "  </ul>",
        "</section>",
      ].join("\n"),
    ],
  });

const buildPrivacySnapshot = () =>
  buildPageShell({
    title: "Política de Privacidade",
    description:
      "Resumo de como o site trata dados ligados a comentários públicos, autenticação, segurança e operação da plataforma.",
    links: [
      { href: "/", label: "Página inicial" },
      { href: "/termos-de-uso", label: "Termos de Uso" },
    ],
    sections: [
      [
        "<section>",
        "  <h2>Principais pontos</h2>",
        "  <ul>",
        "    <li>Comentários podem envolver nome escolhido, conteúdo enviado e e-mail opcional.</li>",
        "    <li>Login em áreas restritas pode usar provedores autorizados e dados de sessão.</li>",
        "    <li>Dados técnicos podem ser tratados para segurança, moderação e operação do serviço.</li>",
        "  </ul>",
        "</section>",
      ].join("\n"),
    ],
  });

export const buildPublicSeoSnapshot = ({
  pathname,
  pages,
  settings,
  publicBootstrap,
  project = null,
  post = null,
  stripHtml = (value) => String(value || ""),
} = {}) => {
  const normalizedPathname = normalizeText(pathname).replace(/\/+$/, "") || "/";
  if (normalizedPathname === "/") {
    return buildHomeSnapshot({ settings, publicBootstrap });
  }
  if (normalizedPathname === "/projetos") {
    return buildProjectsSnapshot({ settings, publicBootstrap });
  }
  if (/^\/projeto\/[^/]+$/.test(normalizedPathname) || /^\/projetos\/[^/]+$/.test(normalizedPathname)) {
    return project ? buildProjectSnapshot({ project, publicBootstrap, stripHtml }) : "";
  }
  if (/^\/postagem\/[^/]+$/.test(normalizedPathname)) {
    return post ? buildPostSnapshot({ post, publicBootstrap, stripHtml }) : "";
  }
  switch (normalizedPathname) {
    case "/sobre":
      return buildAboutSnapshot({ pages });
    case "/faq":
      return buildFaqSnapshot({ pages });
    case "/recrutamento":
      return buildRecruitmentSnapshot({ pages, settings });
    case "/equipe":
      return buildTeamSnapshot({ pages, publicBootstrap });
    case "/doacoes":
      return buildDonationsSnapshot({ pages });
    case "/termos-de-uso":
      return buildTermsSnapshot();
    case "/politica-de-privacidade":
      return buildPrivacySnapshot();
    default:
      return "";
  }
};
