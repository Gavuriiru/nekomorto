export const getUploadsListErrorMessage = (status?: number | null) =>
  status === 403
    ? "Você não tem permissão para visualizar uploads neste contexto."
    : "Não foi possível carregar os uploads agora.";

export const getUploadPermissionToastTitle = () =>
  "Você não tem permissão para enviar imagens neste contexto.";

export const getImportPermissionToastTitle = () =>
  "Você não tem permissão para importar imagens neste contexto.";
