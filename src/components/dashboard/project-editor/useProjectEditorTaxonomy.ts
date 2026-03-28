import { useMemo } from "react";

import {
  buildTranslationMap,
  normalizeKey,
  sortByTranslatedLabel,
  translateGenre,
  translateTag,
} from "@/lib/project-taxonomy";

import type {
  ProjectForm,
  ProjectRecord,
  TaxonomySuggestionOption,
} from "./dashboard-projects-editor-types";

const collectKnownTaxonomyValues = ({
  selectedValues,
  projects,
  translations,
  pickValues,
}: {
  selectedValues: string[];
  projects: ProjectRecord[];
  translations: Record<string, string>;
  pickValues: (project: ProjectRecord) => string[] | null | undefined;
}) => {
  const values = new Set<string>();

  projects.forEach((project) => {
    (pickValues(project) || []).forEach((value) => {
      const normalizedValue = String(value || "").trim();
      if (normalizedValue) {
        values.add(normalizedValue);
      }
    });
  });

  Object.keys(translations).forEach((value) => {
    const normalizedValue = String(value || "").trim();
    if (normalizedValue) {
      values.add(normalizedValue);
    }
  });

  selectedValues.forEach((value) => {
    const normalizedValue = String(value || "").trim();
    if (normalizedValue) {
      values.add(normalizedValue);
    }
  });

  return Array.from(values);
};

export const buildTaxonomySuggestionOptions = (
  values: string[],
  translate: (value: string) => string,
): TaxonomySuggestionOption[] => {
  const uniqueValues = Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );

  return sortByTranslatedLabel(uniqueValues, translate).map((value) => {
    const label = translate(value);
    return {
      value,
      label,
      normalizedValue: normalizeKey(value),
      normalizedLabel: normalizeKey(label),
    };
  });
};

export const buildTaxonomySuggestionLookup = (options: TaxonomySuggestionOption[]) => {
  const lookup = new Map<string, string>();

  options.forEach((option) => {
    if (option.normalizedValue && !lookup.has(option.normalizedValue)) {
      lookup.set(option.normalizedValue, option.value);
    }
    if (option.normalizedLabel && !lookup.has(option.normalizedLabel)) {
      lookup.set(option.normalizedLabel, option.value);
    }
  });

  return lookup;
};

export const filterTaxonomySuggestions = (
  options: TaxonomySuggestionOption[],
  query: string,
  selectedValues: string[],
) => {
  const normalizedQuery = normalizeKey(query);
  if (!normalizedQuery) {
    return [];
  }

  const selectedSet = new Set(selectedValues);
  return options
    .filter(
      (option) =>
        !selectedSet.has(option.value) &&
        (option.normalizedValue.includes(normalizedQuery) ||
          option.normalizedLabel.includes(normalizedQuery)),
    )
    .slice(0, 6);
};

export const resolveTaxonomyInputValue = (input: string, lookup: Map<string, string>) => {
  const trimmedInput = String(input || "").trim();
  if (!trimmedInput) {
    return "";
  }

  return lookup.get(normalizeKey(trimmedInput)) || trimmedInput;
};

type UseProjectEditorTaxonomyParams = {
  formState: ProjectForm;
  genreInput: string;
  genreTranslations: Record<string, string>;
  projects: ProjectRecord[];
  staffRoleTranslations: Record<string, string>;
  tagInput: string;
  tagTranslations: Record<string, string>;
};

export const useProjectEditorTaxonomy = ({
  formState,
  genreInput,
  genreTranslations,
  projects,
  staffRoleTranslations,
  tagInput,
  tagTranslations,
}: UseProjectEditorTaxonomyParams) => {
  const tagTranslationMap = useMemo(() => buildTranslationMap(tagTranslations), [tagTranslations]);
  const genreTranslationMap = useMemo(
    () => buildTranslationMap(genreTranslations),
    [genreTranslations],
  );
  const staffRoleTranslationMap = useMemo(
    () => buildTranslationMap(staffRoleTranslations),
    [staffRoleTranslations],
  );

  const translateEditorTag = useMemo(
    () => (tag: string) => translateTag(tag, tagTranslationMap),
    [tagTranslationMap],
  );
  const translateEditorGenre = useMemo(
    () => (genre: string) => translateGenre(genre, genreTranslationMap),
    [genreTranslationMap],
  );

  const translatedSortedEditorTags = useMemo(
    () => sortByTranslatedLabel(formState.tags, translateEditorTag),
    [formState.tags, translateEditorTag],
  );
  const translatedSortedEditorGenres = useMemo(
    () => sortByTranslatedLabel(formState.genres, translateEditorGenre),
    [formState.genres, translateEditorGenre],
  );

  const knownTagValues = useMemo(
    () =>
      collectKnownTaxonomyValues({
        selectedValues: formState.tags,
        projects,
        translations: tagTranslations,
        pickValues: (project) => project.tags,
      }),
    [formState.tags, projects, tagTranslations],
  );
  const knownGenreValues = useMemo(
    () =>
      collectKnownTaxonomyValues({
        selectedValues: formState.genres,
        projects,
        translations: genreTranslations,
        pickValues: (project) => project.genres,
      }),
    [formState.genres, genreTranslations, projects],
  );

  const tagSuggestionOptions = useMemo(
    () => buildTaxonomySuggestionOptions(knownTagValues, translateEditorTag),
    [knownTagValues, translateEditorTag],
  );
  const genreSuggestionOptions = useMemo(
    () => buildTaxonomySuggestionOptions(knownGenreValues, translateEditorGenre),
    [knownGenreValues, translateEditorGenre],
  );

  const tagSuggestionLookup = useMemo(
    () => buildTaxonomySuggestionLookup(tagSuggestionOptions),
    [tagSuggestionOptions],
  );
  const genreSuggestionLookup = useMemo(
    () => buildTaxonomySuggestionLookup(genreSuggestionOptions),
    [genreSuggestionOptions],
  );

  const tagSuggestions = useMemo(
    () => filterTaxonomySuggestions(tagSuggestionOptions, tagInput, formState.tags),
    [formState.tags, tagInput, tagSuggestionOptions],
  );
  const genreSuggestions = useMemo(
    () => filterTaxonomySuggestions(genreSuggestionOptions, genreInput, formState.genres),
    [formState.genres, genreInput, genreSuggestionOptions],
  );

  return {
    genreTranslationMap,
    genreSuggestions,
    resolveGenreInputValue: (input: string) =>
      resolveTaxonomyInputValue(input, genreSuggestionLookup),
    resolveTagInputValue: (input: string) => resolveTaxonomyInputValue(input, tagSuggestionLookup),
    staffRoleTranslationMap,
    tagTranslationMap,
    tagSuggestions,
    translateEditorGenre,
    translateEditorTag,
    translatedSortedEditorGenres,
    translatedSortedEditorTags,
  };
};

export default useProjectEditorTaxonomy;
