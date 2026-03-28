import type { ProjectForm } from "./dashboard-projects-editor-types";

export const buildProjectEditorSnapshot = (form: ProjectForm, anilistIdInput: string) =>
  JSON.stringify({
    form,
    anilistIdInput: String(anilistIdInput || "").trim(),
  });

export default buildProjectEditorSnapshot;
