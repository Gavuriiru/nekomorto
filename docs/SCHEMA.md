# Schema Atual (JSON)

Este documento congela o schema atual para facilitar a migração para banco.

## posts
- `id` (string, required)
- `title` (string)
- `slug` (string, unique)
- `coverImageUrl` (string | null)
- `coverAlt` (string)
- `excerpt` (string)
- `content` (string)
- `contentFormat` ("markdown" | "html")
- `author` (string)
- `publishedAt` (ISO string)
- `scheduledAt` (ISO string | null)
- `status` ("draft" | "scheduled" | "published")
- `seoTitle` (string)
- `seoDescription` (string)
- `projectId` (string | "")
- `tags` (string[])
- `views` (number)
- `viewsDaily` (object)
- `commentsCount` (number)
- `deletedAt` (ISO string | null)
- `deletedBy` (string | null)
- `createdAt` (ISO string)
- `updatedAt` (ISO string)
- `searchText` (string)

## projects
- `id` (string, required)
- `anilistId` (number | null)
- `title` (string)
- `titleOriginal` (string)
- `titleEnglish` (string)
- `synopsis` (string)
- `description` (string)
- `type` (string)
- `status` (string)
- `year` (string)
- `studio` (string)
- `episodes` (string)
- `tags` (string[])
- `genres` (string[])
- `cover` (string)
- `banner` (string)
- `season` (string)
- `schedule` (string)
- `rating` (string)
- `country` (string)
- `source` (string)
- `producers` (string[])
- `score` (number | null)
- `startDate` (string)
- `endDate` (string)
- `relations` (array)
- `staff` (array)
- `animeStaff` (array)
- `trailerUrl` (string)
- `episodeDownloads` (array)
- `views` (number)
- `viewsDaily` (object)
- `commentsCount` (number)
- `order` (number)
- `deletedAt` (ISO string | null)
- `deletedBy` (string | null)
- `createdAt` (ISO string)
- `updatedAt` (ISO string)
- `searchText` (string)

### projects.relations[]
- `relation` (string)
- `title` (string)
- `format` (string)
- `status` (string)
- `image` (string)
- `projectId` (string | undefined)
- `anilistId` (number | string | undefined)

### projects.episodeDownloads[]
- `number` (number | string)
- `title` (string)
- `duration` (string)
- `releaseDate` (ISO string)
- `volume` (number | string)
- `content` (string)
- `contentFormat` ("markdown" | "html")
- `coverImageUrl` (string)
- `hash` (string | undefined)
- `sizeBytes` (number | undefined)
- `sources` (array)

### projects.episodeDownloads[].sources[]
- `label` (string)
- `url` (string)

## users
- `id` (string)
- `name` (string)
- `avatarUrl` (string | null)
- `avatarDisplay` ({ `x`: number, `y`: number, `zoom`: number, `rotation`: number })
- `phrase` (string)
- `bio` (string)
- `socials` ({ `label`: string, `href`: string }[])
- `status` ("active" | "retired")
- `permissions` (string[])
: RBAC V2 usa catalogo explicito (`posts`, `projetos`, `comentarios`, `paginas`, `uploads`, `analytics`, `usuarios_basico`, `usuarios_acesso`, `configuracoes`, `audit_log`, `integracoes`).
- `roles` (string[])
: exclusivo para funcoes de equipe. `Dono` nao deve ser persistido em `roles`.
- `accessRole` ("normal" | "admin" | "owner_secondary" | "owner_primary")
- `order` (number)

## owner-ids
- arquivo: `server/data/owner-ids.json`
- tipo: `string[]`
: governanca de donos. O primeiro item e o owner primario.

## auth payloads
- `GET /api/me` adiciona:
  - `accessRole`
  - `ownerIds`
  - `primaryOwnerId`
  - `grants` (mapa booleano por permissao RBAC V2)
- `GET /api/users` adiciona:
  - `accessRole` e `grants` por usuario
  - `ownerIds` e `primaryOwnerId` no payload da lista

## comments
- `id` (string)
- `targetType` ("post" | "project" | "chapter")
- `targetId` (string)
- `targetMeta` (object)
- `parentId` (string | null)
- `name` (string)
- `emailHash` (string)
- `content` (string)
- `status` ("pending" | "approved" | "rejected")
- `createdAt` (ISO string)
- `approvedAt` (ISO string | null)
- `avatarUrl` (string)

## updates
- `id` (string)
- `projectId` (string)
- `projectTitle` (string)
- `episodeNumber` (number | string)
- `kind` (string)
- `reason` (string)
- `unit` (string)
- `updatedAt` (ISO string)
- `image` (string)

## site-settings
- `site` (object)
- `theme` (object)
- `navbar` (object)
- `community` (object)
- `downloads` (object)
- `teamRoles` (array)
- `footer` (object)

## pages
- `about`, `donations`, `faq`, `team`, `recruitment` (objects)

## uploads
- `id` (string)
- `url` (string, "/uploads/...")
- `fileName` (string)
- `folder` (string)
- `size` (number)
- `mime` (string)
- `createdAt` (ISO string)
