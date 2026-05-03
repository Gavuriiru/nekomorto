import { describe, expect, it } from "vitest";

import { classifyManualChunk } from "@/lib/build-chunking";

describe("build chunking classifier", () => {
  it("classifica react-dom como react-core", () => {
    expect(classifyManualChunk("/repo/node_modules/react-dom/client.js")).toBe("react-core");
  });

  it("nao classifica react-router-dom como react-core", () => {
    expect(classifyManualChunk("/repo/node_modules/react-router-dom/index.js")).toBeUndefined();
  });

  it("classifica arquivo local do editor lexical first-party como lexical-editor", () => {
    expect(
      classifyManualChunk("/repo/src/components/lexical/editor/plugins/ToolbarPlugin/index.tsx"),
    ).toBe("lexical-editor");
  });

  it("classifica @lexical/react como lexical", () => {
    expect(classifyManualChunk("/repo/node_modules/@lexical/react/LexicalComposer.js")).toBe(
      "lexical",
    );
  });

  it("classifica viewer lexical publico como lexical-viewer", () => {
    expect(classifyManualChunk("/repo/src/components/lexical/LexicalViewer.tsx")).toBe(
      "lexical-viewer",
    );
  });

  it("classifica PlaygroundNodes do editor como lexical-editor", () => {
    expect(
      classifyManualChunk("/repo/src/components/lexical/editor/nodes/PlaygroundNodes.ts"),
    ).toBe("lexical-editor");
  });

  it("classifica shell e perfil first-party do editor como lexical-editor", () => {
    expect(classifyManualChunk("/repo/src/components/lexical/LexicalEditorShell.tsx")).toBe(
      "lexical-editor",
    );
    expect(classifyManualChunk("/repo/src/components/lexical/editor-nodes.ts")).toBe(
      "lexical-editor",
    );
  });

  it("classifica registro de nodes do viewer como lexical-viewer", () => {
    expect(classifyManualChunk("/repo/src/components/lexical/LexicalViewerNodes.ts")).toBe(
      "lexical-viewer",
    );
  });

  it("classifica normalizacao do viewer como lexical-viewer", () => {
    expect(classifyManualChunk("/repo/src/lib/lexical/viewer.ts")).toBe("lexical-viewer");
  });

  it("classifica serializacao do editor como lexical-editor", () => {
    expect(classifyManualChunk("/repo/src/lib/lexical/serialize.ts")).toBe("lexical-editor");
  });

  it("classifica node read-only do viewer como lexical-viewer", () => {
    expect(
      classifyManualChunk("/repo/src/components/lexical/viewer-nodes/ViewerEquationNode.tsx"),
    ).toBe("lexical-viewer");
  });

  it("classifica estado vazio compartilhado como lexical", () => {
    expect(classifyManualChunk("/repo/src/lib/lexical/empty-state.ts")).toBe("lexical");
  });

  it("classifica node puro de epub como lexical", () => {
    expect(classifyManualChunk("/repo/src/components/lexical/nodes/EpubImageNode.tsx")).toBe(
      "lexical",
    );
  });

  it("classifica @mui/x-date-pickers como mui-date-time-fields", () => {
    expect(classifyManualChunk("/repo/node_modules/@mui/x-date-pickers/DatePicker/index.js")).toBe(
      "mui-date-time-fields",
    );
  });

  it("classifica @mui/material como mui", () => {
    expect(classifyManualChunk("/repo/node_modules/@mui/material/Button/index.js")).toBe("mui");
  });

  it("classifica react-transition-group como mui", () => {
    expect(classifyManualChunk("/repo/node_modules/react-transition-group/esm/Transition.js")).toBe(
      "mui",
    );
  });

  it("classifica recharts como charts", () => {
    expect(classifyManualChunk("/repo/node_modules/recharts/es6/chart/LineChart.js")).toBe(
      "charts",
    );
  });

  it("classifica DashboardAnalytics local como charts", () => {
    expect(classifyManualChunk("/repo/src/pages/DashboardAnalytics.tsx")).toBe("charts");
  });

  it("classifica wrapper local de chart como charts", () => {
    expect(classifyManualChunk("/repo/src/components/ui/chart.tsx")).toBe("charts");
  });

  it("classifica wrapper local de mui date fields como mui-date-time-fields", () => {
    expect(classifyManualChunk("/repo/src/components/ui/mui-date-time-fields.tsx")).toBe(
      "mui-date-time-fields",
    );
  });

  it("classifica commonjs helper como react-core", () => {
    expect(classifyManualChunk("\u0000commonjsHelpers.js")).toBe("react-core");
  });

  it("normaliza caminhos Windows", () => {
    expect(
      classifyManualChunk(
        "D:\\dev\\nekomorto\\src\\components\\lexical\\editor\\plugins\\ToolbarPlugin\\index.tsx",
      ),
    ).toBe("lexical-editor");
    expect(
      classifyManualChunk(
        "D:\\dev\\nekomorto\\src\\components\\lexical\\editor\\nodes\\PlaygroundNodes.ts",
      ),
    ).toBe("lexical-editor");
    expect(
      classifyManualChunk("D:\\dev\\nekomorto\\src\\components\\lexical\\LexicalViewerNodes.ts"),
    ).toBe("lexical-viewer");
    expect(classifyManualChunk("D:\\dev\\nekomorto\\src\\lib\\lexical\\serialize.ts")).toBe(
      "lexical-editor",
    );
    expect(
      classifyManualChunk("D:\\dev\\nekomorto\\node_modules\\@mui\\x-date-pickers\\index.js"),
    ).toBe("mui-date-time-fields");
  });
});
