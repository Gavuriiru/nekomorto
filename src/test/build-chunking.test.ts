import { describe, expect, it } from "vitest";

import { classifyManualChunk } from "@/lib/build-chunking";

describe("build chunking classifier", () => {
  it("classifica react-dom como react-core", () => {
    expect(classifyManualChunk("/repo/node_modules/react-dom/client.js")).toBe("react-core");
  });

  it("nao classifica react-router-dom como react-core", () => {
    expect(classifyManualChunk("/repo/node_modules/react-router-dom/index.js")).toBeUndefined();
  });

  it("classifica arquivo local do lexical playground como lexical", () => {
    expect(classifyManualChunk("/repo/src/lexical-playground/plugins/ToolbarPlugin/index.tsx")).toBe(
      "lexical",
    );
  });

  it("classifica @lexical/react como lexical", () => {
    expect(classifyManualChunk("/repo/node_modules/@lexical/react/LexicalComposer.js")).toBe(
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
      classifyManualChunk("D:\\dev\\nekomorto\\src\\lexical-playground\\plugins\\ToolbarPlugin\\index.tsx"),
    ).toBe("lexical");
    expect(classifyManualChunk("D:\\dev\\nekomorto\\node_modules\\@mui\\x-date-pickers\\index.js")).toBe(
      "mui-date-time-fields",
    );
  });
});
