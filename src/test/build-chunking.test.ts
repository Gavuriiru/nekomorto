import { describe, expect, it } from "vitest";

import { classifyManualChunk } from "@/lib/build-chunking";

describe("build chunking classifier", () => {
  it("classifica react-dom como react-core", () => {
    expect(classifyManualChunk("/repo/node_modules/react-dom/client.js")).toBe("react-core");
  });

  it("nao classifica react-router-dom como react-core", () => {
    expect(classifyManualChunk("/repo/node_modules/react-router-dom/index.js")).toBeUndefined();
  });

  it("nao classifica arquivo local do editor lexical first-party", () => {
    expect(
      classifyManualChunk("/repo/src/components/lexical/editor/plugins/ToolbarPlugin/index.tsx"),
    ).toBeUndefined();
  });

  it("classifica @lexical/react como lexical", () => {
    expect(classifyManualChunk("/repo/node_modules/@lexical/react/LexicalComposer.js")).toBe(
      "lexical",
    );
  });

  it("nao classifica viewer lexical publico first-party", () => {
    expect(classifyManualChunk("/repo/src/components/lexical/LexicalViewer.tsx")).toBeUndefined();
  });

  it("nao classifica PlaygroundNodes do editor first-party", () => {
    expect(
      classifyManualChunk("/repo/src/components/lexical/editor/nodes/PlaygroundNodes.ts"),
    ).toBeUndefined();
  });

  it("nao classifica shell e registro first-party do editor", () => {
    expect(classifyManualChunk("/repo/src/components/lexical/LexicalEditorShell.tsx")).toBe(
      undefined,
    );
    expect(classifyManualChunk("/repo/src/components/lexical/editor-nodes.ts")).toBeUndefined();
  });

  it("nao classifica registro de nodes do viewer first-party", () => {
    expect(classifyManualChunk("/repo/src/components/lexical/LexicalViewerNodes.ts")).toBe(
      undefined,
    );
  });

  it("nao classifica normalizacao do viewer first-party", () => {
    expect(classifyManualChunk("/repo/src/lib/lexical/viewer.ts")).toBeUndefined();
  });

  it("nao classifica serializacao do editor first-party", () => {
    expect(classifyManualChunk("/repo/src/lib/lexical/serialize.ts")).toBeUndefined();
  });

  it("nao classifica node read-only do viewer first-party", () => {
    expect(
      classifyManualChunk("/repo/src/components/lexical/viewer-nodes/ViewerEquationNode.tsx"),
    ).toBeUndefined();
  });

  it("nao classifica estado vazio compartilhado first-party", () => {
    expect(classifyManualChunk("/repo/src/lib/lexical/empty-state.ts")).toBeUndefined();
  });

  it("nao classifica node puro de epub first-party", () => {
    expect(classifyManualChunk("/repo/src/components/lexical/nodes/EpubImageNode.tsx")).toBe(
      undefined,
    );
  });

  it("classifica recharts como charts", () => {
    expect(classifyManualChunk("/repo/node_modules/recharts/es6/chart/LineChart.js")).toBe(
      "charts",
    );
  });

  it("nao classifica DashboardAnalytics local", () => {
    expect(classifyManualChunk("/repo/src/pages/DashboardAnalytics.tsx")).toBeUndefined();
  });

  it("nao classifica wrapper local de chart", () => {
    expect(classifyManualChunk("/repo/src/components/ui/chart.tsx")).toBeUndefined();
  });

  it("nao classifica wrapper local de mui date fields", () => {
    expect(classifyManualChunk("/repo/src/components/ui/mui-date-time-fields.tsx")).toBeUndefined();
  });

  it("classifica commonjs helper como react-core", () => {
    expect(classifyManualChunk("\u0000commonjsHelpers.js")).toBe("react-core");
  });

  it("normaliza caminhos Windows", () => {
    expect(
      classifyManualChunk(
        "D:\\dev\\nekomorto\\src\\components\\lexical\\editor\\plugins\\ToolbarPlugin\\index.tsx",
      ),
    ).toBeUndefined();
    expect(
      classifyManualChunk(
        "D:\\dev\\nekomorto\\src\\components\\lexical\\editor\\nodes\\PlaygroundNodes.ts",
      ),
    ).toBeUndefined();
    expect(
      classifyManualChunk("D:\\dev\\nekomorto\\src\\components\\lexical\\LexicalViewerNodes.ts"),
    ).toBeUndefined();
    expect(classifyManualChunk("D:\\dev\\nekomorto\\src\\lib\\lexical\\serialize.ts")).toBe(
      undefined,
    );
    expect(classifyManualChunk("D:\\dev\\nekomorto\\node_modules\\recharts\\index.js")).toBe(
      "charts",
    );
  });
});
