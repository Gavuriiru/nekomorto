# Migracao React/Vite -> Astro

Documento operacional da migracao da superficie publica do Nekomorto para Astro.
O objetivo aqui nao e justificar a decisao de produto; e registrar o desenho tecnico,
as restricoes reais do repositorio e as regras que permitem continuar a migracao em
dias diferentes sem perder contexto.

## 1. Objetivo

Migrar a superficie publica indexavel para Astro `server-first`, reduzindo a
dependencia de SPA global, bootstrap manual, prerender incremental e compensacoes
de SEO, sem reescrever backend, auth, uploads, dashboard ou reader no primeiro ciclo.

## 2. Estado atual do repositorio

Hoje o projeto esta em modo **hibrido**:

- o backend continua sendo Node/Express em `server/index.js`
- o frontend legado continua em React/Vite
- o build legado continua produzindo `dist/`
- o renderer SSR paralelo continua em `dist-ssr/public/renderer.mjs`
- a nova camada Astro ja produz `dist-astro/`
- em producao, o Express agora consegue servir um primeiro slice Astro

### 2.1 Slice Astro ja implantado

Rotas atualmente servidas pelo Astro:

- `/termos-de-uso`
- `/politica-de-privacidade`

Essas rotas usam:

- `src-astro/layouts/PublicLayout.astro`
- `src-astro/pages/termos-de-uso.astro`
- `src-astro/pages/politica-de-privacidade.astro`
- `server/lib/astro-public-runtime.js`
- `server/routes/register-astro-routes.js`

### 2.2 O que continua legado

- home
- listagem de projetos
- pagina de projeto
- pagina de postagem
- login
- paginas institucionais restantes
- reader
- dashboard
- bootstrap publico global
- prerender incremental legado
- renderer SSR publico legado

## 3. Diretrizes de arquitetura

### 3.1 Principio central

Astro assume a composicao de documento e HTML das rotas publicas indexaveis.
React deixa de ser o shell obrigatorio da superficie publica e passa a ser usado
onde interatividade rica ainda e estrutural.

### 3.2 O que nao muda nesta migracao

- PostgreSQL continua sendo a fonte unica de verdade
- Prisma continua sendo a camada de acesso a dados
- Express continua sendo o runtime principal
- API, auth, uploads, webhooks, analytics e OG continuam no backend atual
- dashboard continua em React
- reader de manga/light novel continua sendo problema separado

### 3.3 Estrategia de coexistencia

Durante boa parte da migracao, duas pilhas coexistem:

- **pilha nova**: Astro para rotas publicas selecionadas
- **pilha legada**: React/Vite + bootstrap + SSR/prerender atuais para todo o resto

Essa convivencia e intencional. Nao e objetivo apagar o pipeline legado cedo demais.

## 4. Runtime alvo por camada

### 4.1 Express

Responsabilidades:

- servir API, auth, uploads, OG e runtime operacional
- montar assets estaticos de `dist/`, `dist-ssr/` e `dist-astro/`
- despachar rotas Astro antes do catch-all legado quando a rota ja foi migrada
- manter fallback seguro para o app legado enquanto a migracao nao termina

### 4.2 Astro

Responsabilidades:

- montar HTML server-first da superficie publica migrada
- declarar `head`, canonical, robots, OG e Twitter meta sem `usePageMeta`
- receber `siteSettings` e `pages` do servidor por `Astro.locals`
- usar zero-JS por padrao; hidratar apenas onde realmente houver necessidade

### 4.3 React

Responsabilidades futuras na arquitetura final:

- dashboard inteiro
- login, se continuar com fluxo altamente interativo
- comments, busca rica e widgets especificos
- reader
- Lexical editor/viewer

## 5. Ownership de rotas

### 5.1 Ownership atual

| Grupo | Runtime atual |
| --- | --- |
| `/termos-de-uso` | Astro |
| `/politica-de-privacidade` | Astro |
| `/dashboard/**` | React legado |
| `/login` | React legado |
| demais rotas publicas | React legado |

### 5.2 Ownership alvo

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

## 6. Dados e meta

### 6.1 Fonte de dados

O Astro **nao** deve buscar dados diretamente do banco.
Os dados continuam vindo das funcoes de runtime do backend, especialmente:

- `loadSiteSettings()`
- `loadPages()`
- demais loaders server-side ja existentes no backend

### 6.2 Transporte de dados para Astro

No slice atual, o Express injeta em `Astro.locals.nekomata`:

- `siteSettings`
- `pages`
- `primaryAppOrigin`

Esse contrato deve continuar pequeno e server-side.
Evitar recriar `window.__BOOTSTRAP_*` dentro do Astro.

### 6.3 Meta e SEO

Para rotas Astro:

- `head` deve ser declarado no `.astro`
- canonical deve ser gerado no servidor
- `robots` deve ser explicito
- OG/Twitter devem sair no HTML final

Regra importante:

- nao usar `usePageMeta` em rotas migradas
- nao depender de `seo-snapshot` em rotas migradas

## 7. Assets, build e deploy

### 7.1 Artefatos atuais

- `dist/`: bundle cliente legado Vite
- `dist-ssr/`: renderer SSR/prerender legado
- `dist-astro/`: bundle Astro

### 7.2 Ordem atual do build

`npm run build` hoje executa:

1. `npm run build:astro`
2. `vite build`
3. `npm run build:public:ssr`
4. `npm run build:pwa`
5. `npm run prerender:public`
6. guards de chunks/home

### 7.3 Implicacao pratica

Enquanto o legado existir, o build oficial precisa continuar verde para as duas pilhas.
Nao e aceitavel “concluir” uma fase Astro quebrando `dist/`, `dist-ssr/` ou o runtime
de producao atual.

## 8. Estrutura de arquivos da migracao

### 8.1 Area Astro

- `astro.config.mjs`
- `tsconfig.astro.json`
- `src-astro/env.d.ts`
- `src-astro/layouts/`
- `src-astro/pages/`
- `src-astro/lib/`

### 8.2 Area do servidor

- `server/lib/astro-public-runtime.js`
- `server/routes/register-astro-routes.js`
- wiring em `server/index.js`

### 8.3 Testes minimos da integracao

- `src/server/register-astro-routes.test.ts`
- `src/server/register-app-routes.test.ts`
- `src/server/public-paths.test.ts`

## 9. Regras de implementacao para as proximas fases

### 9.1 Regra de rollout

Migrar por rota, nao por “big bang”.

Cada grupo de rotas novo deve:

- entrar explicitamente no registro Astro
- continuar com fallback legado para todo o resto
- sair com build, typecheck e testes verdes

### 9.2 Regra de hidratacao

Default:

- zero JS

Aceitavel:

- islands pequenas e isoladas

Evitar:

- `client:load` por conveniencia
- replicar o bootstrap publico global inteiro
- reintroduzir SPA shell completa dentro do Astro

### 9.3 Regra de dados

- primeiro mover HTML/meta
- depois decidir islands
- so por ultimo apagar o caminho legado equivalente

### 9.4 Regra de rollback

Toda fase precisa manter rollback simples:

- remover o ownership Astro daquela rota
- deixar o catch-all legado reassumir a resposta

Se uma fase exigir rollback complexo, a fase esta grande demais.

## 10. Criterios de pronto por fase

Uma rota/grupo so e considerada migrada quando:

- o HTML sai do Astro, nao do shell React legado
- `head`/canonical/robots/OG estao corretos no HTML final
- a rota continua acessivel no runtime Express real
- `npm run lint` passa
- `npm run typecheck` passa
- `npm run build` passa
- os testes de roteamento relevantes passam
- existe fallback claro para rollback

## 11. O que ainda nao fazer

Antes das fases adequadas, evitar:

- remover `publicPrerenderRuntime`
- apagar `window.__BOOTSTRAP_*`
- apagar `usePageMeta` globalmente
- desmontar `register-site-routes.js` ou `register-app-routes.js`
- mexer no dashboard para “acompanhar” o Astro
- mover reader para Astro sem shell/fallback definido

Essas limpezas sao fase posterior, nao precondicao para seguir.

## 12. Comandos de validacao

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

## 13. Referencia de continuidade

Se uma sessao futura precisar retomar do ponto atual:

- a infraestrutura Astro base ja existe
- o Express ja serve `/_astro` e despacha duas rotas legais para o handler Astro
- o proximo grupo natural de migracao e o conjunto institucional:
  `/sobre`, `/faq`, `/equipe`, `/doacoes`, `/recrutamento`

