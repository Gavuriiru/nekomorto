const PT_DIACRITICS_REGEX = /[\u0300-\u036f]/g;

const normalizeLookupKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(PT_DIACRITICS_REGEX, "")
    .trim()
    .toLowerCase();

const toSentenceCase = (value) => {
  const text = String(value || "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
};

const applyReplacementWithCase = (input, replacement) => {
  const source = String(input || "");
  if (!source) {
    return replacement;
  }
  if (source === source.toUpperCase()) {
    return replacement.toUpperCase();
  }
  const first = source.charAt(0);
  const rest = source.slice(1);
  if (first === first.toUpperCase() && rest === rest.toLowerCase()) {
    return toSentenceCase(replacement);
  }
  return replacement;
};

const LEGACY_REASON_WORD_REPLACEMENTS = [
  { from: "lancamento", to: "lançamento" },
  { from: "capitulo", to: "capítulo" },
  { from: "episodio", to: "episódio" },
  { from: "disponivel", to: "disponível" },
  { from: "conteudo", to: "conteúdo" },
  { from: "atualizacoes", to: "atualizações" },
  { from: "atualizacao", to: "atualização" },
];

const normalizeLegacyReasonText = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  return LEGACY_REASON_WORD_REPLACEMENTS.reduce((result, item) => {
    const regex = new RegExp(`\\b${item.from}\\b`, "gi");
    return result.replace(regex, (match) => applyReplacementWithCase(match, item.to));
  }, value);
};

export const normalizeLegacyUpdateRecord = (update) => {
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    return update;
  }
  const currentKind = String(update.kind || "");
  const currentUnit = String(update.unit || "");
  const currentReason = update.reason;

  const kindLookup = normalizeLookupKey(currentKind);
  const unitLookup = normalizeLookupKey(currentUnit);

  const nextKind = kindLookup.startsWith("lan") ? "Lançamento" : currentKind;
  const nextUnit =
    unitLookup === "capitulo" ? "Capítulo" : unitLookup === "episodio" ? "Episódio" : currentUnit;
  const nextReason = normalizeLegacyReasonText(currentReason);

  if (nextKind === currentKind && nextUnit === currentUnit && nextReason === currentReason) {
    return update;
  }

  return {
    ...update,
    kind: nextKind,
    unit: nextUnit,
    reason: nextReason,
  };
};

const LEGACY_INVITE_CARD_TEXT_MAP = new Map([
  [
    "Receba alertas de lancamentos, participe de eventos e fale sobre os nossos projetos.",
    "Receba alertas de lançamentos, participe de eventos e fale sobre os nossos projetos.",
  ],
  [
    "Atualizacoes, avisos e bate-papo com os membros.",
    "Atualizações, avisos e bate-papo com os membros.",
  ],
]);

export const normalizeLegacyInviteCardText = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = String(value || "").trim();
  return LEGACY_INVITE_CARD_TEXT_MAP.get(normalized) || value;
};
