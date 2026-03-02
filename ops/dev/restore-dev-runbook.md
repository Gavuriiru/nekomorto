# Restore e Validacao do `dev.nekomata.moe`

## Objetivo
Restaurar o ambiente `dev.nekomata.moe` e validar explicitamente a paridade da feature EPUB entre frontend e backend.

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
9. Confirmar no browser que o websocket HMR usa o mesmo host da pagina, sem `:24678`

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
   - invalidar cache de CDN/proxy se houver
   - fazer hard refresh
   - confirmar `index.html` e assets do commit esperado
6. Se frontend novo e backend velho:
   - redeploy do backend dev
7. Se diferentes requests retornarem status divergentes:
   - investigar rollout parcial, multiplas instancias ou proxy apontando para destinos diferentes

## Validacao final
1. Rodar `node scripts/check-category6-smoke.mjs --base=https://dev.nekomata.moe`
2. Abrir o dashboard de um projeto `Light Novel`
3. Confirmar que a secao EPUB mostra:
   - origem atual
   - API base resolvida
   - build do backend
   - build do frontend
4. Confirmar que os botoes EPUB estao habilitados
5. Fazer um import real de `.epub`
6. Confirmar ausencia de `404`
