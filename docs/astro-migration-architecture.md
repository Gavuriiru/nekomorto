# Migracao React/Vite -> Astro

Documento operacional do desenho tecnico atual da migracao da superficie publica do
Nekomorto para Astro, atualizado para o estado real do repositorio em 2026-05-19 apos o
fechamento do router publico da Fase 3.

## 1. Objetivo

Mover a superficie publica indexavel para um modelo Astro `server-first`, mantendo:

- Express como runtime principal;
- PostgreSQL/Prisma como fonte de verdade;
- dashboard, login e reader como fronteiras React controladas.

## 2. Estado arquitetural atual

O repositorio esta em estado **hibrido controlado**:

- `server/index.js` continua sendo o bootstrap principal da aplicacao;
- `dist-astro/` serve o slice Astro publico;
- `dist/` continua servindo app React, dashboard e islands;
- o SSR/prerender publico legado nao faz mais parte do build oficial;
- o service worker legado nao faz mais parte do runtime suportado.

## 3. Ownership atual de rotas

### Astro puro

- `/termos-de-uso`
- `/politica-de-privacidade`
- `/sobre`
- `/faq`
- `/equipe`
- `/doacoes`
- `/recrutamento`

### Astro + island React dedicada

- `/`
- `/projetos`
- `/projeto/[slug]`
- `/postagem/[slug]`
- `/login`

### Astro shell + React app

- `/dashboard/**`
- `/projeto/[slug]/leitura/[chapter]`

## 4. Slice Astro existente

### Layouts

- `src-astro/layouts/PublicLayout.astro`
- `src-astro/layouts/ReadingLayout.astro`
- `src-astro/layouts/DashboardHostLayout.astro`

### Pages

- `src-astro/pages/index.astro`
- `src-astro/pages/projetos/index.astro`
- `src-astro/pages/projeto/[slug].astro`
- `src-astro/pages/projeto/[slug]/leitura/[chapter].astro`
- `src-astro/pages/postagem/[slug].astro`
- `src-astro/pages/login.astro`
- `src-astro/pages/dashboard/[...slug].astro`
- paginas institucionais e legais em `src-astro/pages/*.astro`

### React islands atuais

- `src-astro/components/react/HomeIslandApp.tsx`
- `src-astro/components/react/ProjectsIslandApp.tsx`
- `src-astro/components/react/ProjectIslandApp.tsx`
- `src-astro/components/react/PostIslandApp.tsx`
- `src-astro/components/react/LoginIslandApp.tsx`
- `src-astro/components/react/DashboardIslandApp.tsx`
- `src-astro/components/react/ProjectReadingIslandApp.tsx`

Observacao:

- `Phase3PublicAppShell.tsx` nao faz mais parte da arquitetura atual.
- o chrome publico e as rotas indexaveis nao dependem mais de `react-router-dom`.

## 5. Contrato de dados

O caminho oficial continua sendo `Astro.locals.nekomata`.

O Astro recebe do backend, conforme a rota:

- `siteSettings`
- `pages`
- `primaryAppOrigin`
- `routePayload`
- `publicBootstrap` quando a rota ainda depende do snapshot publico

Regra:

- nao recriar `window.__BOOTSTRAP_*` como contrato principal das rotas publicas Astro.

## 6. Legado ja removido

### SSR/prerender publico

Ja nao faz parte do pipeline oficial:

- `build:public:ssr`
- `prerender:public`
- `server/lib/public-prerender-runtime.js`
- `src/ssr/public-app.tsx`

### Fase 3 compartilhada

Ja nao faz parte da arquitetura atual:

- `src-astro/components/react/PublicPhase3IslandApp.tsx`

### Pipeline legado de service worker

Ja nao faz parte do runtime suportado:

- `scripts/build-pwa.mjs`
- `src/lib/pwa-cleanup.ts`
- `src/lib/pwa-register.ts`
- `src/lib/pwa-bootstrap.ts`
- suporte a `/sw.js`
- suporte a `workbox-*`

Observacao:

- `manifest.webmanifest` e assets em `/pwa/**` continuam como assets publicos, mas nao
  implicam mais um service worker suportado pelo build atual.

### Enclave MUI/Emotion dos campos de data/hora

Ja foi substituido por campos nativos em:

- `src/components/ui/mui-date-time-fields.tsx`

Impacto:

- `@mui/material`, `@mui/x-date-pickers`, `@emotion/react` e `@emotion/styled`
  sairam do caminho de runtime desses fluxos;
- o chunking manual para MUI deixou de fazer sentido e foi removido.

## 7. Limites atuais

O fechamento de ownership e roteamento publico foi concluido.

### O que ainda continua hibrido

- `/`, `/projetos`, `/projeto/[slug]` e `/postagem/[slug]` continuam com islands de
  pagina inteira.
- `usePageMeta` e parte do ecossistema publico React ainda existem no repositorio para
  a camada que nao foi convertida para Astro puro.

### O que permanece React por decisao arquitetural

- `/dashboard/**`
- `/login`
- `/projeto/[slug]/leitura/[chapter]`
- comments, widgets de sessao, busca rica e componentes dependentes de browser APIs

## 8. Runtime alvo

### Astro deve ser owner final de

- documento HTML;
- `head`, canonical, robots, OG e schema;
- paginas publicas indexaveis;
- layout publico e componentes server-first.

### React deve permanecer apenas em

- dashboard;
- login;
- reader;
- widgets realmente interativos do publico.

### Alvo de fronteira

`react-router-dom` deve ficar restrito a:

- `/dashboard/**`
- `/login`
- `/projeto/[slug]/leitura/[chapter]`

## 9. Chunking e dependencias

### Chunking manual ainda valido

- `lexical`
- `charts`
- `react-core`

### Chunking removido

- `mui`
- `mui-date-time-fields`

### Dependencias removiveis ou ja removidas no fechamento atual

- `@mui/material`
- `@mui/x-date-pickers`
- `@emotion/react`
- `@emotion/styled`
- `tw-animate-css`
- `@tanstack/react-query`
- `@tailwindcss/typography`
- `workbox-build`

### Dependencias que continuam justificadas

- `react-day-picker`
- `framer-motion`
- `recharts`
- stack Lexical

## 10. Regras operacionais

### Regra de rollout

Continuar migrando por rota ou por widget, nunca por big bang.

### Regra de hidratacao

Default:

- zero JS

Aceitavel:

- islands pequenas e isoladas

Evitar:

- page-wide island por conveniencia
- reintroduzir SPA shell publica

### Regra de rollback

Cada mudanca deve permitir rollback simples:

- remover o ownership Astro da rota ou da island local;
- deixar o fallback atual reassumir.

## 11. Validacao

Minimo para qualquer fatia:

```bash
npm run lint
npm run typecheck
npm run build
```

Quando tocar o servidor:

```bash
npx vitest run src/server/register-astro-routes.test.ts src/server/register-app-routes.test.ts src/server/public-paths.test.ts src/server/register-runtime-middleware.test.ts
```

Quando tocar as rotas publicas principais:

```bash
npm run lighthouse:home:mobile
npm run lighthouse:projects:mobile
npm run lighthouse:public-surface
```

## 12. Ponto exato para retomar

Se houver continuidade tecnica nesse tema, ela deixa de ser migracao obrigatoria e passa a ser
otimizacao:

1. mover widgets isolados de `/`, `/projetos`, `/projeto/[slug]` e `/postagem/[slug]` para
   ilhas menores ou Astro server-first quando houver ganho claro;
2. revisar preload, chunking e custo de hidratacao;
3. manter React apenas nos widgets realmente interativos.
