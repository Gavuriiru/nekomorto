export type SearchSuggestionKind = "project" | "post";

export type SearchSuggestion = {
  kind: SearchSuggestionKind;
  id: string;
  label: string;
  href: string;
  description?: string;
  image?: string;
  tags?: string[];
  meta?: string;
  score?: number;
};

