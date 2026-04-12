import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const mojibakeGuardFiles = [
  "src/pages/Projects.tsx",
  "src/pages/Donations.tsx",
  "src/pages/DashboardPages.tsx",
  "src/pages/DashboardProjectsEditor.tsx",
  "src/pages/DashboardUploads.tsx",
  "src/components/project-reader/PublicProjectReader.tsx",
  "server/lib/site-settings-runtime-helpers.js",
  "server/lib/public-site-runtime.js",
  "server/lib/post-version-runtime.js",
  "server/lib/project-epub-import-request.js",
];

const knownBadFragmentsByFile: Array<{
  path: string;
  fragments: string[];
}> = [
  {
    path: "src/pages/Dashboard.tsx",
    fragments: ["Falha ao exportar relatorio", "Exportar relatorio"],
  },
  {
    path: "src/pages/DashboardProjectsEditor.tsx",
    fragments: ["conte?do"],
  },
  {
    path: "src/components/project-reader/PublicProjectReader.tsx",
    fragments: ["PrÃ©via limitada", "A prÃ©via termina aqui", "Este capÃ­tulo tem"],
  },
  {
    path: "src/pages/DashboardSecurity.tsx",
    fragments: [
      "Nao foi possivel carregar a lista de sessoes ativas.",
      "Atualizando sessoes",
      "ultimas sessoes",
      ' sessao de ${session.userName || session.userId || "usuario"}',
    ],
  },
  {
    path: "src/pages/DashboardPosts.tsx",
    fragments: ["Confira a conexao"],
  },
  {
    path: "src/pages/DashboardUploads.tsx",
    fragments: [
      "arquivos de variante orfaos",
      "diretorios de variantes orfaos",
      "recuperaveis no total",
      "Nenhuma area encontrada no inventario.",
      "Aguardando analise",
    ],
  },
  {
    path: "src/pages/Project.tsx",
    fragments: ["capitulos disponiveis"],
  },
  {
    path: "src/pages/Projects.tsx",
    fragments: ["GÃªneros"],
  },
  {
    path: "src/pages/Donations.tsx",
    fragments: ["M?s/Ano", "Copiar endereco", "Observacoes"],
  },
  {
    path: "src/pages/DashboardPages.tsx",
    fragments: [
      "Titulo da secao",
      "Subtitulo",
      "servico tiver nome e endereco",
      "Nome do servico",
      "Rotulo da acao externa",
      "Endereco para copia",
      "URL da acao externa",
      "Icone padrao",
      "Preview da pagina publica",
      "Servico sem nome",
      "na pagina publica.",
    ],
  },
  {
    path: "server/lib/site-settings-runtime-helpers.js",
    fragments: ["DoaÃ§Ãµes", "Links Ãºteis", "AtribuiÃ§Ã£o â€¢ NÃ£o Comercial"],
  },
  {
    path: "server/lib/public-site-runtime.js",
    fragments: ["CapÃ­tulo", "AtualizaÃ§Ã£o", "lanÃ§amento"],
  },
  {
    path: "server/lib/post-version-runtime.js",
    fragments: ["Sem tÃƒÂ­tulo", "CriaÃƒÂ§ÃƒÂ£o", "AtualizaÃƒÂ§ÃƒÂ£o"],
  },
  {
    path: "src/components/dashboard/chapter-editor/ChapterEditorPane.tsx",
    fragments: ["Distribuicao"],
  },
  {
    path: "src/components/dashboard/project-editor/useDashboardProjectsEditorAnimeBatch.ts",
    fragments: ["duracao em lote", "Deslocamento invalido", "Episodios criados"],
  },
];

const mojibakePattern = /(?:\u00C3.|\u00E2.|\uFFFD)/;

describe("ui copy portuguese regressions", () => {
  it("nao reintroduz mojibake nas telas corrigidas", () => {
    mojibakeGuardFiles.forEach((relativePath) => {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const source = readFileSync(absolutePath, "utf8");
      expect(source, `mojibake detectado em ${relativePath}`).not.toMatch(mojibakePattern);
    });
  });

  it("nao reintroduz fragmentos quebrados conhecidos", () => {
    knownBadFragmentsByFile.forEach(({ path: relativePath, fragments }) => {
      const absolutePath = path.resolve(process.cwd(), relativePath);
      const source = readFileSync(absolutePath, "utf8");

      fragments.forEach((fragment) => {
        expect(
          source,
          `fragmento regressivo detectado em ${relativePath}: ${fragment}`,
        ).not.toContain(fragment);
      });
    });
  });
});
