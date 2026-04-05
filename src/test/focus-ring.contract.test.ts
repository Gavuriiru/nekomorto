import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoFile = (relativePath: string) => path.resolve(process.cwd(), relativePath);

const dashboardWrappedFormFiles = [
  "src/components/dashboard/DashboardReaderPresetCard.tsx",
  "src/components/dashboard/DashboardSeoRedirectsPanel.tsx",
  "src/pages/DashboardAnalytics.tsx",
  "src/pages/DashboardAuditLog.tsx",
  "src/pages/DashboardComments.tsx",
  "src/pages/DashboardPages.tsx",
  "src/pages/DashboardPosts.tsx",
  "src/pages/DashboardProjectChapterEditor.tsx",
  "src/pages/DashboardProjectEpisodeEditor.tsx",
  "src/pages/DashboardProjectsEditor.tsx",
  "src/pages/DashboardSettings.tsx",
  "src/pages/DashboardUploads.tsx",
  "src/pages/DashboardUsers.tsx",
  "src/pages/DashboardWebhooks.tsx",
];

const publicWrappedFormFiles = [
  "src/components/CommentsSection.tsx",
  "src/components/TopProjectsSection.tsx",
  "src/components/project-reader/PublicProjectReader.tsx",
  "src/pages/Login.tsx",
  "src/pages/Projects.tsx",
];

const focusContractFiles = [
  {
    path: "src/components/ui/button-variants.ts",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/input.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/textarea.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/dropdown-contract.ts",
    expectedTokens: ["focus-visible:ring-1", "focus-visible:ring-primary/45"],
  },
  {
    path: "src/components/ui/checkbox.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/radio-group.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/switch.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/slider.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/toggle-variants.ts",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/tabs.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/input-otp.tsx",
    expectedTokens: ["ring-2", "ring-ring/45"],
  },
  {
    path: "src/components/ui/dialog.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/sheet.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/ui/toast.tsx",
    expectedTokens: ["focus:ring-2", "focus:ring-ring/45"],
  },
  {
    path: "src/components/ui/resizable.tsx",
    expectedTokens: ["focus-visible:ring-1", "focus-visible:ring-ring/55"],
  },
  {
    path: "src/components/ui/color-picker.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/PostContentEditor.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-ring/45"],
  },
  {
    path: "src/components/dashboard/chapter-editor/ChapterEditorStructureSection.tsx",
    expectedTokens: ["focus-visible:ring-2", "focus-visible:ring-primary/45"],
  },
];

const forbiddenFocusTokens = ["ring-offset-background", "ring-offset-2", "ring-offset-1"];

describe("focus ring contract", () => {
  it("removes light offset rings from shared focus primitives", () => {
    focusContractFiles.forEach(({ path: relativePath, expectedTokens }) => {
      const source = readFileSync(repoFile(relativePath), "utf8");

      forbiddenFocusTokens.forEach((token) => {
        expect(source, `${relativePath} should not include ${token}`).not.toContain(token);
      });

      expectedTokens.forEach((token) => {
        expect(source, `${relativePath} should include ${token}`).toContain(token);
      });
    });
  });

  it("suppresses visible outlines on focus jump targets", () => {
    const cssSource = readFileSync(repoFile("src/index.css"), "utf8");

    expect(cssSource).toContain(".a11y-focus-target:focus");
    expect(cssSource).toContain(".a11y-focus-target:focus-visible");
    expect(cssSource).toContain("box-shadow: none;");
    expect(cssSource).toContain("outline: none;");
  });

  it("keeps dashboard form focus overrides aligned with primary", () => {
    const dashboardCssSource = readFileSync(repoFile("src/styles/project-editor.css"), "utf8");
    const dashboardTokensSource = readFileSync(
      repoFile("src/components/dashboard/dashboard-page-tokens.ts"),
      "utf8",
    );
    const dashboardFormControlsSource = readFileSync(
      repoFile("src/components/dashboard/dashboard-form-controls.tsx"),
      "utf8",
    );
    const dashboardPageContainerSource = readFileSync(
      repoFile("src/components/dashboard/DashboardPageContainer.tsx"),
      "utf8",
    );
    const dashboardShellSource = readFileSync(
      repoFile("src/components/DashboardShell.tsx"),
      "utf8",
    );
    const dashboardSettingsSource = readFileSync(
      repoFile("src/pages/DashboardSettings.tsx"),
      "utf8",
    );
    const dashboardWebhooksSource = readFileSync(
      repoFile("src/pages/DashboardWebhooks.tsx"),
      "utf8",
    );
    const muiFieldsSource = readFileSync(
      repoFile("src/components/ui/mui-date-time-fields.tsx"),
      "utf8",
    );

    expect(dashboardCssSource).toContain(".project-editor-dialog");
    expect(dashboardCssSource).toContain(".dashboard-strong-focus-scope");
    expect(dashboardCssSource).toContain(".dashboard-strong-focus-trigger:focus-visible");
    expect(dashboardCssSource).toContain("textarea, select):focus-visible");
    expect(dashboardCssSource).not.toContain('[role="combobox"]');
    expect(dashboardCssSource).toContain("border-color: hsl(var(--primary)) !important;");
    expect(dashboardCssSource).toContain("box-shadow: none !important;");
    expect(dashboardCssSource).not.toContain(
      "box-shadow: inset 0 0 0 2px hsl(var(--primary)) !important;",
    );
    expect(dashboardCssSource).not.toContain(
      "box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.45) !important;",
    );

    expect(dashboardTokensSource).toContain("dashboardStrongFocusFieldClassName =");
    expect(dashboardTokensSource).toContain('"focus-visible:border-primary"');
    expect(dashboardTokensSource).toContain(
      'dashboardStrongSurfaceHoverClassName = "hover:border-primary/60"',
    );
    expect(dashboardTokensSource).toContain(
      'dashboardStrongFocusScopeClassName = "dashboard-strong-focus-scope"',
    );
    expect(dashboardTokensSource).toContain(
      'dashboardStrongFocusTriggerClassName = "dashboard-strong-focus-trigger"',
    );
    expect(dashboardFormControlsSource).toContain("dashboardStrongFocusFieldClassName");
    expect(dashboardFormControlsSource).toContain("<BaseInput");
    expect(dashboardFormControlsSource).toContain("<BaseTextarea");
    expect(dashboardFormControlsSource).toContain("<BaseSelectTrigger");
    expect(dashboardPageContainerSource).toContain("dashboardStrongFocusScopeClassName");
    expect(dashboardShellSource).toContain("dashboardStrongFocusScopeClassName");
    dashboardWrappedFormFiles.forEach((relativePath) => {
      const source = readFileSync(repoFile(relativePath), "utf8");
      expect(source, `${relativePath} should use dashboard form wrappers`).toContain(
        "@/components/dashboard/dashboard-form-controls",
      );
      expect(source, `${relativePath} should not import ui/input directly`).not.toContain(
        "@/components/ui/input",
      );
      expect(source, `${relativePath} should not import ui/textarea directly`).not.toContain(
        "@/components/ui/textarea",
      );
      expect(source, `${relativePath} should not import ui/select directly`).not.toContain(
        "@/components/ui/select",
      );
    });

    expect(dashboardSettingsSource).toContain("dashboardStrongFocusTriggerClassName");
    expect(dashboardSettingsSource).toContain("dashboardStrongFocusFieldClassName");
    expect(dashboardSettingsSource).toContain("dashboardStrongSurfaceHoverClassName");
    expect(dashboardSettingsSource).toContain(
      "panelClassName={dashboardStrongFocusScopeClassName}",
    );
    expect(dashboardWebhooksSource).toContain("dashboardStrongFocusTriggerClassName");
    expect(dashboardWebhooksSource).toContain("dashboardStrongFocusFieldClassName");
    expect(dashboardWebhooksSource).toContain("dashboardStrongSurfaceHoverClassName");
    expect(dashboardWebhooksSource).toContain(
      "panelClassName={dashboardStrongFocusScopeClassName}",
    );

    expect(muiFieldsSource).toContain('borderColor: "hsl(var(--primary))"');
    expect(muiFieldsSource).toContain('"& .MuiInputBase-input"');
    expect(muiFieldsSource).toContain('"&.Mui-disabled": {');
    expect(muiFieldsSource).toContain('WebkitTextFillColor: "hsl(var(--muted-foreground) / 0.72)"');
    expect(muiFieldsSource).toContain('backgroundColor: "hsl(var(--background))"');
    expect(muiFieldsSource).toContain('borderColor: "hsl(var(--input))"');
    expect(muiFieldsSource).not.toContain("opacity: 0.5,");
    expect(muiFieldsSource).not.toContain("boxShadow:");
    expect(muiFieldsSource).not.toContain('boxShadow: "0 0 0 2px hsl(var(--ring))"');
    expect(muiFieldsSource).not.toContain('boxShadow: "inset 0 0 0 2px hsl(var(--primary))"');
    expect(muiFieldsSource).not.toContain('borderColor: "hsl(var(--ring))"');
  });

  it("keeps public form focus overrides aligned with primary", () => {
    const publicTokensSource = readFileSync(
      repoFile("src/components/public-page-tokens.ts"),
      "utf8",
    );
    const dropdownContractSource = readFileSync(
      repoFile("src/components/ui/dropdown-contract.ts"),
      "utf8",
    );
    const publicFormControlsSource = readFileSync(
      repoFile("src/components/public-form-controls.tsx"),
      "utf8",
    );
    const publicPageContainerSource = readFileSync(
      repoFile("src/components/PublicPageContainer.tsx"),
      "utf8",
    );
    const indexCssSource = readFileSync(repoFile("src/index.css"), "utf8");
    const loginSource = readFileSync(repoFile("src/pages/Login.tsx"), "utf8");

    expect(publicTokensSource).toContain("publicStrongFocusFieldClassName =");
    expect(publicTokensSource).toContain(
      '"focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/45 focus-visible:ring-inset"',
    );
    expect(publicTokensSource).toContain(
      'publicStrongSurfaceHoverClassName = "hover:border-primary/60"',
    );
    expect(publicTokensSource).toContain(
      'publicStrongGroupSurfaceHoverClassName = "group-hover:border-primary/60"',
    );
    expect(publicTokensSource).toContain(
      'publicStrongFocusScopeClassName = "public-strong-focus-scope"',
    );
    expect(dropdownContractSource).toContain("dropdownTriggerClassName");
    expect(dropdownContractSource).toContain("focus-visible:border-primary");
    expect(dropdownContractSource).toContain("focus-visible:ring-1");
    expect(dropdownContractSource).toContain("focus-visible:ring-primary/45");
    expect(dropdownContractSource).toContain("focus-visible:ring-inset");
    expect(dropdownContractSource).toContain("dropdownPopoverClassName");
    expect(dropdownContractSource).toContain("dropdownItemClassName");

    expect(publicFormControlsSource).toContain("publicStrongFocusFieldClassName");
    expect(publicFormControlsSource).toContain("<BaseInput");
    expect(publicFormControlsSource).toContain("<BaseTextarea");
    expect(publicFormControlsSource).toContain("<BaseSelectTrigger");

    expect(publicPageContainerSource).toContain("publicStrongFocusScopeClassName");
    expect(indexCssSource).toContain(".public-strong-focus-scope");
    expect(indexCssSource).toContain("border-color: hsl(var(--primary)) !important;");
    expect(indexCssSource).toContain(
      "box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.45) !important;",
    );

    publicWrappedFormFiles.forEach((relativePath) => {
      const source = readFileSync(repoFile(relativePath), "utf8");
      expect(source, `${relativePath} should use public form wrappers`).toContain(
        "@/components/public-form-controls",
      );
      if (relativePath !== "src/pages/Login.tsx") {
        expect(source, `${relativePath} should not import ui/input directly`).not.toContain(
          "@/components/ui/input",
        );
        expect(source, `${relativePath} should not import ui/textarea directly`).not.toContain(
          "@/components/ui/textarea",
        );
        expect(source, `${relativePath} should not import ui/select directly`).not.toContain(
          "@/components/ui/select",
        );
      }
    });

    expect(loginSource).toContain("<Input");
    expect(loginSource).not.toContain("<input");
    expect(readFileSync(repoFile("src/pages/Projects.tsx"), "utf8")).toContain(
      "dropdownTriggerClassName",
    );
    expect(readFileSync(repoFile("src/pages/Projects.tsx"), "utf8")).toContain(
      "dropdownItemClassName",
    );
  });
});
