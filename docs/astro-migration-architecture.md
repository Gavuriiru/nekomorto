# Migracao React/Vite -> Astro

Documento operacional da migracao da superficie publica do Nekomorto para Astro.
O objetivo aqui nao e justificar a decisao de produto; e registrar o desenho tecnico,
as restricoes reais do repositorio e as regras que permitem continuar a migracao em
dias diferentes sem perder contexto.

## 1. Objetivo

Migrar a superficie publica indexavel para Astro `server-first`, reduzindo a
dependencia de SPA global, bootstrap manual, prerender incremental e compensacoes
de SEO, sem reescrever backend, auth, uploads, dashboard ou reader no primeiro ciclo.

## 2. Diagnostico central

A superficie publica ja tenta agir como site server-first, mas hoje isso e obtido
por camadas compensatorias empilhadas sobre uma SPA React:

- `BrowserRouter` global que decide em runtime entre publico e dashboard
- `window.__BOOTSTRAP_*` com modos `critical-home`, `shell` e `full`
- `seo-snapshot` escondido para crawlers
- renderer SSR paralelo ao build principal
- prerender via boot do proprio servidor
- `vite:preloadError` recovery
- chunking manual para isolar lexical, charts, MUI e react-core
- metadata duplicada entre servidor, `usePageMeta` e `SiteSettingsProvider`

A recomendacao principal e migrar a superficie publica indexavel para Astro
server-first, manter o dashboard como app React isolada e preservar React islands
apenas onde a interatividade e estrutural.

## 3. Estado atual do repositorio

Hoje o projeto esta em modo **hibrido**:

- o backend continua sendo Node/Express em `server/index.js`
- o frontend legado continua em React/Vite
- o build legado continua produzindo `dist/`
- o renderer SSR paralelo continua em `dist-ssr/public/renderer.mjs`
- a nova camada Astro ja produz `dist-astro/`
- em producao, o Express agora consegue servir um primeiro slice Astro

### 3.1 Slice Astro ja implantado

Rotas atualmente servidas pelo Astro:

- `/`
- `/projetos`
- `/projeto/[slug]`
- `/postagem/[slug]`
- `/projeto/[slug]/leitura/[chapter]`
- `/login`
- `/dashboard/**`
- `/sobre`
- `/faq`
- `/equipe`
- `/doacoes`
- `/recrutamento`
- `/termos-de-uso`
- `/politica-de-privacidade`

Essas rotas usam:

- `src-astro/layouts/PublicLayout.astro`
- `src-astro/pages/*.astro` (7 paginas)
- `src-astro/components/PublicPageHero.astro`
- `src-astro/lib/public-layout.ts` e `public-page-meta.ts`
- `server/lib/astro-public-runtime.js`
- `server/routes/register-astro-routes.js`

### 3.2 O que continua legado

- island React compartilhada da Fase 3 para home, catalogo e detalhes de conteudo
- core React do reader (`ProjectReading.tsx`, `PublicProjectReader`, `LexicalViewer`, comments)
- bootstrap publico global (`window.__BOOTSTRAP_*`)
- prerender incremental legado (`public-prerender-runtime.js`)
- renderer SSR publico legado (`build-public-ssr.mjs`)
- SEO snapshot para crawlers (`public-seo-snapshot.js`)
- preload recovery (`vite-preload-recovery.ts`)

### 3.3 Arquivos-chave da arquitetura legada

| Arquivo | Funcao |
| --- | --- |
| `src/main.tsx` | monta React sempre |
| `src/App.tsx` | `BrowserRouter`, decide publico vs dashboard |
| `src/routes/public-route-tree.tsx` | arvore de rotas publicas React Router |
| `src/routes/DashboardRoutes.tsx` | arvore de rotas do dashboard |
| `server/routes/register-site-routes.js` | Express: meta/bootstrap para rotas de conteudo |
| `server/routes/register-app-routes.js` | Express: catch-all do app legado |
| `server/lib/html-bootstrap.js` | injeta `__BOOTSTRAP_*` no HTML |
| `server/lib/public-seo-snapshot.js` | gera snapshot SEO escondido |
| `server/lib/public-prerender-runtime.js` | prerender incremental via SSR |
| `src/hooks/use-public-bootstrap.ts` | hook React que consome bootstrap global |
| `src/lib/vite-preload-recovery.ts` | recovery de `vite:preloadError` |
| `src/lib/build-chunking.ts` | chunking manual (lexical, charts, MUI, react-core) |
| `server/lib/meta-html.js` | gera `<head>` com meta/OG/schema |
| `scripts/build-public-ssr.mjs` | build do renderer SSR paralelo |
| `scripts/prerender-public.mjs` | prerender por script |

## 4. Divida tecnica a eliminar

Gambiarras compensatorias que devem ser removidas ao longo da migracao:

| Divida | Arquivo(s) | Fase de remocao |
| --- | --- | --- |
| `window.__BOOTSTRAP_PUBLIC__`, `__SETTINGS__`, `__PROMISE__` | `html-bootstrap.js`, `use-public-bootstrap.ts` | Fase 6 |
| SEO snapshot escondido para crawlers | `public-seo-snapshot.js` | Fase 6 |
| SSR publico separado do build principal | `build-public-ssr.mjs`, `dist-ssr/` | Fase 6 |
| Prerender via boot do proprio servidor | `prerender-public.mjs`, `public-prerender-runtime.js` | Fase 6 |
| `vite:preloadError` recovery no publico | `vite-preload-recovery.ts` | Fase 6 |
| Chunking manual para isolar deps pesadas | `build-chunking.ts` | Fase 7 |
| PWA cleanup legado (nao e PWA funcional) | `build-pwa.mjs` | Fase 7 |
| Metadata duplicada: servidor + `usePageMeta` + `SiteSettingsProvider` | multiplos | progressiva |
| `robots.txt` com sitemap hardcoded | `register-app-routes.js` | Fase 2 |

## 5. Avaliacao de complexidade

Complexidade alta, mas nao critica, porque backend, banco, auth e deploy podem
permanecer inalterados.

| Fator | Peso | Justificativa |
| --- | --- | --- |
| Roteamento publico duplicado | Alto | React Router + registries + Express catch-all |
| SSR/SEO custom | Alto | seo-snapshot, bootstrap modes, prerender runtime |
| Reader interativo | Alto | manga/light novel tem estado e preferencias intensas |
| Dashboard autenticado | Medio | pode ficar isolado em React |
| Styling heterogeneo | Medio | Tailwind base e boa, MUI/Emotion e excecao |
| Backend Express/Prisma | Baixo | pode ser preservado |

## 6. Compatibilidade com Astro

### Funciona quase imediatamente

- paginas institucionais, legais, FAQ, equipe, doacoes (ja migradas)
- shell de home, shell de projetos, shell de projeto/post
- sitemap, robots, RSS
- head/meta/schema

### Requer adaptacao

- tema global e CSS variables
- uploads dinamicos e media variants
- comments, busca, filtros avancados
- OG dinamica
- login

### Requer rewrite

- roteamento publico React Router
- `usePageMeta`
- `seo-snapshot`
- `public-prerender-runtime`
- preload recovery
- bootstrap parcial (`critical-home`/`shell`/`full`)

### Permanecer incompativel com "Astro puro"

- dashboard inteiro
- reader de manga/webtoon
- Lexical editor/viewer
- widgets que dependem de localStorage, observers ou Shadow DOM

## 7. Estrategia de preservacao do React

### Manter React

- `/dashboard/**` inteiro, montado numa entrada Astro catch-all
- `/login` como widget React SSR + `client:load`
- `/projeto/[slug]/leitura/[chapter]` manga como island React principal
- light novel reader hibrido: HTML server-rendered, navegacao/comments/polls como islands
- Lexical editor, Lexical viewer interativo
- comments, header search, theme switcher, cropper, drawers/popovers

### Nao manter React onde nao agrega

- layout publico, footer/header base
- cards de projeto/post, `WorkStatusCard`
- paginas legais/institucionais (ja migradas)
- head/meta/structured data

## 8. Diretrizes de arquitetura

### 8.1 Principio central

Astro assume a composicao de documento e HTML das rotas publicas indexaveis.
React deixa de ser o shell obrigatorio da superficie publica e passa a ser usado
onde interatividade rica ainda e estrutural.

### 8.2 O que nao muda nesta migracao

- PostgreSQL continua sendo a fonte unica de verdade
- Prisma continua sendo a camada de acesso a dados
- Express continua sendo o runtime principal
- API, auth, uploads, webhooks, analytics e OG continuam no backend atual
- dashboard continua em React
- reader de manga/light novel continua sendo problema separado

### 8.3 Estrategia de coexistencia

Durante boa parte da migracao, duas pilhas coexistem:

- **pilha nova**: Astro para rotas publicas selecionadas
- **pilha legada**: React/Vite + bootstrap + SSR/prerender atuais para todo o resto

Essa convivencia e intencional. Nao e objetivo apagar o pipeline legado cedo demais.

## 9. Runtime alvo por camada

### 9.1 Express

Responsabilidades:

- servir API, auth, uploads, OG e runtime operacional
- montar assets estaticos de `dist/`, `dist-ssr/` e `dist-astro/`
- despachar rotas Astro antes do catch-all legado quando a rota ja foi migrada
- manter fallback seguro para o app legado enquanto a migracao nao termina

### 9.2 Astro

Responsabilidades:

- montar HTML server-first da superficie publica migrada
- declarar `head`, canonical, robots, OG e Twitter meta sem `usePageMeta`
- receber `siteSettings` e `pages` do servidor por `Astro.locals`
- usar zero-JS por padrao; hidratar apenas onde realmente houver necessidade

### 9.3 React

Responsabilidades futuras na arquitetura final:

- dashboard inteiro
- login, se continuar com fluxo altamente interativo
- comments, busca rica e widgets especificos
- reader
- Lexical editor/viewer

## 10. Rendering Strategy Matrix

| Rota | Estrategia | Hidratacao | Racional |
| --- | --- | --- | --- |
| `/` | SSR inicial; SSG futuro opcional | HeroSection `client:load`, extras `client:idle` | home muda e depende de bootstrap parcial |
| `/projetos` | SSR | filtros `client:idle` | mover filtros/querystring para servidor |
| `/projeto/[slug]` | SSR | comments `client:visible` | conteudo SEO-heavy, pouca interacao |
| `/postagem/[slug]` | SSR | comments/embed/polls `client:visible` | post e conteudo, nao SPA |
| `/projeto/[slug]/leitura/[chapter]` manga | SSR shell | reader `client:load` | fluxo altamente interativo |
| `/projeto/[slug]/leitura/[chapter]` light novel | SSR | navegacao/comments/polls como islands | conteudo pode sair pronto |
| `/sobre`, `/faq`, `/recrutamento`, `/equipe`, `/doacoes` | SSR agora; SSG depois | minimo ou zero | ja migradas, candidatas fortes a Astro puro |
| `/termos-de-uso`, `/politica-de-privacidade` | SSG preferencial | zero | conteudo estavel, ja migradas |
| `/login` | SSR | widget `client:load` | auth interativa, noindex |
| `/dashboard/**` | Astro shell + React app | app React unica | risco minimo, reaproveitamento maximo |

## 11. Islands Architecture Plan

| Diretiva | Uso | Exemplos |
| --- | --- | --- |
| Puro Astro | layout, header/footer base, cards, metadata, schema, paginas institucionais/legais | `PublicLayout`, `Footer`, `WorkStatusCard`, grids |
| `client:visible` | widgets abaixo da dobra | `CommentsSection`, `TopProjectsSection`, QR tabs de doacoes |
| `client:idle` | funcionalidade nao-critica | filtros de `/projetos`, toasts, preloads, menus secundarios |
| `client:load` | interatividade imediata | login, hero carousel, manga reader |
| `client:only` | React sem SSR | dashboard React inteiro se SSR nao trouxer valor |

Regra: evitar `client:load` fora de reader/login/hero.

## 12. Ownership de rotas

### 12.1 Ownership atual

| Grupo | Runtime atual |
| --- | --- |
| `/sobre` | Astro |
| `/faq` | Astro |
| `/equipe` | Astro |
| `/doacoes` | Astro |
| `/recrutamento` | Astro |
| `/termos-de-uso` | Astro |
| `/politica-de-privacidade` | Astro |
| `/dashboard/**` | Astro host + app React |
| `/login` | Astro + island React dedicada |
| `/` | Astro + island React compartilhada |
| `/projetos` | Astro + island React compartilhada |
| `/projeto/[slug]` | Astro + island React compartilhada |
| `/postagem/[slug]` | Astro + island React compartilhada |
| `/projeto/[slug]/leitura/[chapter]` | Astro shell + island React |

### 12.2 Ownership alvo

| Grupo | Runtime alvo |
| --- | --- |
| paginas legais | Astro puro |
| paginas institucionais | Astro puro |
| `/` | Astro com islands minimas |
| `/projetos` | Astro + filtros/client hydration pontual |
| `/projeto/[slug]` | Astro + comments/widgets |
| `/postagem/[slug]` | Astro + comments/widgets |
| reader | Astro shell + island React |
| dashboard | host Astro ou fallback dedicado, mantendo app React |

## 13. Dados e meta

### 13.1 Fonte de dados

O Astro **nao** deve buscar dados diretamente do banco.
Os dados continuam vindo das funcoes de runtime do backend, especialmente:

- `loadSiteSettings()`
- `loadPages()`
- demais loaders server-side ja existentes no backend

### 13.2 Transporte de dados para Astro

No slice atual, o Express injeta em `Astro.locals.nekomata`:

- `siteSettings`
- `pages`
- `primaryAppOrigin`
- `routePayload` (dados especificos da rota, ex: team members, donations QR)

Esse contrato deve continuar pequeno e server-side.
Evitar recriar `window.__BOOTSTRAP_*` dentro do Astro.

Para rotas de conteudo (Fase 3), o contrato sera expandido com:

- `project` / `post` / `projects` / `posts`
- `tagTranslations`
- `mediaVariants`
- `homeHero`

### 13.3 Meta e SEO

Para rotas Astro:

- `head` deve ser declarado no `.astro`
- canonical deve ser gerado no servidor
- `robots` deve ser explicito
- OG/Twitter devem sair no HTML final
- structured data (schema.org) deve ser injetado server-side

Regra importante:

- nao usar `usePageMeta` em rotas migradas
- nao depender de `seo-snapshot` em rotas migradas

## 14. Dependency Cleanup Plan

### Remover/substituir

- `react-router-dom` no publico (manter para dashboard)
- `@mui/material`, `@mui/x-date-pickers`, `@emotion/react`, `@emotion/styled`
- `@tanstack/react-query` se scan confirmar sem uso
- `workbox-build`, `tw-animate-css`, `@tailwindcss/typography` se sem uso real

### Manter

- `react`, `react-dom`, `@radix-ui/*`, `tailwindcss`, `sonner`
- `react-hook-form`, `@lexical/*`, `sharp`, `@aws-sdk/client-s3`
- Prisma/Express stack

### Investigar

- `@tokagemushi/manga-viewer`, `framer-motion`, `recharts`
- `react-day-picker`, `@vercel/og`, `prettier` runtime no editor

## 15. Folder Structure: estado atual e alvo

### 15.1 Estado atual

```
src-astro/
  env.d.ts
  layouts/
    PublicLayout.astro
  pages/
    sobre.astro
    faq.astro
    equipe.astro
    doacoes.astro
    recrutamento.astro
    termos-de-uso.astro
    politica-de-privacidade.astro
  components/
    PublicPageHero.astro
  lib/
    public-layout.ts
    public-page-meta.ts
```

### 15.2 Estrutura alvo

```
src-astro/
  pages/
    index.astro
    projetos/index.astro
    projeto/[slug].astro
    projeto/[slug]/leitura/[chapter].astro
    postagem/[slug].astro
    sobre.astro
    equipe.astro
    faq.astro
    doacoes.astro
    recrutamento.astro
    termos-de-uso.astro
    politica-de-privacidade.astro
    login.astro
    dashboard/[...slug].astro
  layouts/
    PublicLayout.astro
    ReadingLayout.astro
    DashboardHostLayout.astro
  components/
    astro/          # componentes Astro puros
    react/          # islands React
    ui/             # componentes de UI compartilhados
  styles/
    tokens.css
    base.css
    themes.css
    utilities.css
    public/
    dashboard/
    editor/
  lib/
```

## 16. Assets, build e deploy

### 16.1 Artefatos atuais

- `dist/`: bundle cliente legado Vite
- `dist-ssr/`: renderer SSR/prerender legado
- `dist-astro/`: bundle Astro

### 16.2 Ordem atual do build

`npm run build` hoje executa:

1. `npm run build:astro`
2. `vite build`
3. `npm run build:public:ssr`
4. `npm run build:pwa`
5. `npm run prerender:public`
6. guards de chunks/home

### 16.3 Pipeline alvo (apos migracao completa)

1. `npm run build:astro` (gera `dist-astro/` com todo o publico)
2. `vite build` (gera `dist/` so com dashboard + islands React)
3. guards de validacao

Removidos:

- `build:public:ssr` (SSR nativo do Astro substitui)
- `prerender:public` (Astro SSR + cache HTTP substitui)
- `build:pwa` (cleanup legado)

### 16.4 Implicacao pratica

Enquanto o legado existir, o build oficial precisa continuar verde para as duas pilhas.
Nao e aceitavel "concluir" uma fase Astro quebrando `dist/`, `dist-ssr/` ou o runtime
de producao atual.

## 17. Styling

### Estado atual

- Tailwind v4 + shadcn/Radix + CSS global + Lexical CSS
- Enclave MUI/Emotion (usado no dashboard para date pickers)
- Ponto critico: `src/index.css` acumula estilos publicos e dashboard

### Estrategia alvo

- Tailwind v4 + CSS variables continuam como base
- Quebrar `src/index.css` em modulos: `tokens.css`, `base.css`, `themes.css`
- Remover MUI/Emotion quando date pickers forem substituidos
- Isolar Lexical CSS para nao vazar no publico
- Astro pages importam apenas os estilos necessarios

## 18. Estrutura de arquivos do servidor

### 18.1 Area Astro

- `astro.config.mjs`
- `tsconfig.astro.json`
- `src-astro/env.d.ts`
- `src-astro/layouts/`
- `src-astro/pages/`
- `src-astro/components/`
- `src-astro/lib/`

### 18.2 Area do servidor

- `server/lib/astro-public-runtime.js`
- `server/routes/register-astro-routes.js`
- wiring em `server/index.js`

### 18.3 Testes minimos da integracao

- `src/server/register-astro-routes.test.ts`
- `src/server/register-app-routes.test.ts`
- `src/server/public-paths.test.ts`

## 19. Regras de implementacao para as proximas fases

### 19.1 Regra de rollout

Migrar por rota, nao por "big bang".

Cada grupo de rotas novo deve:

- entrar explicitamente no registro Astro
- continuar com fallback legado para todo o resto
- sair com build, typecheck e testes verdes

### 19.2 Regra de hidratacao

Default:

- zero JS

Aceitavel:

- islands pequenas e isoladas

Evitar:

- `client:load` por conveniencia
- replicar o bootstrap publico global inteiro
- reintroduzir SPA shell completa dentro do Astro

### 19.3 Regra de dados

- primeiro mover HTML/meta
- depois decidir islands
- so por ultimo apagar o caminho legado equivalente

### 19.4 Regra de rollback

Toda fase precisa manter rollback simples:

- remover o ownership Astro daquela rota
- deixar o catch-all legado reassumir a resposta

Se uma fase exigir rollback complexo, a fase esta grande demais.

## 20. Risk Matrix

| Risco | Impacto | Probabilidade | Mitigacao |
| --- | --- | --- | --- |
| Quebra de SEO/canonical | Alto | Medio | diff de head/meta/schema por rota |
| Regressao de auth/dashboard | Alto | Baixo | dashboard permanece React isolado |
| Reader perder recursos | Alto | Medio | reader continua island React |
| Build/deploy quebrar | Alto | Medio | manter Express e Docker, trocar so frontend publico |
| Bundle continuar inchado | Medio | Medio | remover MUI, router publico, bootstrap global |
| Conteudo dinamico virar SSG errado | Medio | Medio | padrao inicial SSR + cache |
| Perda de query params | Medio | Medio | preservar `q/tag/genero/type/page/genre` |
| Hidratacao excessiva persistir | Medio | Alto | revisar cada rota com regra default zero-JS |

## 21. Performance Opportunity Report

Ganhos esperados:

- grande reducao de JS no publico ao eliminar `BrowserRouter`, bootstrap global,
  freshness polling e helpers de Vite
- remocao de vazamento de chunks lexical/charts/MUI para paginas publicas
- melhora de TTFB percebido e LCP por HTML real sem SPA shell compensatoria
- melhora de INP ao reduzir hidratacao global
- CLS mais previsivel com Astro layouts e menos patching pos-hidratacao

## 22. Criterios de pronto por fase

Uma rota/grupo so e considerada migrada quando:

- o HTML sai do Astro, nao do shell React legado
- `head`/canonical/robots/OG estao corretos no HTML final
- a rota continua acessivel no runtime Express real
- `npm run lint` passa
- `npm run typecheck` passa
- `npm run build` passa
- os testes de roteamento relevantes passam
- existe fallback claro para rollback

## 23. O que ainda nao fazer

Antes das fases adequadas, evitar:

- remover `publicPrerenderRuntime`
- apagar `window.__BOOTSTRAP_*`
- apagar `usePageMeta` globalmente
- desmontar `register-site-routes.js` ou `register-app-routes.js`
- mexer no dashboard para "acompanhar" o Astro
- mover reader para Astro sem shell/fallback definido

Essas limpezas sao fase posterior, nao precondicao para seguir.

## 24. Assumptions And Defaults

- Express, Prisma, PostgreSQL, auth, uploads e OG continuam existindo no primeiro ciclo
- Padrao de rendering inicial e SSR + cache, nao SSG, exceto paginas legais/institucionais
- Dashboard nao sera reescrito para Astro componente a componente
- Reader e Lexical nao serao reescritos; serao encapsulados como islands
- "Done" da migracao base: publico indexavel fora do React Router, sem `window.__BOOTSTRAP_*`,
  sem `seo-snapshot`, sem prerender manual, com regressao funcional e de performance validada

## 25. Comandos de validacao

Para qualquer fatia da migracao:

```bash
npm run lint
npm run typecheck
npm run build
```

Quando a mudanca tocar roteamento do servidor:

```bash
npx vitest run src/server/register-astro-routes.test.ts src/server/register-app-routes.test.ts src/server/public-paths.test.ts
```

Quando a mudanca tocar apenas Astro:

```bash
npm run astro:check
npm run build:astro
```

Quando a mudanca tocar superficie publica / performance:

```bash
npm run lighthouse:home:mobile
npm run lighthouse:projects:mobile
npm run lighthouse:public-surface
npm run lighthouse:public-surface:compare
```

## 26. Referencia de continuidade

Se uma sessao futura precisar retomar do ponto atual:

- a infraestrutura Astro base ja existe
- o Express ja serve `/_astro` e despacha sete rotas publicas para o handler Astro
- o proximo grupo natural de migracao e a limpeza da infraestrutura publica legada:
  `window.__BOOTSTRAP_*`, `seo-snapshot`, `build-public-ssr.mjs`, `prerender-public.mjs`
