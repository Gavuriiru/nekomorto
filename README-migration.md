# Migração e Deploy

Este documento resume ajustes necessários para migrar o site e operar em múltiplos domínios, além de exemplos de paginação das APIs públicas.

## Fluxo Integrado (Frontend + Backend)

### Desenvolvimento
Um comando sobe API + frontend no mesmo origin:

```bash
npm run dev
```

URL padrão:
```text
http://localhost:8080
```

Comandos opcionais de diagnóstico:
```bash
npm run dev:server
npm run dev:client
```

### Produção
Build + start integrados:

```bash
npm run build
npm run start
```

`npm run start` exige `dist/index.html` gerado no build.
Em produção, CORS aceita apenas origens da allowlist configurada.
Requests sem header `Origin` são aceitos somente em `GET`/`HEAD`/`OPTIONS`.

## Variáveis de Ambiente

### `APP_ORIGIN`
Lista de origens publicas permitidas (separadas por virgula).
Em `NODE_ENV=production`, esta variavel e obrigatoria e deve conter ao menos uma origem `http(s)` valida.
Exemplo:
```
APP_ORIGIN=https://meusite.com,https://www.meusite.com
```

### `ADMIN_ORIGINS`
Lista de origens adicionais (ex.: painel/admin) permitidas no CORS.
Exemplo:
```
ADMIN_ORIGINS=https://admin.meusite.com
```

### `DISCORD_REDIRECT_URI`
Se for `auto`, o redirect do Discord usa a origem da requisicao (quando permitida) e fallback para `APP_ORIGIN` primario.
Caso contrario, defina um URL absoluto `http(s)` completo:
```
DISCORD_REDIRECT_URI=https://meusite.com/login
```

### `VITE_API_BASE`
Opcional no frontend. Sem valor, o app usa chamadas same-origin (`window.location.origin`).
Use apenas quando frontend e API estiverem em dominios diferentes.
Exemplo:
```
VITE_API_BASE=https://api.meusite.com
```

## Paginação nas APIs Públicas

As rotas abaixo aceitam `page` e `limit`. Se não forem passados, retornam o mesmo comportamento antigo (sem paginação).

### Posts
```
GET /api/public/posts?page=1&limit=12
```
Resposta:
```
{
  "posts": [...],
  "page": 1,
  "limit": 12,
  "total": 123
}
```

### Projetos
```
GET /api/public/projects?page=1&limit=24
```

### Atualizações
```
GET /api/public/updates?page=1&limit=10
```

## Uploads

Uploads internos são armazenados como caminhos relativos:
```
/uploads/...
```
Isso evita travar domínio ou IP.

Para gerar um inventário retroativo dos uploads, use:
```
node scripts/generate-uploads-inventory.mjs
```

O inventário fica em:
```
server/data/uploads.json
```

## Backup Rápido

Cria um snapshot de `server/data` e `public/uploads` em `backups/`.
```
node scripts/backup-data.mjs
```

## Localizar Imagens Remotas de Projetos

Converte imagens remotas em campos estruturados de projetos para `/uploads/...`.

Dry-run (sem baixar/escrever):
```
node scripts/localize-project-images.mjs
```

Aplicar em todos os projetos:
```
node scripts/localize-project-images.mjs --apply
```

Aplicar em um projeto especifico:
```
node scripts/localize-project-images.mjs --apply --project 21878
```

## Localizacao de Imagens de Projetos (politica atual)

- Campos principais (`cover`, `banner`, `heroImageUrl`) sao localizados em `/uploads/projects/<projectId>/`.
- Imagens de `relations[].image` sao localizadas em `/uploads/projects/<projectId>/` com nome deterministico (`relation-<anilistId>` ou hash da URL).
- Capas de episodios (`episodeDownloads[].coverImageUrl`) sao localizadas em `/uploads/projects/<projectId>/episodes/`.

Backfill legado (dry-run e apply):

```bash
node scripts/localize-project-images.mjs
node scripts/localize-project-images.mjs --apply
node scripts/localize-project-images.mjs --apply --project 21878
```

## Isolamento Manual de Imagens de Projeto

Duplica imagens usadas por projeto para pastas do proprio projeto, inclusive quando a mesma URL
e compartilhada por multiplos projetos ou por projeto+post.

Dry-run (padrao):
```bash
node scripts/isolate-project-images.mjs
```

Aplicar em todos os projetos:
```bash
node scripts/isolate-project-images.mjs --apply
```

Aplicar em um projeto especifico:
```bash
node scripts/isolate-project-images.mjs --apply --project 21878
```

## RBAC V2

### Flags de rollout

Backend:
```bash
RBAC_V2_ENABLED=false
RBAC_V2_ACCEPT_LEGACY_STAR=true
```

Frontend:
```bash
VITE_RBAC_V2_ENABLED=false
```

### Migracao de permissoes (`users.json`)

Dry-run:
```bash
node scripts/migrate-permissions-v2.mjs --dry-run
```

Aplicar:
```bash
node scripts/migrate-permissions-v2.mjs --apply
```

O script:
- converte `*` para permissoes explicitas;
- preenche `accessRole`;
- remove `Dono` persistido em `roles`;
- preserva permissoes desconhecidas em storage;
- reconcilia `owner-ids.json`;
- grava backup em `backups/` e auditoria em `server/data/audit-log.json`.
