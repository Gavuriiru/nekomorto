export type DashboardProjectsEditorController<T extends Record<string, unknown> = Record<string, unknown>> = T;

export function useDashboardProjectsEditorController<
  T extends Record<string, unknown> = Record<string, unknown>,
>(controller: T): DashboardProjectsEditorController<T> {
  return controller;
}
