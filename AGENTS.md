# Carta Operacional do Projeto

Este arquivo define as bases para toda ação tomada neste repositório. Ele orienta agentes e colaboradores sobre como entender o sistema, propor mudanças, preservar segurança, performance e confiabilidade, e validar o trabalho antes de encerrar uma tarefa.

Use este documento como referência de conduta técnica e critério de decisão. Para setup, comandos detalhados, arquitetura expandida e operação, consulte o `README.md`.

## 1. Propósito e Alcance

- Estas regras se aplicam a código, scripts, migrations, configuração, documentação técnica e operação cotidiana do projeto.
- Segurança continua sendo obrigatória e não negociável, mas não é o único critério: toda mudança também deve preservar clareza, desempenho, estabilidade e facilidade de manutenção.
- Quando houver conflito entre rapidez e robustez, prefira a opção que mantém rollback viável, observabilidade suficiente e comportamento previsível.

## 2. Princípios do Projeto

- PostgreSQL é a única fonte de verdade do runtime. Não introduza armazenamento paralelo autoritativo, sincronização oportunista ou caches que possam divergir do banco.
- Este projeto prioriza simplicidade operacional e compatibilidade com deploy single-instance. Não introduza dependências de infraestrutura extra sem necessidade comprovada.
- Toda mudança MUST preservar segurança, legibilidade, previsibilidade, capacidade de diagnóstico e rollback viável.
- Otimizações MUST NOT degradar UX pública, acessibilidade, observabilidade ou contratos já expostos pelo sistema.
- Prefira mudanças pequenas, incrementais e reversíveis a reescritas amplas sem necessidade.

## 3. Entendimento Mínimo do Sistema

- `src/`: frontend React/Vite, rotas públicas e do dashboard, componentes, hooks, estilos e testes.
- `server/`: backend Node/Express, auth, sessões, API, uploads, OG images, webhooks, observabilidade e rotas operacionais.
- `shared/`: utilitários compartilhados entre cliente e servidor.
- `prisma/`: schema e migrations do banco.
- `ops/`: deploy, compose, backup, restore e runbooks operacionais.
- `scripts/`: automações de build, auditoria, smoke tests, Lighthouse, migrações e manutenção.
- O backend Express serve a aplicação principal e expõe rotas públicas, autenticadas e operacionais como health, readiness, liveness e metrics.
- Autenticação, autorização e sessão são server-side. Sessões persistem no PostgreSQL.
- Uploads podem ser locais ou via object storage, mas o contrato público deve permanecer estável.
- Já existe baseline de performance pública e monitoramento operacional no projeto; novas mudanças devem respeitar esse ecossistema em vez de contorná-lo.

## 4. Regras para Mudanças de Código

- Explore antes de editar. Não assuma arquitetura, ownership ou fluxo de dados sem ler os pontos relevantes do repositório.
- Siga `CODE_STYLE.md` para estilo, nomenclatura e padrões de implementação. Use o `README.md` para setup, comandos e operação detalhada.
- Não duplique lógica entre cliente, servidor e `shared/` quando houver um ponto único apropriado.
- Prefira aproveitar utilitários, contratos e scripts existentes antes de criar novas variações locais.
- Toda mudança MUST ser compatível com os contratos atuais, a menos que a tarefa inclua explicitamente uma alteração de contrato.
- Ao mexer em comportamento sensível, atualize testes, documentação e runbooks afetados no mesmo trabalho.
- Evite dependências novas quando uma solução simples com a stack atual resolver o problema com menos risco.

## 5. Segurança Obrigatória

### 5.1 Segredos e Ambiente

- NEVER coloque API keys, tokens, credenciais ou segredos no frontend (`src/`, `public/` ou qualquer artefato enviado ao cliente).
- NEVER use `VITE_`, `NEXT_PUBLIC_` ou `REACT_APP_` para valores secretos.
- ALWAYS carregue segredos apenas no servidor.
- `.env` MUST estar no `.gitignore` antes de qualquer uso de segredo real.
- `.env.example` MUST conter apenas placeholders.

### 5.2 Banco e Acesso a Dados

- PostgreSQL e Prisma são o caminho padrão de acesso a dados. Não introduza queries com concatenação de input de usuário.
- ALWAYS use queries parametrizadas, APIs seguras do Prisma ou helpers equivalentes do servidor.
- NEVER use desserialização insegura em dados fornecidos por usuários.
- Mudanças em schema ou persistência MUST considerar migração, compatibilidade dos dados existentes e impacto operacional.

### 5.3 Autenticação e Autorização

- Toda rota que retorna ou modifica dados protegidos MUST passar por middleware de autenticação antes do handler.
- Requisições não autenticadas a endpoints protegidos MUST retornar `401`.
- Toda rota baseada em ID de recurso MUST validar ownership ou permissão explícita separadamente da autenticação.
- Endpoints administrativos MUST validar papel ou permissão administrativa e retornar `403` para quem não puder acessar.
- Cookies de sessão MUST permanecer `httpOnly`, `secure` e `sameSite: "lax"` em contexto de produção.

### 5.4 Input, Output e Conteúdo

- Todo input de usuário MUST ser validado no servidor. Validação no cliente é apenas UX.
- NEVER concatene input de usuário em SQL.
- NEVER use `dangerouslySetInnerHTML`, `innerHTML` ou equivalentes com conteúdo do usuário sem sanitização adequada.
- Erros para clientes MUST ser genéricos em produção. Stack trace, detalhes de banco, paths internos e nomes de bibliotecas ficam apenas em logs.
- Security headers MUST continuar centralizados em middleware global do servidor, com CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` e `Referrer-Policy` coerentes com o runtime atual.

### 5.5 Uploads, URLs Remotas e Integrações

- Uploads MUST validar tipo real do arquivo, renomear artefatos no servidor e evitar confiar apenas em extensão.
- URLs fornecidas por usuários MUST aceitar apenas `http` e `https`, bloquear IPs privados ou internos e validar resolução antes do fetch quando houver acesso remoto.
- CORS MUST usar allowlist explícita. NEVER use `origin: "*"` com `credentials: true`.
- Endpoints sensíveis como login, registro, reset, webhooks e rotas de alto abuso MUST ter rate limiting apropriado.
- Webhooks MUST validar autenticidade, tratar idempotência e registrar falhas de forma auditável.

### 5.6 Criptografia e Dependências

- Password hashing MUST usar bcrypt, Argon2 ou scrypt. NEVER use MD5, SHA-1 ou SHA-256 puro para senha.
- Antes de instalar dependência nova, verifique maturidade, manutenção, histórico e necessidade real.
- Dependências de produção devem permanecer pinadas com versões explícitas e lockfile commitado.

## 6. Performance Obrigatória

- Mudanças em superfícies públicas MUST evitar regressão perceptível de LCP, TBT e CLS.
- Preserve lazy loading, chunking saudável, preload intencional e a estratégia de shell e boot da experiência pública.
- Não introduza bibliotecas pesadas, renderizações redundantes, recomputações caras ou fetches em cascata sem necessidade.
- Ao tocar home, listagem pública, leitura, PWA ou dashboards pesados, considere os scripts Lighthouse já existentes e o baseline versionado em `reports/perf/public-surface-baseline.json`.
- Se uma otimização local piorar a experiência global, descarte-a ou reprojete-a.

## 7. Confiabilidade e Operação

- Health checks, readiness e liveness não podem ser quebrados por mudanças de código, infra ou configuração.
- Mudanças com impacto operacional MUST respeitar manutenção, deploy, backup, restore, observabilidade e diagnóstico existentes no projeto.
- Falhas devem degradar de forma segura: resposta clara para o operador, mensagem genérica para o cliente e detalhes completos apenas em logs e métricas.
- Jobs, scripts, webhooks e integrações SHOULD ser idempotentes quando a natureza da operação permitir repetição.
- Não remova telemetria, eventos operacionais, logs úteis ou sinais de saúde sem substituir por algo equivalente ou melhor.

## 8. Validação Mínima por Tipo de Mudança

- UI isolada:
  - Rode `npm run lint`, `npm run typecheck` e `npm run test`.
  - Rode `npm run test:a11y` se tocar interação, foco, semântica, teclado ou contraste.
- Superfície pública e performance:
  - Rode `npm run build` quando houver risco de regressão de build, chunking ou hidratação.
  - Considere `lighthouse:home:mobile`, `lighthouse:projects:*`, `lighthouse:reader-pages:mobile`, `lighthouse:dashboard:desktop` ou `lighthouse:public-surface` conforme a área alterada.
- API, auth e permissões:
  - Rode `npm run lint`, `npm run typecheck` e `npm run test`.
  - Se houver impacto no runtime ou na disponibilidade, valide também os fluxos de health e smoke relevantes.
- Banco, migrations e scripts operacionais:
  - Valide migração, compatibilidade de dados, impacto em rollback e documentação ou runbook afetados.
  - Não trate migration como detalhe de implementação quando ela muda o risco operacional.
- Uploads, storage, webhooks e ativos remotos:
  - Execute os scripts ou checks específicos já existentes para integridade, sync, health ou smoke quando o escopo tocar essas áreas.
- Mudanças apenas documentais:
  - Verifique consistência com o estado real do repositório e com os nomes exatos de comandos, paths e contratos citados.

## 9. Higiene Documental e de Dependências

- `AGENTS.md`: regras de ação, decisão e critérios de entrega.
- `README.md`: arquitetura, setup, comandos, deploy, operação e troubleshooting detalhado.
- `CODE_STYLE.md`: estilo, nomenclatura e convenções de implementação.
- `SECURITY.md`: política de reporte responsável.
- Evite duplicar listas grandes de comandos ou walkthroughs completos neste arquivo; prefira referências curtas e precisas aos documentos fonte.
- Quando uma mudança alterar um fluxo importante, atualize a documentação correspondente no mesmo conjunto de trabalho.
- Se um documento estiver desatualizado em relação ao código, corrija a divergência em vez de empilhar exceções tácitas.
