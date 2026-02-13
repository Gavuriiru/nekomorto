# Migração e Deploy

Este documento resume ajustes necessários para migrar o site e operar em múltiplos domínios, além de exemplos de paginação das APIs públicas.

## Variáveis de Ambiente

### `APP_ORIGIN`
Lista de origens públicas permitidas (separadas por vírgula).
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
Se for `auto`, o redirect do Discord usa a origem atual.
Caso contrário, defina o URL completo:
```
DISCORD_REDIRECT_URI=https://meusite.com/login
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
