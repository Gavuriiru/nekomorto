# Roadmap da Migracao para Astro

Roadmap operacional para executar a migracao em dias diferentes sem perder
sequencia, escopo nem criterios de validacao.

## 1. Estado da linha de base

### 1.1 Progresso geral

| Fase | Status | Descricao |
| --- | --- | --- |
| Fase 0 | concluida | Baseline e guardrails |
| Fase 1 | concluida | Infra Astro + rotas legais |
| Fase 2 | concluida | Paginas institucionais Astro puro |
| Fase 3 | concluida | Home e catalogo publico em ownership Astro |
| Fase 4 | concluida | Login, dashboard host e fronteira React |
| Fase 5 | pendente | Reader e islands pesadas |
| Fase 6 | pendente | Limpeza de infraestrutura legada |
| Fase 7 | pendente | Simplificar styles/deps restantes |

### 1.2 O que ja foi feito

- infraestrutura Astro adicionada ao build (`astro.config.mjs`, `tsconfig.astro.json`, `src-astro/`)
- runtime Express preparado para servir slice Astro (`register-astro-routes.js`, `astro-public-runtime.js`)
- `PublicLayout.astro` e `PublicPageHero.astro` criados e compartilhados
- helpers `public-layout.ts` e `public-page-meta.ts` para dados server-side
- integracao `@astrojs/react` habilitada para islands SSR/hidratadas
- testes de integracao de roteamento funcionando
- ownership Astro expandido para login e dashboard host
- 13 rotas/superficies migradas:
  - `/`
  - `/projetos`
  - `/projeto/[slug]`
  - `/postagem/[slug]`
  - `/termos-de-uso`
  - `/politica-de-privacidade`
  - `/sobre`
  - `/faq`
  - `/equipe`
  - `/doacoes`
  - `/recrutamento`
  - `/login`
  - `/dashboard/**`

### 1.3 O que falta ser feito

- reduzir a ilha React compartilhada das rotas da Fase 3 e mover mais HTML para Astro puro
- migrar shell de leitura para Astro com reader como island React (Fase 5)
- remover bootstrap global, seo-snapshot, prerender legado (Fase 6)
- limpar deps MUI/Emotion, chunking manual, PWA legado (Fase 7)

## 2. Ordem oficial de execucao

Seguir nesta ordem, salvo decisao explicita em contrario:

1. consolidar a base hibrida (feito)
2. migrar paginas institucionais (feito)
3. migrar home/listagem/detalhes de conteudo
4. isolar dashboard e reader na arquitetura nova
5. remover lastro legado que deixar de ser necessario
6. simplificar styling e dependencias

## 3. Prioridade e esforco por fase

| Fase | Prioridade | Risco | Impacto | Esforco |
| --- | --- | --- | --- | --- |
| 0. Baseline e guardrails | P0 | Baixo | Alto | Baixo |
| 1. Infra Astro + rotas legais | P0 | Medio | Alto | Medio |
| 2. Paginas institucionais | P0 | Medio | Muito alto | Medio |
| 3. Home e catalogo publico | P1 | Medio | Muito alto | Alto |
| 4. Login, dashboard host | P1 | Medio | Alto | Medio |
| 5. Reader e islands pesadas | P2 | Alto | Alto | Alto |
| 6. Limpeza de infra legada | P2 | Medio | Alto | Medio |
| 7. Simplificar styles/deps | P3 | Medio | Medio | Medio |

## 4. Fases

### Fase 0. Baseline e guardrails

Status: **concluida**

Objetivo:

- ter comandos de build/typecheck/lint/teste como contrato minimo
- manter rollback simples

Saida minima:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

---

### Fase 1. Infra Astro + rotas legais

Status: **concluida**

Escopo concluido:

- `astro.config.mjs` (output: server, adapter: node/middleware, srcDir: src-astro)
- `tsconfig.astro.json`
- `src-astro/**`
- handler Astro no Express (`astro-public-runtime.js`)
- registro de rotas (`register-astro-routes.js`)
- `/termos-de-uso`
- `/politica-de-privacidade`

---

### Fase 2. Paginas institucionais Astro puro

Status: **concluida**

Rotas concluidas:

- `/sobre`
- `/faq`
- `/equipe`
- `/doacoes`
- `/recrutamento`

Entregas realizadas:

- ownership Astro dessas rotas
- layout publico compartilhado consolidado (`PublicLayout.astro`)
- meta/canonical/OG declarados no Astro
- dados via `Astro.locals.nekomata` (siteSettings, pages, routePayload)
- zero-JS por padrao em todas as rotas

Observacoes:

- `Equipe` e `Doacoes` podem exigir pequenas islands se houver interatividade real futura
- ainda nao mexer em login nem comments

Validacao executada:

```bash
npm run astro:check
npm run lint
npm run typecheck
npm run build
```

---

### Fase 3. Home e catalogo publico

Status: **concluida**

Prioridade: P1

Rotas:

- `/`
- `/projetos`
- `/projeto/[slug]`
- `/postagem/[slug]`

Objetivo concluido:

- mover ownership de documento, head, canonical, OG e schema para Astro
- servir `/`, `/projetos`, `/projeto/[slug]` e `/postagem/[slug]` pelo handler Astro
- preservar fallback/rollback simples e compatibilidade funcional do shell publico atual

Entregas realizadas:

- contrato `Astro.locals.nekomata` expandido com `publicBootstrap` para as rotas da Fase 3
- `register-astro-routes.js` atualizado para `/`, `/projetos`, `/projeto/:id`, `/postagem/:slug`
- `resolveAstroPublicRoutePayload` ligado ao runtime publico real do Express
- novas paginas Astro criadas para as quatro rotas
- island compartilhada `src-astro/components/react/PublicPhase3IslandApp.tsx` criada para preservar SSR/hidratacao React existente
- metadata, canonical e structured data dessas quatro rotas agora saem do Astro

Observacoes:

- a Fase 3 foi fechada com ownership Astro, mas ainda nao com Astro puro nessas quatro rotas
- `HeroSection`, catalogo, projeto e postagem ainda passam por uma island React compartilhada
- a reducao adicional de JS e a remocao de bootstrap global continuam como trabalho das Fases 6 e 7

Validacao executada:

```bash
npx vitest run src/server/register-astro-routes.test.ts src/server/astro-public-runtime.test.ts
npm run astro:check
npm run lint
npm run typecheck
npm run build
```

Resultado:

- HTML das 4 rotas sai do Astro
- head/canonical/robots/OG corretos em cada rota
- structured data presente e correto
- query params de `/projetos` preservados
- fallback legado ainda funcional para rollback

Follow-up recomendado antes da Fase 4:

- rodar `lighthouse:home:mobile`, `lighthouse:projects:mobile` e `lighthouse:public-surface`
- reduzir a island React compartilhada da Fase 3 por rota/componente

---

### Fase 4. Login, dashboard host e fronteira React

Status: **concluida**

Prioridade: P1

Rotas:

- `/login`
- `/dashboard/**`

Objetivo concluido:

- mover `/login` e `/dashboard/**` para ownership Astro sem reescrever as paginas React existentes
- manter auth/session, bootstrap e protecoes do dashboard intactos
- separar o host publico de login do host interno de dashboard de forma previsivel

Entregas realizadas:

- `register-astro-routes.js` expandido para `/login` e `/dashboard/**`
- `src-astro/pages/login.astro` criada com shell Astro e island React dedicada
- `src-astro/pages/dashboard/[...slug].astro` criada como host interno Astro
- `DashboardHostLayout.astro` criado para o documento do dashboard
- hosts React dedicados separados do `App.tsx` global:
  - `LoginIslandApp.tsx`
  - `DashboardIslandApp.tsx`
- dashboard continua usando a arvore React atual, incluindo `DashboardRoutes`, `RequireAuth`, `DashboardSessionProvider` e `DashboardPreferencesProvider`

Pontos preservados:

- login continua `noindex`
- dashboard continua isolado do chrome publico
- refresh direto em `/dashboard/**` continua valido
- auth/session e ownership/permissoes continuam no caminho atual do backend e do app React

#### Validacao

```bash
npx vitest run src/server/register-astro-routes.test.ts src/server/register-app-routes.test.ts src/server/astro-public-runtime.test.ts
npm run lint
npm run typecheck
npm run build
npm run test
```

---

### Fase 5. Reader e islands pesadas

Status: **pendente**

Prioridade: P2

Rotas:

- `/projeto/[slug]/leitura/[chapter]`

Objetivo:

- migrar o shell de documento para Astro (`ReadingLayout.astro`)
- manter o reader como island React principal

#### Subetapas recomendadas

1. **Manga/webtoon reader**
   - criar `src-astro/pages/projeto/[slug]/leitura/[chapter].astro`
   - shell Astro com meta, canonical, robots
   - reader React como island `client:load`
   - preservar `@tokagemushi/manga-viewer`, preferencias localStorage, preload de assets

2. **Light novel reader**
   - avaliar se conteudo pode sair server-rendered (HTML puro)
   - navegacao, comments, polls como islands separadas
   - se viavel, reduzir JS significativamente vs manga reader

#### Pontos de atencao

- preferencias do reader (localStorage): modo de leitura, pagina, scroll
- preload de assets de capitulos adjacentes
- manga vs webtoon vs light novel tem comportamentos distintos
- comments/polls e scroll behavior nao podem quebrar
- performance do reader e critica para a experiencia

#### Validacao

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run lighthouse:reader-pages:mobile
```

---

### Fase 6. Limpeza de infraestrutura legada

Status: **pendente**

Prioridade: P2

Objetivo:

- remover apenas o que deixou de ser necessario de verdade
- cada remocao deve ser por evidencias, nao por desejo arquitetural

#### Candidatos a remocao

| Item | Arquivo(s) | Condicao para remocao |
| --- | --- | --- |
| `window.__BOOTSTRAP_*` | `html-bootstrap.js`, `use-public-bootstrap.ts` | todas as rotas publicas migradas |
| SEO snapshot | `public-seo-snapshot.js` | todas as rotas publicas migradas |
| Prerender incremental | `public-prerender-runtime.js`, `prerender-public.mjs` | Astro SSR substitui |
| SSR publico paralelo | `build-public-ssr.mjs`, `src/ssr/public-app.tsx` | Astro SSR substitui |
| Vite preload recovery (publico) | `vite-preload-recovery.ts` | publico nao usa mais Vite |
| `usePageMeta` nas rotas migradas | multiplos | Astro head substitui |
| Trechos de `register-site-routes.js` | `register-site-routes.js` | rotas equivalentes no Astro |
| Trechos de `register-app-routes.js` | `register-app-routes.js` | rotas equivalentes no Astro |
| Bootstrap init script | `html-bootstrap.js` (linhas 65-237) | nenhuma rota depende mais |

#### Regra

- limpar por evidencias, nao por desejo arquitetural
- cada remocao deve ser verificavel com build + testes verdes
- manter o que ainda for necessario para o dashboard/reader legado

---

### Fase 7. Simplificar styles/deps restantes

Status: **pendente**

Prioridade: P3

Objetivo:

- remover dependencias que deixaram de ser usadas
- simplificar pipeline de CSS

#### Escopo

| Item | Acao | Condicao |
| --- | --- | --- |
| MUI/Emotion | remover | date pickers substituidos |
| Chunking manual | simplificar/remover | lexical/charts/MUI nao vazam mais no publico |
| PWA cleanup | remover `build-pwa.mjs` | PWA funcional nova ou decisao de nao ter |
| `src/index.css` | quebrar em modulos | styling migrado para tokens/base/themes |
| Lexical CSS | isolar | nao vazar para publico |
| react-router-dom publico | remover | todas as rotas publicas no Astro |

## 5. Deploy incremental

Releases planejados:

| Release | Escopo | Fase |
| --- | --- | --- |
| Release 1 | paginas legais/institucionais | Fases 1-2 (feito) |
| Release 2 | home/projetos/projeto/post | Fase 3 |
| Release 3 | dashboard host + login | Fase 4 |
| Release 4 | reader shell | Fase 5 |
| Release 5 | limpeza final | Fases 6-7 |

Rollback: preservar entrada React/Vite antiga ate a Fase 4; trocar roteamento de
producao apenas quando as paginas equivalentes passarem smoke + Lighthouse + SEO diff.

## 6. Modelo de execucao por dia

Cada sessao deve caber num recorte pequeno e reversivel.

### Template recomendado de sessao

1. escolher um grupo pequeno de rotas
2. confirmar ownership atual
3. migrar layout/head/dados
4. plugar a rota no registro Astro
5. validar build/testes
6. documentar o novo estado antes de encerrar

### Exemplos de recortes seguros

- Dia A: expandir contrato de dados + `/`
- Dia B: `/projetos`
- Dia C: `/projeto/[slug]`
- Dia D: `/postagem/[slug]`
- Dia E: `/login`
- Dia F: `/dashboard/[...slug]`
- Dia G: reader shell manga
- Dia H: reader shell light novel
- Dia I: limpeza bootstrap/seo-snapshot
- Dia J: limpeza prerender/SSR legado
- Dia K: limpeza deps/styling

## 7. Checklist de entrada por fase

Antes de iniciar qualquer fase:

- confirmar que `main` ou branch atual esta verde
- reler `docs/astro-migration-architecture.md`
- identificar rotas exatas da sessao
- listar comandos de validacao que vao ser executados
- verificar se o contrato de dados em `Astro.locals` e suficiente

## 8. Checklist de saida por fase

Antes de encerrar qualquer sessao:

- documentar quais rotas mudaram de ownership
- registrar o que ainda ficou legado
- rodar os comandos relevantes
- manter rollback claro
- atualizar tabela de ownership neste documento

## 9. Registro de ownership

Atualizar esta tabela ao fim de cada marco:

| Rota/grupo | Runtime atual | Ultima validacao |
| --- | --- | --- |
| `/termos-de-uso` | Astro | `astro:check` + vitest |
| `/politica-de-privacidade` | Astro | `astro:check` + vitest |
| `/sobre` | Astro | `astro:check` + vitest |
| `/faq` | Astro | `astro:check` + vitest |
| `/equipe` | Astro | `astro:check` + vitest |
| `/doacoes` | Astro | `astro:check` + vitest |
| `/recrutamento` | Astro | `astro:check` + vitest |
| `/` | Astro + island React compartilhada | `astro:check` + vitest + build |
| `/projetos` | Astro + island React compartilhada | `astro:check` + vitest + build |
| `/projeto/[slug]` | Astro + island React compartilhada | `astro:check` + vitest + build |
| `/postagem/[slug]` | Astro + island React compartilhada | `astro:check` + vitest + build |
| `/login` | React legado | pendente (Fase 4) |
| `/dashboard/**` | React legado | pendente (Fase 4) |
| `/projeto/[slug]/leitura/[chapter]` | React legado | pendente (Fase 5) |

## 10. Criterio para seguir para a proxima fase

So avancar quando a fase anterior tiver:

- ownership claro de rotas
- build verde
- typecheck verde
- lint verde
- fallback/rollback simples
- documentacao atualizada
- Lighthouse sem regressao (quando aplicavel)

## 11. Proximo passo oficial

Se a implementacao for retomada agora, o proximo marco deve ser:

- **Fase 4: login, dashboard host e fronteira React**

Preparacao recomendada antes dela:

1. rodar Lighthouse da Fase 3 e registrar baseline novo se necessario
2. decidir se `/login` entra como island React `client:load` ou continua legado por mais um ciclo
3. desenhar o host de `/dashboard/**` sem quebrar chunks, auth e CSS isolado
