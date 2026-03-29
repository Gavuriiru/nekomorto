# Restore e Validacao do `dev.nekomata.moe`

## Objetivo
Restaurar o ambiente `dev.nekomata.moe` como frontend prod-like e validar explicitamente a paridade da feature EPUB entre frontend e backend, incluindo o contrato da PWA.

## Restore
1. Subir app e proxy usando o deploy versionado:
   - `bash ops/dev/deploy-dev.sh`
2. Validar a instancia local integrada:
   - `GET http://127.0.0.1:8080/api/contracts/v1.json`
   - `POST http://127.0.0.1:8080/api/projects/epub/import?...` sem auth esperando `401` ou `403`
3. Validar `GET /api/health/live`
4. Validar `GET /api/health`
5. Validar `GET /api/contracts/v1.json`
6. Confirmar no contrato:
   - `capabilities.project_epub_import === true`
   - `capabilities.project_epub_export === true`
   - `build.commitSha`
   - `build.builtAt`
7. Confirmar que `POST /api/projects/epub/import` sem auth responde `401` ou `403`, nunca `404`
8. Confirmar o mesmo para `POST /api/projects/epub/export`
9. Confirmar que o frontend servido em `https://dev.nekomata.moe/` e `http://127.0.0.1:8080/` e o smoke nao encontra HTML de Vite:
   - o HTML nao pode conter `@vite/client`
   - o HTML nao pode conter `/src/main.tsx`
10. Confirmar `GET /sw.js`
11. Confirmar `GET /manifest.webmanifest`
12. Confirmar que `sw.js` e `manifest.webmanifest` respondem `200`, nunca `404`
13. Depois do primeiro deploy corrigido, invalidar cache de CDN/Cloudflare para:
   - `/`
   - `/sw.js`
   - `/manifest.webmanifest`
14. Confirmar que a CDN nao esta retendo `404` desses entrypoints da PWA; se existir regra de edge para eles, deve respeitar revalidacao da origem ou bypass de cache

## Diagnostico de mismatch
Quando o dashboard mostrar "backend desatualizado" ou a importacao/exportacao EPUB falhar por rota ausente:

1. Abrir `/api/contracts/v1.json`
2. Abrir `/api/health`
3. Anotar `backend.build.commitSha`
4. Comparar com:
   - `APP_IMAGE_TAG`
   - container ativo no host
   - build exibido no dashboard
5. Se backend novo e frontend velho:
   - invalidar cache de CDN/proxy se houver, incluindo `/`, `/sw.js` e `/manifest.webmanifest`
   - fazer hard refresh
   - confirmar `index.html` e assets do commit esperado
6. Se frontend novo e backend velho:
   - redeploy do backend dev
7. Se diferentes requests retornarem status divergentes:
   - investigar rollout parcial, multiplas instancias ou proxy apontando para destinos diferentes
8. Se o smoke interno passar mas o externo acusar HTML de Vite (`@vite/client` ou `/src/main.tsx`):
   - tratar como incidente de proxy/DNS/CDN apontando para a instancia errada
   - nao tratar como bug do bundle da app enquanto o alvo publico nao estiver apontando para o deploy prod-like correto
   - invalidar cache de CDN para `/`, `/sw.js` e `/manifest.webmanifest` depois de corrigir o roteamento

## Incidente de uploads publicos 404
Quando `/api/public/bootstrap` expor `/uploads/...` que respondem `404` no dominio publico:

1. Rodar `npm run uploads:check-integrity -- --mode=fast --folder projects/21878`
2. Se object storage estiver configurado, rodar `node scripts/restore-uploads-from-object-storage.mjs --apply --repair-missing-local --folder projects/21878`
3. Rodar novamente `npm run uploads:check-integrity -- --mode=fast --folder projects/21878`
4. Rodar smoke publica com `node scripts/smoke-api.mjs --base=https://dev.nekomata.moe --expect-prod-html=true --check-public-media=true`
5. So depois validar manualmente o projeto afetado em `https://dev.nekomata.moe`
6. Se o original nao existir nem localmente nem no remoto:
   - tratar como incidente de conteudo
   - reupload manual no admin
   - ou corrigir a referencia nos dados antes do rollout
7. Nao adicionar fallback ou auto-heal no path publico de `/uploads`

## Validacao final
1. Rodar `node scripts/smoke-api.mjs --base=https://dev.nekomata.moe --expect-prod-html=true --check-public-media=true`
2. Rodar `node scripts/check-category6-smoke.mjs --base=https://dev.nekomata.moe`
3. Abrir `https://dev.nekomata.moe/sw.js`
4. Abrir `https://dev.nekomata.moe/manifest.webmanifest`
5. Abrir a home e confirmar que o HTML carregado no browser nao referencia `@vite/client` nem `/src/main.tsx`
6. Confirmar que imagens publicas referenciadas pelo bootstrap nao respondem `404`
7. Abrir o dashboard de um projeto `Light Novel`
8. Confirmar que a secao EPUB mostra:
   - origem atual
   - API base resolvida
   - build do backend
   - build do frontend
9. Confirmar que os botoes EPUB estao habilitados
10. Fazer um import real de `.epub`
11. Confirmar ausencia de `404`
