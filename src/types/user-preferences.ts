export type UiListFilterValue =
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean | null>;

export type UiListState = {
  sort?: string;
  page?: number;
  columns?: string[];
  filters?: Record<string, UiListFilterValue>;
};

export type UserPreferences = {
  themeMode?: "light" | "dark" | "system";
  density?: "comfortable" | "compact";
  uiListState?: Record<string, UiListState>;
};

export const emptyUserPreferences: UserPreferences = {
  uiListState: {},
};
