# Roadmap da Migracao para Astro

Roadmap operacional para executar a migracao em dias diferentes sem perder
sequencia, escopo nem criterios de validacao.

## 1. Estado da linha de base

Fase ja concluida neste repositorio:

- infraestrutura Astro adicionada ao build
- runtime Express preparado para servir um slice Astro
- rotas legais migradas:
  - `/termos-de-uso`
  - `/politica-de-privacidade`

Isso significa que o projeto ja esta em **Fase 1 concluida / Fase 2 iniciada**.

## 2. Ordem oficial de execucao

Seguir nesta ordem, salvo decisao explicita em contrario:

1. consolidar a base hibrida
2. migrar paginas institucionais
3. migrar home/listagem/detalhes de conteudo
4. isolar dashboard e reader na arquitetura nova
5. remover lastro legado que deixar de ser necessario

## 3. Fases

### Fase 0. Baseline e guardrails

Status:

- concluida

Objetivo:

- ter comandos de build/typecheck/lint/teste como contrato minimo
- manter rollback simples

Saida minima:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Fase 1. Infra Astro + rotas legais

Status:

- concluida

Escopo concluido:

- `astro.config.mjs`
- `tsconfig.astro.json`
- `src-astro/**`
- handler Astro no Express
- `/termos-de-uso`
- `/politica-de-privacidade`

Pendencias remanescentes desta fase:

- nenhuma obrigatoria

### Fase 2. Paginas institucionais Astro puro

Prioridade:

- P0

Rotas:

- `/sobre`
- `/faq`
- `/equipe`
- `/doacoes`
- `/recrutamento`

Objetivo:

- mover essas rotas para Astro com zero-JS por padrao
- reaproveitar `siteSettings`, `pages` e normalizadores server-side existentes
- evitar dependencia de `BrowserRouter` e `usePageMeta`

Entregas esperadas:

- ownership Astro dessas rotas
- layout publico compartilhado consolidado
- meta/canonical/OG declarados no Astro

Validacao:

```bash
npm run astro:check
npm run lint
npm run typecheck
npm run build
```

Observacoes:

- `Equipe` e `Doacoes` podem exigir pequenas islands se houver interatividade real
- ainda nao mexer em login nem comments

### Fase 3. Home e catalogo publico

Prioridade:

- P1

Rotas:

- `/`
- `/projetos`
- `/projeto/[slug]`
- `/postagem/[slug]`

Objetivo:

- sair do shell React global para as rotas publicas mais importantes
- trocar bootstrap/manual meta por rendering server-first

Subetapas recomendadas:

1. `/sobre` e afins consolidados
2. migrar `/` primeiro
3. migrar `/projetos`
4. migrar `/projeto/[slug]`
5. migrar `/postagem/[slug]`

Pontos de atencao:

- query params e filtros de `/projetos`
- preload de imagens da home
- cards de projeto/post
- comments e widgets abaixo da dobra
- structured data e canonical por rota

Validacao adicional recomendada:

```bash
npm run lighthouse:home:mobile
npm run lighthouse:projects:mobile
npm run lighthouse:public-surface
```

### Fase 4. Login, dashboard host e fronteira React

Prioridade:

- P1

Rotas:

- `/login`
- `/dashboard/**`

Objetivo:

- decidir o host definitivo do dashboard na arquitetura nova
- manter o app React do dashboard intacto, mas encapsulado de forma previsivel

Abordagem recomendada:

- `/login`: avaliar Astro + island React ou manter legado por mais um ciclo
- `/dashboard/**`: host dedicado, com o app React carregado como superficie isolada

Regra:

- nao reescrever paginas do dashboard para Astro componente a componente

### Fase 5. Reader e islands pesadas

Prioridade:

- P2

Rotas:

- `/projeto/[slug]/leitura/[chapter]`

Objetivo:

- migrar o shell de documento para Astro
- manter o reader como island React principal

Pontos de atencao:

- preferencias do reader
- localStorage
- preload de assets
- manga/webtoon/light novel
- comments/polls e comportamento de scroll

### Fase 6. Limpeza de infraestrutura legada

Prioridade:

- P2

Objetivo:

- remover apenas o que deixou de ser necessario de verdade

Candidados a remocao futura:

- `window.__BOOTSTRAP_*`
- `usePageMeta` nas rotas publicas migradas
- `seo-snapshot`
- partes do prerender incremental legado
- trechos de `register-site-routes.js` e `register-app-routes.js` que so existirem para o shell antigo
- recovery de preload do Vite que nao fizer mais sentido no publico

Regra:

- limpar por evidencias, nao por desejo arquitetural

## 4. Modelo de execucao por dia

Cada sessao deve caber num recorte pequeno e reversivel.

### Template recomendado de sessao

1. escolher um grupo pequeno de rotas
2. confirmar ownership atual
3. migrar layout/head/dados
4. plugar a rota no registro Astro
5. validar build/testes
6. documentar o novo estado antes de encerrar

### Exemplos de recortes seguros

- Dia A: `/sobre` + `/faq`
- Dia B: `/equipe`
- Dia C: `/doacoes` + `/recrutamento`
- Dia D: `/`
- Dia E: `/projetos`
- Dia F: `/projeto/[slug]`
- Dia G: `/postagem/[slug]`

## 5. Checklist de entrada por fase

Antes de iniciar qualquer fase:

- confirmar que `main` ou branch atual esta verde
- reler `docs/astro-migration-architecture.md`
- identificar rotas exatas da sessao
- listar comandos de validacao que vao ser executados

## 6. Checklist de saida por fase

Antes de encerrar qualquer sessao:

- documentar quais rotas mudaram de ownership
- registrar o que ainda ficou legado
- rodar os comandos relevantes
- manter rollback claro

## 7. Registro de ownership sugerido

Atualizar esta tabela ao fim de cada marco:

| Rota/grupo | Runtime atual | Ultima validacao |
| --- | --- | --- |
| `/termos-de-uso` | Astro | feito |
| `/politica-de-privacidade` | Astro | feito |
| `/sobre` | React legado | pendente |
| `/faq` | React legado | pendente |
| `/equipe` | React legado | pendente |
| `/doacoes` | React legado | pendente |
| `/recrutamento` | React legado | pendente |
| `/` | React legado | pendente |
| `/projetos` | React legado | pendente |
| `/projeto/[slug]` | React legado | pendente |
| `/postagem/[slug]` | React legado | pendente |
| `/login` | React legado | pendente |
| `/dashboard/**` | React legado | pendente |
| `/projeto/[slug]/leitura/[chapter]` | React legado | pendente |

## 8. Criterio para seguir para a proxima fase

So avancar quando a fase anterior tiver:

- ownership claro de rotas
- build verde
- typecheck verde
- lint verde
- fallback/rollback simples
- documentacao atualizada

## 9. Proximo passo oficial

Se a implementacao for retomada agora, o proximo marco deve ser:

- **Fase 2: paginas institucionais Astro puro**

Ordem recomendada dentro dela:

1. `/sobre`
2. `/faq`
3. `/equipe`
4. `/doacoes`
5. `/recrutamento`

