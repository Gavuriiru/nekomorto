const PT_BR_COLLATOR = new Intl.Collator("pt-BR", { sensitivity: "base" });

const SEARCH_SCOPE_SET = new Set(["all", "projects", "posts"]);
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value) => normalizeSearchText(value).split(/[^a-z0-9]+/g).filter(Boolean);

const wordsFromField = (value) => tokenize(value);

const boundedLevenshtein = (left, right, maxDistance = 2) => {
  const a = String(left || "");
  const b = String(right || "");
  if (!a || !b) {
    return Number.MAX_SAFE_INTEGER;
  }
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDistance) {
    return Number.MAX_SAFE_INTEGER;
  }
  const previous = new Array(lenB + 1);
  const current = new Array(lenB + 1);
  for (let column = 0; column <= lenB; column += 1) {
    previous[column] = column;
  }
  for (let row = 1; row <= lenA; row += 1) {
    current[0] = row;
    let minInRow = current[0];
    for (let column = 1; column <= lenB; column += 1) {
      const substitutionCost = a[row - 1] === b[column - 1] ? 0 : 1;
      const insertion = current[column - 1] + 1;
      const deletion = previous[column] + 1;
      const substitution = previous[column - 1] + substitutionCost;
      const next = Math.min(insertion, deletion, substitution);
      current[column] = next;
      if (next < minInRow) {
        minInRow = next;
      }
    }
    if (minInRow > maxDistance) {
      return Number.MAX_SAFE_INTEGER;
    }
    for (let column = 0; column <= lenB; column += 1) {
      previous[column] = current[column];
    }
  }
  return previous[lenB];
};

const scoreTokenInField = (
  token,
  normalizedField,
  fieldWords,
  {
    startsWith = 0,
    wordStartsWith = 0,
    includes = 0,
    typoDistance = 2,
    typo = 0,
  },
) => {
  if (!token || !normalizedField) {
    return 0;
  }
  if (normalizedField.startsWith(token)) {
    return startsWith;
  }
  if (fieldWords.some((word) => word.startsWith(token))) {
    return wordStartsWith;
  }
  if (normalizedField.includes(token)) {
    return includes;
  }
  if (typo > 0 && token.length >= 4) {
    for (const word of fieldWords) {
      if (Math.abs(word.length - token.length) > typoDistance) {
        continue;
      }
      if (boundedLevenshtein(token, word, typoDistance) <= typoDistance) {
        return typo;
      }
    }
  }
  return 0;
};

const prepareField = (value) => {
  const normalized = normalizeSearchText(value);
  return {
    normalized,
    words: normalized ? wordsFromField(normalized) : [],
  };
};

const scoreCandidate = (tokens, fieldGroups) => {
  let score = 0;
  for (const token of tokens) {
    let bestForToken = 0;
    fieldGroups.forEach((group) => {
      const next = scoreTokenInField(token, group.field.normalized, group.field.words, group.weights);
      if (next > bestForToken) {
        bestForToken = next;
      }
    });
    if (bestForToken <= 0) {
      return null;
    }
    score += bestForToken;
  }
  return score;
};

const popularityBoost = (rawValue) => {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(40, Math.round(Math.log10(value + 1) * 14));
};

const titleLengthBoost = (title) => {
  const normalized = normalizeSearchText(title);
  if (!normalized) {
    return 0;
  }
  return Math.max(0, 24 - Math.min(normalized.length, 24));
};

const toProjectSuggestion = (project, score) => {
  const metaParts = [String(project?.type || "").trim(), String(project?.status || "").trim()].filter(Boolean);
  return {
    kind: "project",
    id: String(project?.id || ""),
    label: String(project?.title || ""),
    href: `/projeto/${encodeURIComponent(String(project?.id || ""))}`,
    description: String(project?.synopsis || project?.description || "").trim(),
    image: String(project?.cover || project?.banner || "").trim(),
    tags: Array.isArray(project?.tags)
      ? project.tags
          .map((tag) => String(tag || "").trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
    meta: metaParts.join(" • "),
    score,
  };
};

const toPostSuggestion = (post, score) => {
  const postId = String(post?.id || post?.slug || "").trim();
  const slug = String(post?.slug || "").trim();
  const metaParts = [String(post?.author || "").trim()].filter(Boolean);
  return {
    kind: "post",
    id: postId,
    label: String(post?.title || ""),
    href: `/postagem/${encodeURIComponent(slug)}`,
    description: String(post?.excerpt || "").trim(),
    image: String(post?.coverImageUrl || "").trim(),
    tags: Array.isArray(post?.tags)
      ? post.tags
          .map((tag) => String(tag || "").trim())
          .filter(Boolean)
          .slice(0, 4)
      : [],
    meta: metaParts.join(" • "),
    score,
  };
};

const compareByRank = (a, b) => {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  if (b.popularity !== a.popularity) {
    return b.popularity - a.popularity;
  }
  return PT_BR_COLLATOR.compare(a.label, b.label);
};

const clampQuery = (value) => String(value || "").trim().slice(0, MAX_QUERY_LENGTH);

export const parseSearchScope = (value) => {
  const normalized = String(value || "all")
    .trim()
    .toLowerCase();
  if (!SEARCH_SCOPE_SET.has(normalized)) {
    return "all";
  }
  return normalized;
};

export const parseSearchLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  const normalized = Math.floor(parsed);
  if (normalized <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(normalized, MAX_LIMIT);
};

export const normalizeSearchQuery = (value) => clampQuery(value);

const rankProjectSuggestions = (projects, tokens) => {
  const ranked = [];
  projects.forEach((project) => {
    const titleField = prepareField(project?.title || "");
    const tagsField = prepareField(
      Array.isArray(project?.tags)
        ? project.tags.join(" ")
        : "",
    );
    const metadataField = prepareField(
      [project?.type, project?.status, project?.year, project?.studio].filter(Boolean).join(" "),
    );
    const summaryField = prepareField(
      [project?.synopsis, project?.description].filter(Boolean).join(" "),
    );

    const baseScore = scoreCandidate(tokens, [
      {
        field: titleField,
        weights: {
          startsWith: 250,
          wordStartsWith: 210,
          includes: 160,
          typo: 110,
          typoDistance: 2,
        },
      },
      {
        field: tagsField,
        weights: {
          startsWith: 170,
          wordStartsWith: 145,
          includes: 110,
          typo: 78,
          typoDistance: 2,
        },
      },
      {
        field: metadataField,
        weights: {
          startsWith: 92,
          wordStartsWith: 78,
          includes: 62,
          typo: 42,
          typoDistance: 1,
        },
      },
      {
        field: summaryField,
        weights: {
          startsWith: 56,
          wordStartsWith: 48,
          includes: 40,
          typo: 24,
          typoDistance: 1,
        },
      },
    ]);
    if (baseScore === null) {
      return;
    }
    const score = baseScore + popularityBoost(project?.views) + titleLengthBoost(project?.title);
    const suggestion = toProjectSuggestion(project, score);
    ranked.push({
      ...suggestion,
      popularity: Number(project?.views) || 0,
    });
  });
  ranked.sort(compareByRank);
  return ranked;
};

const rankPostSuggestions = (posts, tokens) => {
  const ranked = [];
  posts.forEach((post) => {
    const titleField = prepareField(post?.title || "");
    const tagsField = prepareField(Array.isArray(post?.tags) ? post.tags.join(" ") : "");
    const metadataField = prepareField([post?.author].filter(Boolean).join(" "));
    const summaryField = prepareField([post?.excerpt].filter(Boolean).join(" "));

    const baseScore = scoreCandidate(tokens, [
      {
        field: titleField,
        weights: {
          startsWith: 240,
          wordStartsWith: 200,
          includes: 150,
          typo: 100,
          typoDistance: 2,
        },
      },
      {
        field: tagsField,
        weights: {
          startsWith: 156,
          wordStartsWith: 136,
          includes: 104,
          typo: 70,
          typoDistance: 2,
        },
      },
      {
        field: metadataField,
        weights: {
          startsWith: 82,
          wordStartsWith: 66,
          includes: 52,
          typo: 34,
          typoDistance: 1,
        },
      },
      {
        field: summaryField,
        weights: {
          startsWith: 50,
          wordStartsWith: 42,
          includes: 34,
          typo: 22,
          typoDistance: 1,
        },
      },
    ]);
    if (baseScore === null) {
      return;
    }
    const score = baseScore + popularityBoost(post?.views) + titleLengthBoost(post?.title);
    const suggestion = toPostSuggestion(post, score);
    ranked.push({
      ...suggestion,
      popularity: Number(post?.views) || 0,
    });
  });
  ranked.sort(compareByRank);
  return ranked;
};

export const buildPublicSearchSuggestions = ({
  query,
  scope = "all",
  limit = DEFAULT_LIMIT,
  projects = [],
  posts = [],
}) => {
  const normalizedQuery = clampQuery(query);
  if (normalizedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }
  const tokens = tokenize(normalizedQuery);
  if (!tokens.length) {
    return [];
  }

  const normalizedScope = parseSearchScope(scope);
  const normalizedLimit = parseSearchLimit(limit);
  const pool = [];
  if (normalizedScope === "all" || normalizedScope === "projects") {
    pool.push(...rankProjectSuggestions(projects, tokens));
  }
  if (normalizedScope === "all" || normalizedScope === "posts") {
    pool.push(...rankPostSuggestions(posts, tokens));
  }
  pool.sort(compareByRank);
  return pool.slice(0, normalizedLimit).map(({ popularity: _popularity, score, ...item }) => ({
    ...item,
    score,
  }));
};

export const publicSearchConfig = {
  minQueryLength: MIN_QUERY_LENGTH,
  maxQueryLength: MAX_QUERY_LENGTH,
  defaultLimit: DEFAULT_LIMIT,
  maxLimit: MAX_LIMIT,
};

