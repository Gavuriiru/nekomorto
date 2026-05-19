# Roadmap da Migracao para Astro

Roadmap operacional da migracao React/Vite -> Astro no Nekomorto, atualizado para o
estado real do repositorio em 2026-05-19.

## 1. Estado atual

### 1.1 Progresso por fase

| Fase | Status | Descricao |
| --- | --- | --- |
| Fase 0 | concluida | Baseline e guardrails |
| Fase 1 | concluida | Infra Astro + rotas legais |
| Fase 2 | concluida | Paginas institucionais Astro puro |
| Fase 3 | concluida | Ownership Astro das rotas publicas principais |
| Fase 4 | concluida | Login e dashboard sob host Astro |
| Fase 5 | concluida | Reader shell sob Astro |
| Fase 6 | concluida | Remocao do SSR/prerender publico legado |
| Fase 7 | concluida | Cleanup de PWA legado e enclave MUI/Emotion |
| Fechamento final | concluido | `react-router-dom` saiu do slice publico indexavel e o shell Phase 3 foi removido |

### 1.2 O que ja foi concluido

- `src-astro/` consolidado como host server-first para a superficie publica migrada.
- `server/routes/register-astro-routes.js` e `server/lib/astro-public-runtime.js` fazem o
  ownership Astro das rotas publicas e do reader.
- `build:public:ssr` e `prerender:public` sairam do pipeline oficial na Fase 6.
- `/`, `/projetos`, `/projeto/[slug]` e `/postagem/[slug]` continuam em ownership Astro,
  agora com hydration dedicada por rota e sem o shell/router publico compartilhado:
  - `HomeIslandApp.tsx`
  - `ProjectsIslandApp.tsx`
  - `ProjectIslandApp.tsx`
  - `PostIslandApp.tsx`
- o shell legado `Phase3PublicAppShell.tsx` e a navegacao publica compartilhada da Fase 3
  sairam do codigo ativo.
- `react-router-dom` foi removido das rotas publicas indexaveis e do chrome publico dessas
  paginas.
- o enclave MUI/Emotion dos campos de data/hora do dashboard foi substituido por campos
  nativos em `src/components/ui/mui-date-time-fields.tsx`, preservando a API local.
- o pipeline legado de service worker foi removido:
  - `scripts/build-pwa.mjs`
  - `src/lib/pwa-cleanup.ts`
  - `src/lib/pwa-register.ts`
  - `src/lib/pwa-bootstrap.ts`
  - suporte de runtime a `/sw.js` e `workbox-*`

### 1.3 O que ainda resta

- reduzir mais a hidratacao das paginas publicas principais quando houver ganho real de bundle
  ou manutencao.
- revisar, depois de novos ciclos de produto, se ainda faz sentido simplificar mais o chunking
  manual restante ou retirar dependencias residuais.

## 2. Ownership atual

| Rota/grupo | Runtime atual | Observacao |
| --- | --- | --- |
| `/termos-de-uso` | Astro | pagina legal |
| `/politica-de-privacidade` | Astro | pagina legal |
| `/sobre` | Astro | institucional |
| `/faq` | Astro | institucional |
| `/equipe` | Astro | institucional |
| `/doacoes` | Astro | institucional |
| `/recrutamento` | Astro | institucional |
| `/` | Astro + island React dedicada por rota | sem `react-router-dom` no slice publico |
| `/projetos` | Astro + island React dedicada por rota | filtros e querystring sem router React |
| `/projeto/[slug]` | Astro + island React dedicada por rota | detalhe sem router React |
| `/postagem/[slug]` | Astro + island React dedicada por rota | detalhe sem router React |
| `/login` | Astro + island React dedicada | manter React |
| `/dashboard/**` | Astro host + app React | manter React |
| `/projeto/[slug]/leitura/[chapter]` | Astro shell + island React | manter React |

## 3. Fases encerradas

### Fase 3

Status: **concluida**

Resultado real:

- ownership Astro das quatro rotas publicas principais foi concluido.
- o shell compartilhado de roteamento da Fase 3 nao existe mais.
- cada rota agora tem sua propria island React, sem `BrowserRouter`, `StaticRouter`,
  `Routes` ou `Route` no slice publico indexavel.

Limite conhecido:

- as rotas ainda nao sao Astro puras.
- ainda existem islands de pagina inteira por rota em partes do publico principal.

### Fase 6

Status: **concluida**

Resultado real:

- `build:public:ssr` e `prerender:public` foram removidos do build oficial.
- o shell React legado deixou de ser owner do documento publico.
- o contrato server-first do slice Astro passou a ser o caminho principal.

### Fase 7

Status: **concluida**

Resultado real:

- date/time fields do dashboard deixaram de depender de MUI/Emotion.
- `build:pwa` foi removido do build oficial.
- `scripts/build-pwa.mjs` saiu do repositorio.
- runtime deixou de servir `/sw.js` e `workbox-*` como contrato suportado.
- testes e smoke deixaram de tratar service worker legado como requisito.

Limite conhecido:

- `manifest.webmanifest` e assets em `/pwa/**` continuam existindo.
- isso nao representa mais um pipeline de service worker suportado.

## 4. Proximo marco oficial

Nao existe mais uma fase obrigatoria de migracao em aberto.

Os proximos trabalhos, se houver, passam a ser otimizacoes incrementais:

1. reduzir hidratacao por widget nas rotas publicas principais;
2. simplificar bundle e preload conforme necessidade real;
3. manter React restrito a enclaves justificados por interatividade.

## 5. Validacao minima para qualquer retomada

```bash
npm run lint
npm run typecheck
npm run build
```

Quando tocar roteamento/server:

```bash
npx vitest run src/server/register-astro-routes.test.ts src/server/register-app-routes.test.ts src/server/public-paths.test.ts src/server/register-runtime-middleware.test.ts
```

Quando tocar as rotas publicas principais:

```bash
npm run lighthouse:home:mobile
npm run lighthouse:projects:mobile
npm run lighthouse:public-surface
```

## 6. Regra de continuidade

Se uma sessao futura retomar daqui, nao assumir que ainda existe uma fase pendente de
ownership.

O ponto atual do repositorio e:

- Astro ja e o owner das rotas publicas principais;
- o router React publico foi removido do slice indexavel;
- o reader, login e dashboard seguem como enclaves React controlados;
- o restante e trabalho opcional de reducao adicional de hidratacao e bundle.
