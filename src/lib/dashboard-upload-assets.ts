import { apiFetch } from "@/lib/api-client";
import { fileToDataUrl } from "@/lib/file-data-url";

type UploadDashboardImageAssetArgs = {
  apiBase: string;
  file: File;
  folder?: string;
  slot?: string;
  scopeUserId?: string;
  filename?: string;
};

export const uploadDashboardImageAsset = async ({
  apiBase,
  file,
  folder,
  slot,
  scopeUserId,
  filename,
}: UploadDashboardImageAssetArgs) => {
  const dataUrl = await fileToDataUrl(file);
  const response = await apiFetch(apiBase, "/api/uploads/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    auth: true,
    body: JSON.stringify({
      dataUrl,
      filename: filename || file.name,
      folder: folder || undefined,
      slot: slot || undefined,
      scopeUserId: scopeUserId || undefined,
    }),
  });
  if (!response.ok) {
    throw new Error("upload_failed");
  }
  const data = await response.json().catch(() => null);
  return String(data?.url || "").trim();
};
