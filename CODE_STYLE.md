# Guia de Estilo de Código - Nekomorto

Este documento define os padrões de codificação para manter a consistência e a legibilidade em todo o projeto.

## 1. Regras Gerais

- **Indentação**: 2 espaços.
- **Ponto e Vírgula**: Sempre obrigatório.
- **Aspas**: Aspas duplas (`"`) para strings e JSX.
- **Line Width**: Máximo de 100 caracteres.
- **EOL**: LF.

Estes padrões são validados automaticamente pelo **Biome**.

## 2. Nomenclatura

- **Variáveis e Funções**: `camelCase` (ex: `const activeUser = ...`).
- **Componentes React**: `PascalCase` (ex: `function ProjectCard()`).
- **Interfaces e Tipos**: `PascalCase` (ex: `interface UserProfile`).
- **Arquivos**:
  - Componentes: `PascalCase.tsx` (ex: `ProjectCard.tsx`).
  - Hooks: `use-kebab-case.ts` (ex: `use-site-settings.ts`).
  - Providers/Contexts: `kebab-case.tsx` (ex: `theme-mode-provider.tsx`).
  - Utilitários: `kebab-case.ts`.
- **Constantes de Configuração**: `SCREAMING_SNAKE_CASE` (ex: `const MAX_UPLOAD_SIZE = ...`).

## 3. React e Frontend

- **Componentes Funcionais**: Utilize apenas componentes funcionais. Prefira `const MyComp = () => ...` ou `function MyComp()`.
- **Props**: Sempre defina interfaces para as props.
- **Early Returns**: Utilize early returns para tratar estados de erro ou carregamento e evitar aninhamento excessivo.
  ```tsx
  if (isLoading) return <Loading />;
  if (!data) return <NotFound />;
  return <Content />;
  ```
- **Hooks**:
  - Deixe os hooks no topo do componente.
  - No `useEffect`, sempre forneça um array de dependências completo.
- **Tailwind CSS**:
  - Evite estilos ad-hoc ou inline style.
  - Utilize `cn()` (clsx + tailwind-merge) para classes condicionais.
- **Caminhos**: Sempre utilize o alias `@/` para importar arquivos de dentro de `src/`.

## 4. TypeScript

- **Tipagem**: Evite ao máximo o uso de `any`. Utilize `unknown` ou defina o tipo explicitamente.
- **Interfaces vs Types**: Prefira `interface` para definições de objetos e props (por performance e extensibilidade). Utilize `type` apenas para uniões ou tipos complexos.
- **Imports**: Mantenha os imports organizados por "blocos":
  1. Bibliotecas externas (React, Radix, etc).
  2. Hooks/Providers internos.
  3. Componentes internos.
  4. Estilos/Assets.

## 5. Backend (Node.js/Express)

- **Prisma**: Toda interação com o banco de dados deve ser feita exclusivamente via Prisma Client.
- **Tratamento de Erros**:
  - Utilize blocos `try/catch` em todas as rotas e repasse os erros para o middleware de erro.
  - Jamais exponha stack traces ou detalhes do banco em respostas de produção.
- **Governança e Segurança**: Siga rigorosamente a carta operacional em [AGENTS.md](AGENTS.md), com atenção especial à seção de segurança obrigatória.

---

Ao contribuir, verifique se seu código segue estes padrões executando `npm run lint` e `npm run format`.
