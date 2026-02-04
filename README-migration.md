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
