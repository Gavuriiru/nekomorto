# Carta Operacional do Projeto

Este é o guia de primeiro contexto para agentes no repositório Nekomorto. Use-o para
entender rapidamente o sistema, escolher os comandos certos e saber quando uma tarefa
está pronta. Para setup detalhado, deploy, variáveis e troubleshooting, consulte
`README.md`. Para estilo, consulte `CODE_STYLE.md`.

## 1. Como Trabalhar Neste Repositório

- Explore antes de editar. Leia os arquivos e testes relacionados à área da tarefa.
- Faça mudanças pequenas, compatíveis com rollback e alinhadas aos padrões existentes.
- Não mude comportamento da aplicação em tarefas documentais, de organização ou de
  orientação para agentes.
- Não reverta mudanças que você não fez. Se o worktree estiver sujo, preserve o trabalho
  existente e limite o diff ao escopo da tarefa.
- Não invente comandos, convenções ou fluxos. Derive tudo de `package.json`, README,
  scripts, CI e código real.
- Quando houver conflito entre rapidez e robustez, escolha a opção com comportamento
  previsível, observabilidade suficiente e rollback viável.

## 2. Contexto Rápido do Sistema

- Produto: aplicação Nekomorto com superfície pública, dashboard autenticado, leitura de
  projetos/posts, uploads, webhooks, analytics e operação de produção.
- Runtime: frontend React/Vite servido pelo backend Node/Express.
- Banco: PostgreSQL é a única fonte de verdade do runtime. Sessões também persistem no
  PostgreSQL.
- ORM/migrations: Prisma.
- Deploy esperado: compatível com operação single-instance e Docker/Compose.
- Performance pública: existe baseline versionado em
  `reports/perf/public-surface-baseline.json`; não contorne esse ecossistema.

## 3. Mapa do Repositório

- `src/`: frontend React/Vite, rotas públicas e dashboard, componentes, hooks, estilos,
  tipos e testes.
- `src/server/`: testes e módulos server-side cobertos pela suíte Vitest.
- `server/`: backend Express, bootstrap, rotas, assets e bibliotecas de runtime.
- `shared/`: utilitários compartilhados entre cliente e servidor.
- `prisma/`: `schema.prisma` e migrations do PostgreSQL.
- `scripts/`: automações de setup, Prisma, build, smoke, Lighthouse, uploads, backup e
  manutenção.
- `ops/`: Docker/Compose, deploy, backup/restore e runbooks operacionais.
- `docs/`: schema, migração, auditorias de performance/acessibilidade e remediações.
- `.github/workflows/`: CodeQL, build/publicação da imagem de produção e performance
  pública.
- `public/`: assets públicos versionados. Não coloque segredos aqui.
- `reports/perf/public-surface-baseline.json`: baseline versionado de performance.

## 4. Setup e Comandos Descobertos

Pré-requisitos derivados do README e `package.json`:

- Node.js `24.14.x`
- npm `11.x`
- PostgreSQL acessível via `DATABASE_URL`
- Docker + Docker Compose para banco local e stack de produção

Setup local recomendado:

```bash
npm install
npm run setup:dev
```

Servidor local:

```bash
npm run dev
```

Modo separado:

```bash
npm run dev:server
npm run dev:client:local-api
```

Build e produção local:

```bash
npm run build
npm run start
```

Prisma:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:prepare
```

Qualidade:

```bash
npm run lint
npm run format:check
npm run format
npm run typecheck
npm run typecheck:ts7-preview
npm run test
npm run test:a11y
```

Health, smoke e operação:

```bash
npm run api:health:check -- --base=http://localhost:8080 --expect-source=db --expect-maintenance=false
npm run api:smoke -- --base=http://localhost:8080
npm run staging:parity:check
npm run reports:outdated
```

Performance pública e auditoria:

```bash
npm run build:audit
npm run lighthouse:home:mobile
npm run lighthouse:projects:mobile
npm run lighthouse:projects:desktop
npm run lighthouse:reader-pages:mobile
npm run lighthouse:dashboard:desktop
npm run lighthouse:public-surface
npm run lighthouse:public-surface:compare
```

Uploads/storage:

```bash
npm run uploads:check-integrity
npm run uploads:check-integrity -- --mode=fast
npm run uploads:check-integrity -- --mode=deep
npm run uploads:sync-to-object-storage -- --dry-run
npm run uploads:restore-from-object-storage -- --dry-run
npm run uploads:generate-inventory
```

## 5. Convenções de Código

- Siga `CODE_STYLE.md`: 2 espaços, ponto e vírgula, aspas duplas, line width 100 e LF.
- Biome é a ferramenta de lint/format. Configuração em `biome.json`.
- Use alias `@/` para imports dentro de `src/`.
- Componentes React são funcionais; hooks ficam no topo; use early returns para estados
  de carregamento/erro.
- Prefira `interface` para objetos e props; evite `any`.
- Interações com banco devem usar Prisma ou helpers server-side seguros.
- Evite dependências novas. Se forem necessárias, preserve lockfile e justifique a
  necessidade.
- Não duplique lógica entre cliente, servidor e `shared/` quando houver ponto único
  apropriado.

## 6. Segurança Obrigatória

- Nunca coloque API keys, tokens, credenciais ou segredos em `src/`, `public/` ou em
  qualquer artefato enviado ao cliente.
- Nunca use `VITE_`, `NEXT_PUBLIC_` ou `REACT_APP_` para valores secretos.
- `.env` e `.env.*` reais devem permanecer fora do Git; `.env.example` e exemplos em
  `ops/**` devem conter apenas placeholders.
- Toda rota protegida deve autenticar antes do handler; endpoints administrativos também
  devem validar papel/permissão e retornar `403` quando apropriado.
- Toda rota por ID de recurso deve validar ownership/permissão além da autenticação.
- Inputs de usuário devem ser validados no servidor. Validação no cliente é apenas UX.
- Nunca concatene input de usuário em SQL.
- Nunca use `dangerouslySetInnerHTML`, `innerHTML` ou equivalente com conteúdo de usuário
  sem sanitização adequada.
- Erros para clientes devem ser genéricos em produção; detalhes ficam em logs/métricas.
- Headers de segurança devem continuar centralizados no middleware global do servidor.
- Uploads devem validar tipo real do arquivo, renomear no servidor e não confiar apenas em
  extensão.
- URLs fornecidas por usuários devem aceitar apenas `http` e `https`, bloquear destinos
  privados/internos e validar resolução antes de fetch remoto quando aplicável.
- CORS deve usar allowlist explícita. Nunca use `origin: "*"` com `credentials: true`.
- Endpoints sensíveis como login, registro, reset, webhooks e rotas de alto abuso devem
  manter rate limiting apropriado.
- Password hashing deve usar bcrypt, Argon2 ou scrypt. Nunca use MD5, SHA-1 ou SHA-256
  puro para senha.

## 7. Performance, Acessibilidade e Operação

- Mudanças em superfícies públicas não devem degradar LCP, TBT ou CLS de forma perceptível.
- Preserve lazy loading, chunking, preload intencional e a estratégia de shell/boot da
  experiência pública.
- Não introduza bibliotecas pesadas, renderizações redundantes, recomputações caras ou
  fetches em cascata sem necessidade.
- Se tocar home, projetos, leitura, PWA ou dashboards pesados, considere os scripts
  Lighthouse relevantes e o baseline em `reports/perf/public-surface-baseline.json`.
- Health, readiness, liveness e metrics não podem ser quebrados por mudanças de código,
  infra ou configuração.
- Jobs, scripts, webhooks e integrações devem ser idempotentes quando a operação puder ser
  repetida.
- Não remova telemetria, eventos operacionais, logs úteis ou sinais de saúde sem substituir
  por algo equivalente ou melhor.

## 8. Arquivos Gerados e Áreas a Evitar

Evite editar manualmente ou incluir em diffs sem necessidade:

- `node_modules/`
- `dist/`, `dev-dist/`, `.vite/`, `.cache/`, coverage e artefatos de build
- `.lighthouse/` e relatórios gerados, exceto o baseline versionado permitido
- `reports/*`, exceto `reports/perf/public-surface-baseline.json`
- `public/uploads/`
- `server/data/`, exceto exemplos versionados
- `backups/` e `ops/postgres/backups/`
- `.claude/worktrees/`, `.claude/settings.local.json`, `.openclaude/`, `.kiro/`,
  `.agents/`, `skills-lock.json`, `scratch-*`, `tmp/` e arquivos locais de ferramenta
- `package-lock.json`, salvo quando a mudança em dependências realmente exigir atualização

Antes de tocar migrations, scripts operacionais, uploads, autenticação, permissões,
cookies, CSP/CORS, webhooks ou schema Prisma, leia o fluxo existente e valide rollback e
impacto operacional.

## 9. Validação Mínima por Tipo de Mudança

- Documentação: verifique consistência com arquivos reais, comandos reais e paths citados.
  O `biome.json` atual ignora arquivos Markdown quando caminhos específicos são passados,
  então revise o diff diretamente e use `git diff --check` para problemas básicos de
  whitespace.
- UI isolada: rode `npm run lint`, `npm run typecheck` e `npm run test`; rode
  `npm run test:a11y` se tocar interação, foco, semântica, teclado ou contraste.
- Superfície pública/performance: rode `npm run build` quando houver risco de regressão de
  build, chunking ou hidratação; considere os comandos Lighthouse aplicáveis.
- API, auth e permissões: rode `npm run lint`, `npm run typecheck` e `npm run test`; se
  houver impacto de runtime/disponibilidade, valide health e smoke.
- Banco/migrations/scripts operacionais: valide migração, compatibilidade de dados,
  rollback e documentação/runbooks afetados.
- Uploads/storage/webhooks/ativos remotos: rode os checks específicos já existentes para
  integridade, sync, health ou smoke conforme a área.

## 10. Critérios de Done para Futuras Sessões Codex

Uma tarefa só está pronta quando:

- O pedido do usuário foi atendido dentro do escopo combinado.
- O diff é pequeno, revisado e não contém mudanças comportamentais acidentais.
- Contratos públicos, segurança, auth/ownership, acessibilidade, performance e operação
  foram preservados ou explicitamente tratados.
- Testes foram adicionados/atualizados quando o risco ou a mudança de comportamento
  justificou.
- Os comandos relevantes foram executados, ou a impossibilidade foi registrada com motivo
  concreto.
- Documentação/runbooks foram atualizados quando a mudança alterou setup, operação,
  comandos, env vars, contratos ou fluxos importantes.
- Arquivos gerados, segredos e artefatos locais foram mantidos fora do diff.
- A resposta final lista arquivos alterados, verificações executadas, resultados,
  blockers/unknowns e follow-up recomendado quando houver.

## 11. Referências Internas

- `README.md`: arquitetura, setup, env vars, deploy, operação, backup/restore,
  troubleshooting e referência rápida de comandos.
- `CODE_STYLE.md`: estilo, nomenclatura e convenções de implementação.
- `CONTRIBUTING.md`: fluxo de contribuição e checklist de PR.
- `SECURITY.md`: política de segurança e reporte.
- `docs/SCHEMA.md`: referência de schema.
- `docs/DB_MIGRATION_RUNBOOK.md`: operação de migração de dados.
- `docs/public-performance.md`, `docs/lighthouse-home-mobile.md` e
  `docs/lighthouse-dashboard-desktop.md`: auditoria de performance.
- `docs/wcag-2.2-aa-audit-matrix.md`: auditoria de acessibilidade.
- `ops/postgres/README.md`: stack PostgreSQL self-hosted.
- `ops/staging/parity-checklist.md`: paridade de staging.
- `ops/runbooks/`: runbooks de incidentes.
