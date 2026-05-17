const normalizeText = (value) => String(value || "").trim();

const cloneObjectArray = (items) =>
  (Array.isArray(items) ? items : []).map((item) =>
    item && typeof item === "object" && !Array.isArray(item) ? { ...item } : item,
  );

const cloneStringArray = (items) =>
  (Array.isArray(items) ? items : []).map((item) => String(item || ""));

const normalizeStringArray = (value, fallback) => {
  const items = (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item))
    .filter(Boolean);
  return items.length > 0 ? items : cloneStringArray(fallback);
};

const normalizeObjectArray = (value, normalizeItem, fallback) => {
  const items = (Array.isArray(value) ? value : []).map(normalizeItem).filter(Boolean);
  return items.length > 0 ? items : cloneObjectArray(fallback);
};

const resolveTextOrFallback = (value, fallback) => normalizeText(value) || fallback;

export const ABOUT_PAGE_DEFAULTS = Object.freeze({
  shareImage: "",
  shareImageAlt: "",
  heroBadge: "Sobre",
  heroTitle: "Uma fansub com identidade própria",
  heroSubtitle:
    "A Nekomata nasceu para entregar traduções naturais, visual marcante e um fluxo de trabalho que respeita a obra e o público. Cada etapa é feita com cuidado editorial e atenção aos detalhes.",
  heroBadges: Object.freeze(["Legendado com carinho", "Sem propaganda", "Gratuito"]),
  highlights: Object.freeze([
    Object.freeze({
      label: "Somos movidos por histórias",
      icon: "Sparkles",
      text: "Trabalhamos em equipe para traduzir, adaptar e manter a identidade de cada obra com cuidado editorial.",
    }),
    Object.freeze({
      label: "Processo claro e constante",
      icon: "Sparkles",
      text: "Fluxo colaborativo, revisão dupla e ajustes finos fazem parte da nossa rotina.",
    }),
    Object.freeze({
      label: "Respeito à obra",
      icon: "Sparkles",
      text: "Apoiamos o consumo legal e preservamos a experiência original, com o toque da comunidade.",
    }),
  ]),
  manifestoTitle: "Manifesto",
  manifestoIcon: "Flame",
  manifestoParagraphs: Object.freeze([
    "Fazemos tudo por paixão, sem fins lucrativos, priorizando qualidade e uma entrega que dê orgulho à comunidade. Cada projeto é um convite para sentir a obra como ela merece.",
    "Nossas escolhas são orientadas por clareza, estilo e consistência. O resultado precisa ser bonito, legível e fiel ao tom da história.",
  ]),
  pillars: Object.freeze([
    Object.freeze({
      title: "Pipeline",
      description: "Tradução → Revisão → Timing → Typesetting → Qualidade → Encode.",
      icon: "Zap",
    }),
    Object.freeze({
      title: "Comunidade",
      description: "Feedbacks ajudam a evoluir o padrão e manter a identidade da equipe.",
      icon: "Users",
    }),
    Object.freeze({
      title: "Estilo",
      description: "Tipografia, ritmo e efeitos visuais criam uma experiência memorável.",
      icon: "Sparkles",
    }),
  ]),
  values: Object.freeze([
    Object.freeze({
      title: "Paixão pelo que fazemos",
      description:
        "Cada projeto é tratado com carinho e respeito à obra original, sempre buscando a melhor experiência possível.",
      icon: "Heart",
    }),
    Object.freeze({
      title: "Qualidade em cada etapa",
      description:
        "Do timing ao encode, mantemos um fluxo cuidadoso para entregar consistência e leitura confortável.",
      icon: "Sparkles",
    }),
    Object.freeze({
      title: "Comunidade em primeiro lugar",
      description:
        "A equipe cresce junto da comunidade. Feedbacks ajudam a lapidar escolhas e manter a identidade do grupo.",
      icon: "Users",
    }),
    Object.freeze({
      title: "Criatividade e estilo",
      description:
        "Tipografia, efeitos e ritmo contam história. O typesetting é parte essencial da narrativa visual.",
      icon: "Wand2",
    }),
  ]),
});

export const FAQ_PAGE_DEFAULTS = Object.freeze({
  shareImage: "",
  shareImageAlt: "",
  heroTitle: "Perguntas frequentes",
  heroSubtitle: "Respostas rápidas para dúvidas comuns sobre projetos, lançamentos e equipe.",
  introCards: Object.freeze([
    Object.freeze({
      title: "Antes de perguntar",
      icon: "HelpCircle",
      text: "Se sua dúvida não estiver aqui, fale com a equipe no Discord. Responderemos assim que possível.",
      note: "A equipe é pequena e trabalha no tempo livre. Obrigado pela compreensão!",
    }),
    Object.freeze({
      title: "Dica rápida",
      icon: "Sparkles",
      text: "Para melhor experiência, use players como MPV ou VLC e mantenha o arquivo na mesma pasta da legenda.",
      note: "Sugestões de projetos são bem-vindas, mas dependem de disponibilidade.",
    }),
  ]),
  groups: Object.freeze([
    Object.freeze({
      title: "Detalhes gerais",
      icon: "Info",
      items: Object.freeze([
        Object.freeze({
          question: "O que é a Nekomata Fansub?",
          answer:
            "Somos um grupo de fãs que traduz e adapta conteúdos com foco em qualidade, estilo e respeito à obra.",
        }),
        Object.freeze({
          question: "Vocês cobram pelos lançamentos?",
          answer: "Não. Nosso trabalho é feito por paixão e sem fins lucrativos.",
        }),
        Object.freeze({
          question: "Qual a prioridade da equipe?",
          answer: "Entregar algo bonito, legível e consistente, mesmo que isso leve mais tempo.",
        }),
      ]),
    }),
    Object.freeze({
      title: "Recrutamento",
      icon: "Users",
      items: Object.freeze([
        Object.freeze({
          question: "Posso entrar para a equipe?",
          answer: "Sim! Sempre buscamos pessoas comprometidas. Entre em contato pelo Discord.",
        }),
        Object.freeze({
          question: "Preciso ter experiência?",
          answer: "Ajuda, mas não é obrigatório. O principal é vontade de aprender e consistência.",
        }),
      ]),
    }),
    Object.freeze({
      title: "Projetos e lançamentos",
      icon: "Rocket",
      items: Object.freeze([
        Object.freeze({
          question: "Quando sai o próximo episódio?",
          answer: "Quando estiver pronto. Evitamos datas exatas para priorizar qualidade.",
        }),
        Object.freeze({
          question: "Posso sugerir um projeto?",
          answer: "Pode sim! Levamos em conta a demanda e a capacidade da equipe.",
        }),
      ]),
    }),
    Object.freeze({
      title: "Qualidade e suporte",
      icon: "Shield",
      items: Object.freeze([
        Object.freeze({
          question: "Como reporto um erro?",
          answer: "Fale com a equipe pelo Discord. Quanto mais detalhes, melhor.",
        }),
        Object.freeze({
          question: "A legenda não aparece. O que faço?",
          answer: "Verifique o player e o arquivo. Recomendamos players como MPV e VLC.",
        }),
      ]),
    }),
  ]),
});

export const RECRUITMENT_PAGE_DEFAULTS = Object.freeze({
  shareImage: "",
  shareImageAlt: "",
  heroBadge: "Recrutamento",
  heroTitle: "Venha fazer parte da equipe",
  heroSubtitle:
    "Buscamos pessoas comprometidas e curiosas. Se você gosta de traduções, edição ou produção visual, há um lugar para você aqui.",
  roles: Object.freeze([
    Object.freeze({
      title: "Tradutor",
      description: "Adapta o texto original para português mantendo tom, contexto e naturalidade.",
      icon: "Languages",
    }),
    Object.freeze({
      title: "Revisor",
      description: "Garante coerência, gramática e fluidez do texto antes da etapa visual.",
      icon: "ScanText",
    }),
    Object.freeze({
      title: "Typesetter",
      description: "Integra o texto à arte, ajustando tipografia, efeitos e legibilidade.",
      icon: "PenTool",
    }),
    Object.freeze({
      title: "Quality Check",
      description: "Revisa o resultado final buscando erros visuais, timing e consistência.",
      icon: "ShieldCheck",
    }),
    Object.freeze({
      title: "Encoder",
      description: "Responsável por exportação e ajustes finais de qualidade do vídeo/arquivo.",
      icon: "Video",
    }),
    Object.freeze({
      title: "Cleaner",
      description: "Remove textos da arte original preparando o material para o typesetting.",
      icon: "Paintbrush",
    }),
    Object.freeze({
      title: "Redrawer",
      description: "Reconstrói partes da arte removidas pelo cleaning para preservar o visual.",
      icon: "Layers",
    }),
    Object.freeze({
      title: "Timer",
      description: "Sincroniza falas com o tempo, garantindo leitura confortável e precisa.",
      icon: "Timer",
    }),
    Object.freeze({
      title: "Karaoke/FX",
      description: "Cria efeitos especiais e animações para openings/endings quando necessário.",
      icon: "Sparkles",
    }),
  ]),
  ctaTitle: "Pronto para participar?",
  ctaSubtitle: "Entre no nosso servidor e fale com a equipe.",
  ctaButtonLabel: "Entrar no Discord",
});

const normalizeAboutHighlight = (item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }
  const label = normalizeText(item.label);
  const text = normalizeText(item.text);
  if (!label && !text) {
    return null;
  }
  return {
    ...item,
    label,
    text,
    icon: normalizeText(item.icon) || "Sparkles",
  };
};

const normalizeAboutCard = (item, fallbackIcon) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }
  const title = normalizeText(item.title);
  const description = normalizeText(item.description);
  if (!title && !description) {
    return null;
  }
  return {
    ...item,
    title,
    description,
    icon: normalizeText(item.icon) || fallbackIcon,
  };
};

export const normalizeAboutPublicPage = (value) => {
  const page = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...ABOUT_PAGE_DEFAULTS,
    ...page,
    shareImage: normalizeText(page.shareImage),
    shareImageAlt: normalizeText(page.shareImageAlt),
    heroBadge: resolveTextOrFallback(page.heroBadge, ABOUT_PAGE_DEFAULTS.heroBadge),
    heroTitle: resolveTextOrFallback(page.heroTitle, ABOUT_PAGE_DEFAULTS.heroTitle),
    heroSubtitle: resolveTextOrFallback(page.heroSubtitle, ABOUT_PAGE_DEFAULTS.heroSubtitle),
    heroBadges: normalizeStringArray(page.heroBadges, ABOUT_PAGE_DEFAULTS.heroBadges),
    highlights: normalizeObjectArray(
      page.highlights,
      normalizeAboutHighlight,
      ABOUT_PAGE_DEFAULTS.highlights,
    ),
    manifestoTitle: resolveTextOrFallback(page.manifestoTitle, ABOUT_PAGE_DEFAULTS.manifestoTitle),
    manifestoIcon: resolveTextOrFallback(page.manifestoIcon, ABOUT_PAGE_DEFAULTS.manifestoIcon),
    manifestoParagraphs: normalizeStringArray(
      page.manifestoParagraphs,
      ABOUT_PAGE_DEFAULTS.manifestoParagraphs,
    ),
    pillars: normalizeObjectArray(
      page.pillars,
      (item) => normalizeAboutCard(item, "Sparkles"),
      ABOUT_PAGE_DEFAULTS.pillars,
    ),
    values: normalizeObjectArray(
      page.values,
      (item) => normalizeAboutCard(item, "Heart"),
      ABOUT_PAGE_DEFAULTS.values,
    ),
  };
};

const normalizeFaqIntroCard = (item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }
  const title = normalizeText(item.title);
  const text = normalizeText(item.text);
  const note = normalizeText(item.note);
  if (!title && !text && !note) {
    return null;
  }
  return {
    ...item,
    title,
    text,
    note,
    icon: normalizeText(item.icon) || "HelpCircle",
  };
};

const normalizeFaqItem = (item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }
  const question = normalizeText(item.question);
  const answer = normalizeText(item.answer);
  if (!question && !answer) {
    return null;
  }
  return {
    ...item,
    question,
    answer,
  };
};

const normalizeFaqGroup = (item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }
  const title = normalizeText(item.title);
  const items = normalizeObjectArray(item.items, normalizeFaqItem, []);
  if (!title && items.length === 0) {
    return null;
  }
  return {
    ...item,
    title,
    icon: normalizeText(item.icon) || "HelpCircle",
    items,
  };
};

export const normalizeFaqPublicPage = (value) => {
  const page = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...FAQ_PAGE_DEFAULTS,
    ...page,
    shareImage: normalizeText(page.shareImage),
    shareImageAlt: normalizeText(page.shareImageAlt),
    heroTitle: resolveTextOrFallback(page.heroTitle, FAQ_PAGE_DEFAULTS.heroTitle),
    heroSubtitle: resolveTextOrFallback(page.heroSubtitle, FAQ_PAGE_DEFAULTS.heroSubtitle),
    introCards: normalizeObjectArray(
      page.introCards,
      normalizeFaqIntroCard,
      FAQ_PAGE_DEFAULTS.introCards,
    ),
    groups: normalizeObjectArray(page.groups, normalizeFaqGroup, FAQ_PAGE_DEFAULTS.groups),
  };
};

const normalizeRecruitmentRole = (item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }
  const title = normalizeText(item.title);
  const description = normalizeText(item.description);
  if (!title && !description) {
    return null;
  }
  return {
    ...item,
    title,
    description,
    icon: normalizeText(item.icon) || "Sparkles",
  };
};

export const normalizeRecruitmentPublicPage = (value) => {
  const page = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...RECRUITMENT_PAGE_DEFAULTS,
    ...page,
    shareImage: normalizeText(page.shareImage),
    shareImageAlt: normalizeText(page.shareImageAlt),
    heroBadge: resolveTextOrFallback(page.heroBadge, RECRUITMENT_PAGE_DEFAULTS.heroBadge),
    heroTitle: resolveTextOrFallback(page.heroTitle, RECRUITMENT_PAGE_DEFAULTS.heroTitle),
    heroSubtitle: resolveTextOrFallback(page.heroSubtitle, RECRUITMENT_PAGE_DEFAULTS.heroSubtitle),
    roles: normalizeObjectArray(
      page.roles,
      normalizeRecruitmentRole,
      RECRUITMENT_PAGE_DEFAULTS.roles,
    ),
    ctaTitle: resolveTextOrFallback(page.ctaTitle, RECRUITMENT_PAGE_DEFAULTS.ctaTitle),
    ctaSubtitle: resolveTextOrFallback(page.ctaSubtitle, RECRUITMENT_PAGE_DEFAULTS.ctaSubtitle),
    ctaButtonLabel: resolveTextOrFallback(
      page.ctaButtonLabel,
      RECRUITMENT_PAGE_DEFAULTS.ctaButtonLabel,
    ),
  };
};

export const normalizePublicPageContentCollection = (value) => {
  const pages = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    ...pages,
    about: normalizeAboutPublicPage(pages.about),
    faq: normalizeFaqPublicPage(pages.faq),
    recruitment: normalizeRecruitmentPublicPage(pages.recruitment),
  };
};

export const isAboutPublicPageMaterial = (value) => {
  const page = normalizeAboutPublicPage(value);
  return Boolean(
    page.heroTitle ||
      page.heroSubtitle ||
      page.heroBadges.length > 0 ||
      page.highlights.length > 0 ||
      page.manifestoParagraphs.length > 0 ||
      page.pillars.length > 0 ||
      page.values.length > 0,
  );
};

export const isFaqPublicPageMaterial = (value) => {
  const page = normalizeFaqPublicPage(value);
  return Boolean(
    page.heroTitle ||
      page.heroSubtitle ||
      page.introCards.length > 0 ||
      page.groups.some((group) => group.items.length > 0),
  );
};

export const isRecruitmentPublicPageMaterial = (value) => {
  const page = normalizeRecruitmentPublicPage(value);
  return Boolean(
    page.heroTitle ||
      page.heroSubtitle ||
      page.roles.length > 0 ||
      page.ctaTitle ||
      page.ctaSubtitle ||
      page.ctaButtonLabel,
  );
};
